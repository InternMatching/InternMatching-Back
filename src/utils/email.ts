import { Resend } from 'resend';

export const sendEmail = async (options: {
  email: string;
  subject: string;
  message: string;
}) => {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    console.error("[Email] RESEND_API_KEY is not defined in environment variables!");
    throw new Error("Email configuration missing: RESEND_API_KEY");
  }

  const resend = new Resend(apiKey);

  console.log(`[Email] Sending email via Resend to: ${options.email}`);

  try {
    const { data, error } = await resend.emails.send({
      from: 'InterMatching <onboarding@resend.dev>', 
      to: [options.email],
      subject: options.subject,
      text: options.message,
      html: options.message.replace(/\n/g, "<br>"),
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      throw new Error(`Email sending failed: ${error.message}`);
    }

    console.log("[Email] Email sent successfully via Resend:", data?.id);
    return data;
  } catch (error) {
    console.error("[Email] Error sending email via Resend:", error);
    throw error;
  }
};
