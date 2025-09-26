/**
 * Generate OTP Email Template
 * @param {object} options
 * @param {string} options.username - Recipient name
 * @param {string} options.otp - OTP code
 * @param {string} options.purpose - Purpose of OTP (login, register, password_reset)
 * @returns {object} { subject, html }
 */
export const generateOtpEmailTemplate = ({ username = "User", otp, purpose }) => {
  let subject;
  let intro;

  switch (purpose) {
    case "login":
      subject = "Your Admin Login OTP - ShuVastra";
      intro = "We received a login request to your admin account.";
      break;
    case "password_reset":
      subject = "Reset Your Password - ShuVastra";
      intro = "We received a request to reset your account password.";
      break;
    default:
      subject = "Verify Your ShuVastra Account";
      intro = "Thank you for registering with ShuVastra!";
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; background: #fafafa;">
      <h2 style="text-align: center; color: #2F4F4F;">ShuVastra</h2>
      <p>Hi <strong>${username}</strong>,</p>
      <p>${intro}</p>
      <p>Please use the verification code below:</p>
      <h2 style="text-align: center; color: #2F4F4F; letter-spacing: 3px;">${otp}</h2>
      <p style="text-align: center; color: #888;">This code will expire in <b>5 minutes</b>. Please do not share it with anyone.</p>
      <br>
      <p>If you did not request this, you can safely ignore this email.</p>
      <br>
      <p>Best regards,<br>
      <strong>ShuVastra Team</strong></p>
    </div>
  `;

  return { subject, html };
};
