const {
  DEFAULT_AUTHOR,
  createExcerpt,
  ensureUniqueSlug,
  getFileFromForm,
  getRequestUrl,
  getSupabaseAdmin,
  normalizePost,
  parseMultipart,
  requireAdminSession,
  requireAllowedOrigin,
  sanitizeBlogHtml,
  saveBlogImage,
  sendJson,
  toSingleValue
} = require('./_lib/blog');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const supabase = getSupabaseAdmin();
      const url = getRequestUrl(req);
      const includeAll = url.searchParams.get('all') === '1';

      if (includeAll && !requireAdminSession(req, res)) {
        return;
      }

      let query = supabase
        .from('blog_posts')
        .select(
          includeAll
            ? 'id, slug, title, excerpt, body_html, cover_image_url, cover_image_path, image_alt, author_name, status, published_at, created_at, updated_at'
            : 'id, slug, title, excerpt, body_html, cover_image_url, image_alt, author_name, status, published_at, created_at, updated_at'
        )
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (!includeAll) {
        query = query.eq('status', 'published');
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      sendJson(res, 200, {
        ok: true,
        posts: (data || []).map(normalizePost)
      });
      return;
    }

    if (req.method === 'POST') {
      if (!requireAllowedOrigin(req, res)) {
        return;
      }

      if (!requireAdminSession(req, res)) {
        return;
      }

      const { fields, files } = await parseMultipart(req);
      const title = String(toSingleValue(fields.title) || '').trim();
      const rawBodyHtml = String(toSingleValue(fields.body_html) || '').trim();
      const requestedExcerpt = String(toSingleValue(fields.excerpt) || '').trim();
      const imageAlt = String(toSingleValue(fields.image_alt) || '').trim();
      const authorName =
        String(toSingleValue(fields.author_name) || '').trim() || DEFAULT_AUTHOR;
      const requestedStatus =
        String(toSingleValue(fields.status) || 'published').trim().toLowerCase();
      const status = requestedStatus === 'draft' ? 'draft' : 'published';

      if (!title || !rawBodyHtml) {
        sendJson(res, 400, {
          ok: false,
          error: 'Title and body HTML are required.'
        });
        return;
      }

      const bodyHtml = sanitizeBlogHtml(rawBodyHtml);
      if (!bodyHtml) {
        sendJson(res, 400, {
          ok: false,
          error: 'Body HTML is empty after sanitising.'
        });
        return;
      }

      const supabase = getSupabaseAdmin();
      const slug = await ensureUniqueSlug(supabase, title);
      const image = getFileFromForm(files, 'image');
      const imageData = await saveBlogImage(image, slug);

      const insertPayload = {
        slug,
        title,
        excerpt: requestedExcerpt || createExcerpt(bodyHtml),
        body_html: bodyHtml,
        cover_image_url: imageData.image_url,
        cover_image_path: imageData.image_path,
        image_alt: imageAlt,
        author_name: authorName,
        status,
        published_at: status === 'published' ? new Date().toISOString() : null
      };

      const { data, error } = await supabase
        .from('blog_posts')
        .insert(insertPayload)
        .select(
          'id, slug, title, excerpt, body_html, cover_image_url, cover_image_path, image_alt, author_name, status, published_at, created_at, updated_at'
        )
        .single();

      if (error) {
        throw error;
      }

      sendJson(res, 201, {
        ok: true,
        post: normalizePost(data)
      });
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || 'Unexpected error.'
    });
  }
};
