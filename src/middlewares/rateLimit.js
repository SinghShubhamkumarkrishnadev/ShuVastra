// src/middlewares/rateLimit.js
import rateLimit from "express-rate-limit";

/**
 * Stricter limiter for auth endpoints (login/register/otp)
 */
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // max 5 attempts
  message: { message: "Too many attempts, please try again later." },
});
