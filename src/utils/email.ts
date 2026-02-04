import nodemailer from "nodemailer";

export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  const host = "smtp.gmail.com";
  const port = 465; // Trying SSL port 465 again with IPv4 fix

  console.log(`[Email] --- Diagnostic Info ---`);
  console.log(`[Email] Target: ${host}:${port}`);
  console.log(`[Email] User defined: ${user ? "Yes (" + user.substring(0, 3) + "...)" : "No"}`);
  console.log(`[Email] Pass defined: ${pass ? "Yes" : "No"}`);
  console.log(`[Email] Env: ${process.env.NODE_ENV}`);
  console.log(`[Email] ------------------------`);

  const transporter = nodemailer.createTransport({
    host: host,
    port: port,
    secure: true, // true for 465
    auth: {
      user: user,
      pass: pass,
    },
    // CRITICAL: Force IPv4. Render's IPv6 routing is the most common cause of timeouts.
    // @ts-ignore
    family: 4,
    // EXTENDED Timeouts for production reliability
    connectionTimeout: 30000, // 30 seconds
    greetingTimeout: 30000,
    socketTimeout: 60000, // 60 seconds
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false,
      servername: "smtp.gmail.com"
    },
    logger: true,
    debug: true,
  } as any);

  // Verify connection configuration
  try {
    console.log("[Email] Verifying connection (SSL + IPv4)...");
    await transporter.verify();
    console.log("[Email] SUCCESS: SMTP Server is ready");
  } catch (err) {
    console.error("[Email] FAILED: Connection timed out.");
    console.error("[Email] Technical details:", err);
    throw new Error(`SMTP Connection Timeout. This usually means Render's IP is being throttled or port 465/587 is blocked. Error: ${err instanceof Error ? err.message : String(err)}`);
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
