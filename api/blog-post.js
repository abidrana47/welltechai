const {
  DEFAULT_AUTHOR,
  createExcerpt,
  ensureUniqueSlug,
  getAdminSession,
  getFileFromForm,
  getRequestUrl,
  getSupabaseAdmin,
  normalizePost,
  parseMultipart,
  readJsonBody,
  removeBlogImage,
  requireAdminSession,
  requireAllowedOrigin,
  sanitizeBlogHtml,
  saveBlogImage,
  sendJson,
  toSingleValue
} = require('./_lib/blog');

async function getExistingPost(supabase, id) {
  const { data, error } = await supabase
    .from('blog_posts')
    .select(
      'id, slug, title, excerpt, body_html, cover_image_url, cover_image_path, image_alt, author_name, status, published_at, created_at, updated_at'
    )
    .eq('id', id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const supabase = getSupabaseAdmin();
      const url = getRequestUrl(req);
      const slug = url.searchParams.get('slug');
      const id = url.searchParams.get('id');
      const session = getAdminSession(req);

      let query = supabase
        .from('blog_posts')
        .select(
          'id, slug, title, excerpt, body_html, cover_image_url, cover_image_path, image_alt, author_name, status, published_at, created_at, updated_at'
        )
        .limit(1);

      if (slug) {
        query = query.eq('slug', slug);
      } else if (id && session) {
        query = query.eq('id', id);
      } else {
        sendJson(res, 400, { ok: false, error: 'Missing slug.' });
        return;
      }

      if (!session) {
        query = query.eq('status', 'published');
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        throw error;
      }

      if (!data) {
        sendJson(res, 404, { ok: false, error: 'Post not found.' });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        post: normalizePost(data)
      });
      return;
    }

    if (req.method === 'PATCH') {
      if (!requireAllowedOrigin(req, res)) {
        return;
      }

      if (!requireAdminSession(req, res)) {
        return;
      }

      const { fields, files } = await parseMultipart(req);
      const id = String(toSingleValue(fields.id) || '').trim();
      if (!id) {
        sendJson(res, 400, { ok: false, error: 'Post id is required.' });
        return;
      }

      const supabase = getSupabaseAdmin();
      const existingPost = await getExistingPost(supabase, id);
      const requestedTitle = String(toSingleValue(fields.title) || '').trim();
      const requestedBodyHtml = String(toSingleValue(fields.body_html) || '').trim();
      const requestedExcerpt = String(toSingleValue(fields.excerpt) || '').trim();
      const requestedImageAlt = String(toSingleValue(fields.image_alt) || '').trim();
      const requestedAuthor =
        String(toSingleValue(fields.author_name) || '').trim() || DEFAULT_AUTHOR;
      const requestedStatus = String(toSingleValue(fields.status) || '').trim().toLowerCase();
      const regenerateSlug = String(toSingleValue(fields.regenerate_slug) || '').trim() === 'true';
      const removeImage = String(toSingleValue(fields.remove_image) || '').trim() === 'true';

      const nextTitle = requestedTitle || existingPost.title;
      const nextBodyHtml = requestedBodyHtml
        ? sanitizeBlogHtml(requestedBodyHtml)
        : existingPost.body_html;

      if (!nextTitle || !nextBodyHtml) {
        sendJson(res, 400, { ok: false, error: 'Title and body HTML are required.' });
        return;
      }

      const nextStatus =
        requestedStatus === 'published' || requestedStatus === 'draft'
          ? requestedStatus
          : existingPost.status;
      const nextSlug =
        regenerateSlug && requestedTitle
          ? await ensureUniqueSlug(supabase, requestedTitle, existingPost.id)
          : existingPost.slug;

      let imageUrl = existingPost.cover_image_url;
      let imagePath = existingPost.cover_image_path;

      const imageFile = getFileFromForm(files, 'image');
      if (imageFile) {
        const uploadedImage = await saveBlogImage(imageFile, nextSlug || nextTitle);
        imageUrl = uploadedImage.image_url;
        imagePath = uploadedImage.image_path;
        if (existingPost.cover_image_path) {
          await removeBlogImage(existingPost.cover_image_path).catch(() => {});
        }
      } else if (removeImage && existingPost.cover_image_path) {
        await removeBlogImage(existingPost.cover_image_path).catch(() => {});
        imageUrl = null;
        imagePath = null;
      }

      const updatePayload = {
        slug: nextSlug,
        title: nextTitle,
        excerpt: requestedExcerpt || createExcerpt(nextBodyHtml),
        body_html: nextBodyHtml,
        cover_image_url: imageUrl,
        cover_image_path: imagePath,
        image_alt: requestedImageAlt || existingPost.image_alt,
        author_name: requestedAuthor,
        status: nextStatus,
        published_at:
          nextStatus === 'published'
            ? existingPost.published_at || new Date().toISOString()
            : null
      };

      const { data, error } = await supabase
        .from('blog_posts')
        .update(updatePayload)
        .eq('id', id)
        .select(
          'id, slug, title, excerpt, body_html, cover_image_url, cover_image_path, image_alt, author_name, status, published_at, created_at, updated_at'
        )
        .single();

      if (error) {
        throw error;
      }

      sendJson(res, 200, {
        ok: true,
        post: normalizePost(data)
      });
      return;
    }

    if (req.method === 'DELETE') {
      if (!requireAllowedOrigin(req, res)) {
        return;
      }

      if (!requireAdminSession(req, res)) {
        return;
      }

      const body = await readJsonBody(req);
      const url = getRequestUrl(req);
      const id = String(body.id || url.searchParams.get('id') || '').trim();

      if (!id) {
        sendJson(res, 400, { ok: false, error: 'Post id is required.' });
        return;
      }

      const supabase = getSupabaseAdmin();
      const existingPost = await getExistingPost(supabase, id);
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) {
        throw error;
      }

      if (existingPost.cover_image_path) {
        await removeBlogImage(existingPost.cover_image_path).catch(() => {});
      }

      sendJson(res, 200, { ok: true });
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
