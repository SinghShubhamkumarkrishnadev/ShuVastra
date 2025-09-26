// src/controllers/adminAuthController.js
import Admin from "../models/Admin.js";
import { generateToken } from "../utils/token.js";
import Joi from "joi";
import { createOrResendOtp, verifyOtpHelper } from "../utils/otpHelper.js";

/**
 * Admin Login Validation Schema
 */
const adminLoginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "A valid email is required",
    "string.empty": "Email is required",
  }),
  password: Joi.string().required().messages({
    "string.empty": "Password is required",
  }),
});

/**
 * Step 1: Admin login with email & password
 */
export const login = async (req, res) => {
  try {
    const { error, value } = adminLoginSchema.validate(req.body, {
      abortEarly: false,
    });
    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const { email, password } = value;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Invalid credentials" });

    const validPass = await admin.verifyPassword(password);
    if (!validPass)
      return res.status(400).json({ message: "Invalid credentials" });

    // Create new OTP
    const { blocked, resendsLeft } = await createOrResendOtp({
      email,
      purpose: "login",
      username: admin.name,
    });

    if (blocked) {
      return res.status(429).json({
        message: "Too many attempts or resends. Try again later.",
        resendsLeft,
      });
    }

    res.json({
      message: "OTP sent to admin email. Please verify.",
      resendsLeft,
    });
  } catch (err) {
    console.error("Admin login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Step 2: Verify Admin OTP
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const { valid, attemptsLeft, blocked } = await verifyOtpHelper({
      email,
      otp,
      purpose: "login",
    });

    if (!valid) {
      if (blocked) {
        return res.status(429).json({
          message: "Maximum attempts reached. Please request a new OTP.",
        });
      }
      return res.status(400).json({ message: "Invalid OTP", attemptsLeft });
    }

    const token = generateToken({ id: admin._id, role: "admin" });
    res.json({ message: "Admin login successful", token, admin });
  } catch (err) {
    console.error("Admin verify OTP error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Resend Admin Login OTP
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const { attemptsLeft, resendsLeft, blocked } = await createOrResendOtp({
      email,
      purpose: "login",
      username: admin.name,
    });

    if (blocked) {
      return res.status(429).json({
        message:
          "Too many invalid attempts or OTP resends. Please try again later.",
        attemptsLeft,
        resendsLeft,
      });
    }

    res.json({
      message: "OTP resent successfully",
      attemptsLeft,
      resendsLeft,
    });
  } catch (err) {
    console.error("Resend Admin OTP error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
