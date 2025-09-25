/**
 * Generate a random numeric OTP of given length (default 6).
 * Returns a string (e.g., "482913").
 */
export const generateOtp = (length = 6) => {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};
