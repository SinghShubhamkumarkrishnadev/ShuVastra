// src/utils/sendEmail.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_NAME,
  SMTP_FROM_EMAIL,
} = process.env;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM_EMAIL) {
  throw new Error("❌ Missing SMTP configuration in environment variables");
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT) || 587,
  secure: SMTP_SECURE === "true", // true for 465
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

// Verify transporter at startup (async but non-blocking)
transporter.verify().then(() => {
  console.log("✅ SMTP server ready to take messages");
}).catch(err => {
  console.error("❌ SMTP configuration error:", err.message);
});

/**
 * Convert HTML to plain text (basic fallback)
 */
const htmlToText = (html) => {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
};

/**
 * Send an email with HTML + text fallback
 */
export const sendEmail = async (to, subject, html) => {
  if (!to || !subject || !html) {
    throw new Error("Missing email parameters: to, subject, or html");
  }

  try {
    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME || "ShuVastra"}" <${SMTP_FROM_EMAIL}>`,
      to,
      subject,
      html,
      text: htmlToText(html),
    });

    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`❌ Email sending failed to ${to}:`, err);
    throw new Error("Failed to send email. Please try again later.");
  }
};
