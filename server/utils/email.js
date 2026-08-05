const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const message = {
    from: `${process.env.SMTP_FROM || 'noreply@procurement.com'}`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  const info = await transporter.sendMail(message);

  console.log(`Email sent: ${info.messageId}`);
  
  // Return test URL if Ethereal is used
  if (process.env.SMTP_HOST.includes('ethereal.email')) {
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }
};

module.exports = sendEmail;
