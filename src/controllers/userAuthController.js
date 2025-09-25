import User from "../models/User.js";
import Otp from "../models/Otp.js";
import { generateOtp } from "../utils/generateOtp.js";
import { sendEmail } from "../utils/sendEmail.js";
import { generateToken } from "../utils/token.js";
import {
  usernameSchema,
  passwordSchema,
  profileUpdateSchema,
} from "../utils/validators.js";
import argon2 from "argon2";
import Joi from "joi";

/**
 * Helper: Send OTP email with proper formatting
 */
const sendOtpEmail = async (email, username, otp) => {
  if (!email || !username || !otp)
    throw new Error("Missing parameters for sending OTP email");

  const htmlContent = `
    <p>Hi ${username},</p>

    <p>Thank you for registering on <strong>ShuVastra</strong>! To complete your registration, please use the verification code below:</p>

    <h2 style="color: #2F4F4F;">${otp}</h2>

    <p>This code will expire in 5 minutes. Please do not share it with anyone.</p>

    <p>If you did not create an account with us, please ignore this email.</p>

    <br>
    <p>Best regards,<br>
    ShuVastra Team</p>
  `;

  try {
    await sendEmail(email, "Verify your ShuVastra Account", htmlContent);
  } catch (err) {
    console.error("Email sending failed:", err.message);
    throw new Error("Failed to send verification email");
  }
};

/**
 * User Registration
 */
export const register = async (req, res) => {
  // Validate input
  const { error, value } = Joi.object({
    username: usernameSchema,
    email: Joi.string().email().required().messages({
      "string.email": "A valid email is required",
      "string.empty": "Email is required",
    }),
    password: passwordSchema,
  }).validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((err) => err.message),
    });
  }

  const { username, email, password } = value;

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const user = new User({
      username,
      email,
      isVerified: false,
    });
    user.password = password; // virtual setter for hashing
    await user.save();

    const otp = generateOtp();
    const hashedOtp = await argon2.hash(otp);

    await Otp.create({
      targetEmail: email,
      hashedOtp,
      purpose: "register",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOtpEmail(email, username, otp);

    return res.status(201).json({
      message:
        "User registered successfully. Please check your email for the OTP.",
    });
  } catch (err) {
    console.error("Register error:", err.message);
    return res
      .status(500)
      .json({ message: err.message || "Server error during registration" });
  }
};

/**
 * Verify OTP
 */
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp)
    return res.status(400).json({ message: "Email and OTP are required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otpDoc = await Otp.findOne({ targetEmail: email, purpose: "register" });
    if (!otpDoc) return res.status(404).json({ message: "OTP not found or expired" });

    const isValid = await argon2.verify(otpDoc.hashedOtp, otp);
    if (!isValid) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.isVerified = true;
    await user.save();
    await Otp.deleteMany({ targetEmail: email, purpose: "register" });

    return res.json({ message: "Account verified successfully" });
  } catch (err) {
    console.error("Verify OTP error:", err.message);
    return res.status(500).json({ message: "Server error during OTP verification" });
  }
};

/**
 * Resend OTP
 */
export const resendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "User already verified" });

    await Otp.deleteMany({ targetEmail: email, purpose: "register" });

    const otp = generateOtp();
    const hashedOtp = await argon2.hash(otp);

    await Otp.create({
      targetEmail: email,
      hashedOtp,
      purpose: "register",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    await sendOtpEmail(email, user.username, otp);

    return res.json({ message: "OTP resent successfully" });
  } catch (err) {
    console.error("Resend OTP error:", err.message);
    return res.status(500).json({ message: err.message || "Server error during OTP resend" });
  }
};

/**
 * User Login
 */
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res
      .status(400)
      .json({ message: "Email and password are required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.isVerified) return res.status(403).json({ message: "Account not verified" });

    const validPass = await user.verifyPassword(password);
    if (!validPass) return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken({ id: user._id, role: "user" });

    return res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error during login" });
  }
};

/**
 * Get Profile
 */
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    console.error("Get profile error:", err.message);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
};

/**
 * Update Profile (secure)
 */
export const updateProfile = async (req, res) => {
  try {
    // Validate with central schema
    const { error, value } = profileUpdateSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.details.map((err) => err.message),
      });
    }

    const { username, password, phone, address } = value;

    // Fetch the logged-in user
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update allowed fields
    if (username) user.username = username;
    if (phone) user.phone = phone;
    if (address) {
      user.address = {
        ...user.address,
        ...address, // partial update supported
      };
    }
    if (password) {
      user.password = password; // hashed via pre-save hook
    }

    await user.save();

    return res.json({
      message: "Profile updated successfully",
      user: user.toJSON(),
    });
  } catch (err) {
    console.error("Update profile error:", err.message);
    res
      .status(500)
      .json({ message: "Server error while updating profile" });
  }
};
