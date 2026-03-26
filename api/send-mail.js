const nodemailer = require('nodemailer');

const getBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  if (!buffers.length) return {};
  const raw = Buffer.concat(buffers).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

// List of allowed origins — set ALLOWED_ORIGINS in Vercel env as comma-separated
// e.g. ALLOWED_ORIGINS=https://welltechai.vercel.app,https://www.welltechai.co.uk
const getAllowedOrigins = () => {
  const env = process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '';
  return env
    .split(',')
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
};

const isOriginAllowed = (req) => {
  const allowedOrigins = getAllowedOrigins();

  // If no origins configured, deny everything for safety
  if (!allowedOrigins.length) return false;

  const origin = (req.headers['origin'] || '').trim().toLowerCase();
  const referer = (req.headers['referer'] || '').trim().toLowerCase();

  // Check Origin header first (set by browsers on cross-origin requests)
  if (origin) {
    return allowedOrigins.some((allowed) => origin === allowed);
  }

  // Fallback: check Referer header
  if (referer) {
    return allowedOrigins.some((allowed) => referer.startsWith(allowed));
  }

  // No Origin or Referer = direct request (Postman, curl, etc.) — block it
  return false;
};

const setCors = (res, origin) => {
  res.setHeader('Access-Control-Allow-Origin', origin || 'null');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');
};

module.exports = async (req, res) => {
  const requestOrigin = (req.headers['origin'] || '').trim();

  // Always set CORS headers so browser gets a proper response
  setCors(res, requestOrigin);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  // ── origin check ─────────────────────────────────────────────────────────
  if (!isOriginAllowed(req)) {
    console.warn('Blocked request from origin:', req.headers['origin'] || 'none');
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── env check ─────────────────────────────────────────────────────────────
  const missingEnv = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter(
    (k) => !process.env[k]
  );
  if (missingEnv.length) {
    console.error('Missing env vars:', missingEnv);
    return res.status(500).json({
      ok: false,
      error: `Server misconfiguration: missing ${missingEnv.join(', ')}`
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const {
      firstName = '',
      lastName = '',
      email = '',
      organisation = '',
      areaOfInterest = '',
      message = ''
    } = await getBody(req);

    if (!firstName || !lastName || !email) {
      res.status(400).json({ ok: false, error: 'Missing required fields.' });
      return;
    }

    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 465),
      secure: String(process.env.SMTP_SECURE || 'true') === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transport.verify();

    const subject = process.env.MAIL_SUBJECT || 'New WellTechAI Website Enquiry';
    const to = process.env.MAIL_TO || process.env.SMTP_USER;
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;

    const text = [
      'New website enquiry',
      `Name: ${firstName} ${lastName}`,
      `Email: ${email}`,
      `Organisation: ${organisation || 'N/A'}`,
      `Area of Interest: ${areaOfInterest || 'N/A'}`,
      'Message:',
      message || 'N/A'
    ].join('\n');

    const html = `
      <h2>New website enquiry</h2>
      <p><strong>Name:</strong> ${firstName} ${lastName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Organisation:</strong> ${organisation || 'N/A'}</p>
      <p><strong>Area of Interest:</strong> ${areaOfInterest || 'N/A'}</p>
      <p><strong>Message:</strong><br>${(message || 'N/A').replace(/\n/g, '<br>')}</p>
    `;

    await transport.sendMail({
      from,
      to,
      replyTo: email,
      subject,
      text,
      html
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email send failed:', {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      response: err?.response
    });

    const showError = String(process.env.SHOW_MAIL_ERRORS ?? 'true') === 'true';
    res.status(500).json({
      ok: false,
      error: showError && err?.message ? err.message : 'Email send failed.'
    });
  }
};