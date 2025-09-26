// src/utils/generateOtp.js
import crypto from "crypto";

/**
 * Generate a secure random numeric OTP of given length (default 6).
 * Returns a string (e.g., "482913").
 */
export const generateOtp = (length = 6) => {
  let otp = "";
  for (let i = 0; i < length; i++) {
    const random = crypto.randomInt(0, 10); // 0–9
    otp += random.toString();
  }
  return otp;
};
