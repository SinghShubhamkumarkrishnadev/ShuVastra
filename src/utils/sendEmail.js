import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create reusable transporter object
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true", // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Convert HTML to plain text
 * Very simple version for fallback
 */
const htmlToText = (html) => {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
};

/**
 * Send an email with proper HTML + plain text fallback
 * @param {string} to Recipient email
 * @param {string} subject Email subject
 * @param {string} html HTML email body
 */
export const sendEmail = async (to, subject, html) => {
  if (!to || !subject || !html) {
    throw new Error("Missing email parameters: to, subject, or html");
  }

  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: htmlToText(html), // plain-text fallback
    });

    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email sending failed to ${to}:`, err.message);
    throw new Error("Failed to send email. Please try again later.");
  }
};
