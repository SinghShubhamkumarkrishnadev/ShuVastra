import express from "express";
import { login, verifyOtp, resendOtp } from "../controllers/adminAuthController.js";
import { authLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

/**
 * Admin Authentication Routes
 * Note: Admin is seeded manually, so no register endpoint
 */
router.post("/login", authLimiter, login);           // Step 1: email+password
router.post("/verify-otp", authLimiter, verifyOtp);  // Step 2: OTP verification
router.post("/resend-otp", authLimiter, resendOtp);

export default router;
