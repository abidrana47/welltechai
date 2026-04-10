const {
  clearSessionCookie,
  readJsonBody,
  requireAllowedOrigin,
  sendJson,
  setSessionCookie
} = require('./_lib/blog');

module.exports = async (req, res) => {
  try {
    if (req.method === 'DELETE') {
      clearSessionCookie(req, res);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
      return;
    }

    if (!requireAllowedOrigin(req, res)) {
      return;
    }

    const username = process.env.DASH_USERNAME;
    const password = process.env.DASH_PASSWORD;

    if (!username || !password) {
      sendJson(res, 500, {
        ok: false,
        error: 'Missing env vars: DASH_USERNAME, DASH_PASSWORD'
      });
      return;
    }

    const body = await readJsonBody(req);
    const inputUsername = String(body.username || '').trim();
    const inputPassword = String(body.password || '');

    if (inputUsername !== username || inputPassword !== password) {
      sendJson(res, 401, { ok: false, error: 'Invalid credentials.' });
      return;
    }

    setSessionCookie(req, res, username);
    sendJson(res, 200, {
      ok: true,
      user: { username }
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || 'Unexpected error.'
    });
  }
};
