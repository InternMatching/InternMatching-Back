import nodemailer from "nodemailer";

export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  
  const host = process.env.EMAIL_HOST || "smtp.mailtrap.io";
  const port = parseInt(process.env.EMAIL_PORT || "2525");
  const user = process.env.EMAIL_USER;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // Use SSL for port 465
    auth: {
      user: user,
      pass: process.env.EMAIL_PASSWORD,
    },
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
