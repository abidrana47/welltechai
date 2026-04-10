const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const rootDir = __dirname;
const port = Number(process.env.PORT || 3000);

const sendMailHandler = require('./api/send-mail');
const blogPostsHandler = require('./api/blog-posts');
const blogPostHandler = require('./api/blog-post');
const dashLoginHandler = require('./api/dash-login');
const dashSessionHandler = require('./api/dash-session');

app.disable('x-powered-by');

app.use(express.json({ limit: '2mb' }));

function getCorsOrigin(originHeader) {
  var origin = String(originHeader || '').trim().toLowerCase();
  var allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '')
    .split(',')
    .map(function (value) {
      return value.trim().toLowerCase();
    })
    .filter(Boolean);

  var localOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
  ];

  if (!origin) return '';
  if (localOrigins.includes(origin)) return origin;
  if (allowedOrigins.includes(origin)) return origin;
  return '';
}

app.use('/api', function apiCors(req, res, next) {
  var corsOrigin = getCorsOrigin(req.headers.origin);

  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

function runHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

app.all('/api/send-mail', runHandler(sendMailHandler));
app.all('/api/blog-posts', runHandler(blogPostsHandler));
app.all('/api/blog-post', runHandler(blogPostHandler));
app.all('/api/dash-login', runHandler(dashLoginHandler));
app.all('/api/dash-session', runHandler(dashSessionHandler));

app.use(
  express.static(rootDir, {
    extensions: ['html']
  })
);

app.get('/blog/:slug', function serveBlogPost(_req, res) {
  res.sendFile(path.join(rootDir, 'blog', '_post.html'));
});

app.use(function notFound(req, res) {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ ok: false, error: 'API route not found.' });
    return;
  }

  res.status(404).sendFile(path.join(rootDir, 'index.html'));
});

app.use(function onError(error, _req, res, _next) {
  console.error(error);

  if (res.headersSent) {
    return;
  }

  if ((_req.path || '').startsWith('/api/')) {
    res.status(error.statusCode || 500).json({
      ok: false,
      error: error.message || 'Unexpected server error.'
    });
    return;
  }

  res.status(error.statusCode || 500).send('Internal Server Error');
});

app.listen(port, function onListen() {
  console.log(`WellTechAI local server running at http://localhost:${port}`);
});
