import dotenv from "dotenv";
import { sendEmail } from "./src/utils/email.js";

dotenv.config();

console.log("Testing email sending...");
console.log("Config:", {
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  user: process.env.EMAIL_USER,
  from: process.env.EMAIL_FROM
});

try {
  await sendEmail({
    email: "test@example.com",
    subject: "Test Email",
    message: "This is a test email to verify configuration."
  });
  console.log("Test email sent successfullly!");
} catch (error) {
  console.error("Test email failed:");
  console.error(error);
}
