const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS)');
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const message = {
    from: process.env.SMTP_FROM || 'noreply@procurement.com',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  const info = await transporter.sendMail(message);

  console.log(`Email sent: ${info.messageId}`);

  if (String(host).includes('ethereal.email')) {
    const preview = nodemailer.getTestMessageUrl(info);
    if (preview) console.log(`Preview URL: ${preview}`);
  }
};

module.exports = sendEmail;
