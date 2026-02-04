import nodemailer from "nodemailer";

export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  console.log(`[Email] Configuring transporter for Gmail service...`);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: user,
      pass: pass,
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

  // Verify connection configuration
  try {
    console.log("[Email] Verifying connection...");
    await transporter.verify();
    console.log("[Email] Server is ready to take our messages");
  } catch (err) {
    console.error("[Email] Verification failed:", err);
    throw new Error(`Connection timeout or failed: ${err instanceof Error ? err.message : String(err)}`);
  }

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
