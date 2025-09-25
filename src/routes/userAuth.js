import express from "express";
import { register, verifyOtp, resendOtp, login, getProfile, updateProfile } from "../controllers/userAuthController.js";
import { authLimiter } from "../middlewares/rateLimit.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * User Authentication Routes
 */
router.post("/register", register);
router.post("/verify-otp", authLimiter, verifyOtp);
router.post("/resend-otp", authLimiter, resendOtp);
router.post("/login", authLimiter, login);

/**
 * User Profile Routes
 */
router.get("/profile", authMiddleware(["user"]), getProfile);
router.put("/profile", authMiddleware(["user"]), updateProfile);

export default router;
