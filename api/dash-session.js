const { getAdminSession, sendJson } = require('./_lib/blog');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
      return;
    }

    const session = getAdminSession(req);
    if (!session) {
      sendJson(res, 200, { ok: true, authenticated: false });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      authenticated: true,
      user: {
        username: session.u
      }
    });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || 'Unexpected error.'
    });
  }
};
