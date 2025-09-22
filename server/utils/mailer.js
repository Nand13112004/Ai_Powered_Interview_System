const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function sendVerificationEmail(to, code) {
  const brandName = 'MockMate AI';
  const subject = `Verify your email for ${brandName}`;
  const previewText = `Your ${brandName} verification code is ${code}`;
  const html = `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
    <style>
      /* Tailored for email clients */
      body { margin:0; padding:0; background:#f6f8fb; color:#1f2937; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
      .container { max-width: 560px; margin: 0 auto; padding: 24px 16px; }
      .card { background:#ffffff; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.12); overflow:hidden; }
      .header { padding: 20px 24px; border-bottom:1px solid #eef2f7; text-align:center; background: linear-gradient(135deg, #eff6ff 0%, #ffffff 40%, #f5f3ff 100%); }
      .brand { display:inline-flex; align-items:center; gap:10px; font-weight:700; color:#111827; font-size:20px; }
      .logo { width:28px; height:28px; border-radius:6px; background:#2563eb; display:inline-block; position:relative; }
      .logo::after { content:''; position:absolute; inset:6px; background:#93c5fd; border-radius:4px; }
      .content { padding: 24px; line-height:1.6; }
      .eyebrow { color:#6b7280; text-transform: uppercase; letter-spacing: .08em; font-size:12px; margin-bottom:4px; }
      h1 { margin: 0 0 8px 0; font-size:22px; color:#111827; }
      p { margin: 0 0 14px 0; }
      .code { font-size: 28px; letter-spacing: 6px; font-weight: 800; color:#111827; background:#f3f4f6; border:1px solid #e5e7eb; border-radius:10px; padding: 14px 18px; text-align:center; }
      .cta { display:inline-block; margin-top: 14px; background:#2563eb; color:#ffffff !important; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:600; }
      .meta { font-size:12px; color:#6b7280; margin-top:12px; }
      .footer { text-align:center; color:#9ca3af; font-size:12px; padding: 18px; }
      .divider { height:1px; background:#eef2f7; margin: 4px 0 16px; }
    </style>
  </head>
  <body>
    <span style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden">${previewText}</span>
    <div class="container">
      <div class="card">
        <div class="header">
          <div class="brand">
            <span class="logo"></span>
            <span>${brandName}</span>
          </div>
        </div>
        <div class="content">
          <div class="eyebrow">Email Verification</div>
          <h1>Verify your email</h1>
          <p>Thanks for signing up to <strong>${brandName}</strong>! Use the verification code below to complete your sign-in.</p>
          <div class="code">${code}</div>
          <p class="meta">This code will expire in 10 minutes. If you didn’t request this, you can safely ignore this email.</p>
          <div class="divider"></div>
          <p class="meta">Need help? Reply to this email and our team will assist you.</p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} ${brandName}. All rights reserved.
        </div>
      </div>
    </div>
  </body>
  </html>
  `;

  const mailOptions = {
    from: {
      name: brandName,
      address: process.env.GMAIL_USER
    },
    to,
    subject,
    text: `Your ${brandName} verification code is: ${code}. It expires in 10 minutes.`,
    html
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendVerificationEmail };
