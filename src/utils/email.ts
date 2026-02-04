import nodemailer from "nodemailer";

export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  
  const host = process.env.EMAIL_HOST || "smtp.mailtrap.io";
  const port = parseInt(process.env.EMAIL_PORT || "2525");
  const user = process.env.EMAIL_USER;

  console.log(`[Email] Configuring transporter: ${host}:${port}`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // SSL for port 465
    requireTLS: port === 587, // STARTTLS for port 587
    auth: {
      user: user,
      pass: process.env.EMAIL_PASSWORD,
    },
    // Add timeouts to prevent hanging connections
    connectionTimeout: 15000, // 15 seconds
    greetingTimeout: 15000,
    socketTimeout: 30000, // 30 seconds
    tls: {
      // Do not fail on invalid certs (helpful for cloud proxies)
      rejectUnauthorized: false,
    },
    // Additional debug logging
    logger: true,
    debug: true,
  });

  const mailOptions = {
    from: `InterMatching <${process.env.EMAIL_FROM || "noreply@intermatching.com"}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.message.replace(/\n/g, "<br>"),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
