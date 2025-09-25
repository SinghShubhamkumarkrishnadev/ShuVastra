import Admin from "../models/Admin.js";
import Otp from "../models/Otp.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendEmail } from "../utils/sendEmail.js";
import { generateToken } from "../utils/token.js";
import argon2 from "argon2";
import Joi from "joi";

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
 * Admin Login Step 1: email + password
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

    // Remove old login OTPs
    await Otp.deleteMany({ targetEmail: email, purpose: "login" });

    // Generate OTP
    const otp = generateOtp();
    const hashedOtp = await argon2.hash(otp);

    await Otp.create({
      targetEmail: email,
      hashedOtp,
      purpose: "login",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendEmail(
      email,
      "Admin Login OTP",
      `<p>Your login OTP: <b>${otp}</b></p>`
    );

    res.json({ message: "OTP sent to admin email. Please verify." });
  } catch (err) {
    console.error("Admin login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Admin Login Step 2: verify OTP
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const otpDoc = await Otp.findOne({ targetEmail: email, purpose: "login" });
    if (!otpDoc) return res.status(400).json({ message: "OTP not found or expired" });

    const valid = await argon2.verify(otpDoc.hashedOtp, otp);
    if (!valid) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await Otp.deleteMany({ targetEmail: email, purpose: "login" });

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

    await Otp.deleteMany({ targetEmail: email, purpose: "login" });

    const otp = generateOtp();
    const hashedOtp = await argon2.hash(otp);

    await Otp.create({
      targetEmail: email,
      hashedOtp,
      purpose: "login",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendEmail(email, "Resend Admin OTP", `<p>Your new OTP: <b>${otp}</b></p>`);

    res.json({ message: "OTP resent successfully" });
  } catch (err) {
    console.error("Resend Admin OTP error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};
