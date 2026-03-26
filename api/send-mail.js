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

const setCors = (res) => {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  // ── quick env check ──────────────────────────────────────────────────────
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

    // verify SMTP connection before attempting to send
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

    // always show real error — remove this or set SHOW_MAIL_ERRORS=false in prod
    const showError = String(process.env.SHOW_MAIL_ERRORS ?? 'true') === 'true';
    res.status(500).json({
      ok: false,
      error: showError && err?.message ? err.message : 'Email send failed.'
    });
  }
};