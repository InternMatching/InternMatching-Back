import nodemailer from "nodemailer";

/**
 * Send an email using nodemailer
 */
export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  // Create a transporter
  // For development, you can use Mailtrap or similar services
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.mailtrap.io",
    port: parseInt(process.env.EMAIL_PORT || "2525"),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Define email options
  const mailOptions = {
    from: `InterMatching <${process.env.EMAIL_FROM || "noreply@intermatching.com"}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.message.replace(/\n/g, "<br>"),
  };

  // Send the email
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: " + info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    // In production, you might want to throw an error
    // For now, let's just log it so the flow doesn't break if email fails in dev
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
};
