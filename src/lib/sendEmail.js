import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = process.env.SMTP_PORT || process.env.EMAIL_PORT;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const fromEmail = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'no-reply@polyattend.com';
  const fromName = process.env.FROM_NAME || 'PolyAttend';

  const isPlaceholderUser = !user || user.includes('your-email') || pass?.includes('your-app-password');
  const hasSmtpConfig = host && port && user && pass && !isPlaceholderUser;

  if (!hasSmtpConfig) {
    console.log('\n=========================================');
    console.log(`✉️  EMAIL SIMULATION (SMTP Not Configured)`);
    console.log(`To:      ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message:\n${options.message}`);
    console.log('=========================================\n');
    return { success: true, simulated: true };
  }

  const transporter = nodemailer.createTransport({
    host,
    port: parseInt(port),
    secure: parseInt(port) === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || `<p>${options.message}</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️  Email sent successfully: ${info?.messageId || 'SMTP accepted the message'}`);
    return { success: true, info };
  } catch (error) {
    console.error('❌ Error sending email via SMTP:', error);
    console.log('\n=========================================');
    console.log(`✉️  EMAIL FALLBACK LOG (SMTP Failed)`);
    console.log(`To:      ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message:\n${options.message}`);
    console.log('=========================================\n');

    // Critical flows (registration/invites/OTP) must not report success when
    // SMTP delivery failed. The original error is logged above, while callers
    // receive a safe message that is suitable for the UI.
    const deliveryError = new Error('Email could not be sent. Check the mail configuration or try again shortly.');
    deliveryError.cause = error;
    throw deliveryError;
  }
};

export default sendEmail;
