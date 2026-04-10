const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { formidable } = require('formidable');
const sanitizeHtml = require('sanitize-html');

const DASH_COOKIE_NAME = 'welltech_dash_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const DEFAULT_BUCKET = 'blog-images';
const DEFAULT_AUTHOR = 'WellTechAI CIC';

function getBaseUrl(req) {
  const host = req.headers.host || 'localhost:3000';
  const proto =
    req.headers['x-forwarded-proto'] ||
    (host.includes('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function getRequestUrl(req) {
  return new URL(req.url || '/', getBaseUrl(req));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  const buffers = [];
  for await (const chunk of req) {
    buffers.push(chunk);
  }

  if (!buffers.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(buffers).toString('utf8'));
  } catch {
    return {};
  }
}

function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isLocalOrigin(origin) {
  return (
    origin === 'http://localhost:3000' ||
    origin === 'http://127.0.0.1:3000' ||
    origin === 'http://localhost:5500' ||
    origin === 'http://127.0.0.1:5500' ||
    origin === 'http://localhost:5173' ||
    origin === 'http://127.0.0.1:5173' ||
    origin === 'http://localhost:4173' ||
    origin === 'http://127.0.0.1:4173'
  );
}

function getRequestOrigin(req) {
  const origin = (req.headers.origin || '').trim().toLowerCase();
  if (origin) {
    return origin;
  }

  const referer = (req.headers.referer || '').trim().toLowerCase();
  if (!referer) {
    return '';
  }

  try {
    return new URL(referer).origin.toLowerCase();
  } catch {
    return '';
  }
}

function isOriginAllowed(req) {
  const allowedOrigins = getAllowedOrigins();

  const requestOrigin = getRequestOrigin(req);
  if (!requestOrigin) {
    return false;
  }

  if (isLocalOrigin(requestOrigin)) {
    return true;
  }

  return allowedOrigins.includes(requestOrigin);
}

function requireAllowedOrigin(req, res) {
  if (isOriginAllowed(req)) {
    return true;
  }

  sendJson(res, 403, { ok: false, error: 'Forbidden origin.' });
  return false;
}

function requireSupabaseEnv() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (key) => !process.env[key]
  );

  if (missing.length) {
    const error = new Error(`Missing env vars: ${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
}

function getSupabaseAdmin() {
  requireSupabaseEnv();

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function createExcerpt(html, maxLength) {
  const text = sanitizeHtml(String(html || ''), {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return '';
  }

  const limit = Number(maxLength) || 180;
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit).trimEnd()}...`;
}

function sanitizeBlogHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: [
      'a',
      'blockquote',
      'br',
      'code',
      'em',
      'figcaption',
      'figure',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'img',
      'li',
      'ol',
      'p',
      'pre',
      'strong',
      'table',
      'tbody',
      'td',
      'th',
      'thead',
      'tr',
      'ul'
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        target: '_blank'
      })
    }
  }).trim();
}

function estimateReadTime(html) {
  const text = sanitizeHtml(String(html || ''), {
    allowedTags: [],
    allowedAttributes: {}
  })
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return 1;
  }

  return Math.max(1, Math.ceil(text.split(' ').length / 220));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index < 0) return acc;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
}

function getSessionSecret() {
  if (!process.env.DASH_SESSION_SECRET) {
    const error = new Error('Missing env vars: DASH_SESSION_SECRET');
    error.statusCode = 500;
    throw error;
  }
  return process.env.DASH_SESSION_SECRET;
}

function signValue(value) {
  return crypto
    .createHmac('sha256', getSessionSecret())
    .update(value)
    .digest('base64url');
}

function createSessionToken(username) {
  const payload = {
    u: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split('.');
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(providedSignature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    );

    if (!payload || !payload.u || !payload.exp) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function shouldUseSecureCookies(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const host = req.headers.host || '';
  if (forwardedProto === 'https') {
    return true;
  }
  return !host.includes('localhost') && !host.startsWith('127.0.0.1');
}

function appendSetCookie(res, cookieValue) {
  const current = res.getHeader('Set-Cookie');
  if (!current) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }

  const values = Array.isArray(current) ? current.concat(cookieValue) : [current, cookieValue];
  res.setHeader('Set-Cookie', values);
}

function setSessionCookie(req, res, username) {
  const secureFlag = shouldUseSecureCookies(req) ? '; Secure' : '';
  const token = createSessionToken(username);

  appendSetCookie(
    res,
    `${DASH_COOKIE_NAME}=${encodeURIComponent(
      token
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secureFlag}`
  );
}

function clearSessionCookie(req, res) {
  const secureFlag = shouldUseSecureCookies(req) ? '; Secure' : '';
  appendSetCookie(
    res,
    `${DASH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`
  );
}

function getAdminSession(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[DASH_COOKIE_NAME]);
}

function requireAdminSession(req, res) {
  const session = getAdminSession(req);
  if (!session) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    return null;
  }
  return session;
}

function toSingleValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      allowEmptyFiles: false,
      maxFiles: 1,
      maxFileSize: 8 * 1024 * 1024
    });

    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ fields, files });
    });
  });
}

function getFileFromForm(files, key) {
  const file = files[key];
  if (!file) return null;
  return Array.isArray(file) ? file[0] : file;
}

function getExtensionFromFile(file) {
  const originalExtension = path.extname(file.originalFilename || '').toLowerCase();
  if (originalExtension) {
    return originalExtension;
  }

  const mimeType = String(file.mimetype || '').toLowerCase();
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return '.jpg';
  return '.bin';
}

function getImageStorageMode() {
  return (process.env.BLOG_IMAGE_STORAGE || 'supabase').trim().toLowerCase();
}

async function uploadImageToFilesystem(file, fileName) {
  const targetDir = path.join(process.cwd(), 'public', 'blog-images');
  await fs.mkdir(targetDir, { recursive: true });

  const savedFileName = `${fileName}${getExtensionFromFile(file)}`;
  const targetPath = path.join(targetDir, savedFileName);
  await fs.copyFile(file.filepath, targetPath);

  return {
    image_url: `/public/blog-images/${savedFileName}`.replace('/public', ''),
    image_path: `public/blog-images/${savedFileName}`
  };
}

async function uploadImageToSupabase(file, fileName) {
  const supabase = getSupabaseAdmin();
  const bucket = process.env.SUPABASE_BLOG_IMAGE_BUCKET || DEFAULT_BUCKET;
  const date = new Date();
  const relativePath = [
    'blog',
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    `${fileName}${getExtensionFromFile(file)}`
  ].join('/');

  const buffer = await fs.readFile(file.filepath);
  const { error } = await supabase.storage.from(bucket).upload(relativePath, buffer, {
    contentType: file.mimetype || 'application/octet-stream',
    upsert: false
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(relativePath);
  return {
    image_url: data.publicUrl,
    image_path: relativePath
  };
}

async function saveBlogImage(file, slugBase) {
  if (!file) {
    return { image_url: null, image_path: null };
  }

  if (!String(file.mimetype || '').startsWith('image/')) {
    const error = new Error('Only image uploads are allowed.');
    error.statusCode = 400;
    throw error;
  }

  const safeBase = slugify(slugBase) || `post-${Date.now()}`;
  const uniqueName = `${safeBase}-${crypto.randomBytes(4).toString('hex')}`;

  if (getImageStorageMode() === 'filesystem') {
    return uploadImageToFilesystem(file, uniqueName);
  }

  return uploadImageToSupabase(file, uniqueName);
}

async function removeBlogImage(imagePath) {
  if (!imagePath) {
    return;
  }

  const storageMode = getImageStorageMode();
  if (storageMode === 'filesystem') {
    const filePath = path.join(process.cwd(), imagePath);
    await fs.rm(filePath, { force: true });
    return;
  }

  const supabase = getSupabaseAdmin();
  const bucket = process.env.SUPABASE_BLOG_IMAGE_BUCKET || DEFAULT_BUCKET;
  await supabase.storage.from(bucket).remove([imagePath]);
}

async function ensureUniqueSlug(supabase, requestedTitle, currentPostId) {
  const baseSlug = slugify(requestedTitle) || `post-${Date.now()}`;

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    let query = supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', candidate)
      .limit(1);

    if (currentPostId) {
      query = query.neq('id', currentPostId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    if (!data || !data.length) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

function normalizePost(post) {
  if (!post) return null;

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt || '',
    body_html: post.body_html || '',
    cover_image_url: post.cover_image_url || '',
    cover_image_path: post.cover_image_path || '',
    image_alt: post.image_alt || '',
    author_name: post.author_name || DEFAULT_AUTHOR,
    status: post.status || 'draft',
    created_at: post.created_at,
    updated_at: post.updated_at,
    published_at: post.published_at,
    read_time_minutes: estimateReadTime(post.body_html)
  };
}

module.exports = {
  DEFAULT_AUTHOR,
  clearSessionCookie,
  createExcerpt,
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
  setSessionCookie,
  toSingleValue,
  ensureUniqueSlug
};
