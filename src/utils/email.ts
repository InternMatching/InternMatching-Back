import nodemailer from "nodemailer";

export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;

  console.log(`[Email] Configuring transporter: smtp.gmail.com:587 (Forcing IPv4)`);

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: user,
      pass: pass,
    },
    // CRITICAL: Force IPv4. Render's IPv6 routing often causes timeouts.
    // @ts-ignore - family is a valid SMTP option but sometimes missing in older type definitions
    family: 4,
    // Add timeouts to prevent hanging connections
    connectionTimeout: 15000, // 15 seconds
    greetingTimeout: 15000,
    socketTimeout: 30000, // 30 seconds
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false,
      // Ensure we use the correct server name for SNI
      servername: "smtp.gmail.com"
    },
    // Additional debug logging
    logger: true,
    debug: true,
  } as any);

  // Verify connection configuration
  try {
    console.log("[Email] Verifying connection (IPv4-only)...");
    await transporter.verify();
    console.log("[Email] SMTP Server is ready");
  } catch (err) {
    console.error("[Email] Verification failed:", err);
    throw new Error(`Connection timeout: Make sure EMAIL_PORT=587 is set in Render. Error: ${err instanceof Error ? err.message : String(err)}`);
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
