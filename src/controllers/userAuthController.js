// src/controllers/userAuthController.js
import User from "../models/User.js";
import { generateToken } from "../utils/token.js";
import {
  usernameSchema,
  passwordSchema,
  profileUpdateSchema,
  phoneSchema,
} from "../utils/validators.js";
import Joi from "joi";
import { createOrResendOtp, verifyOtpHelper } from "../utils/otpHelper.js";

/**
 * Helper: format Mongo duplicate key error
 */
const handleDuplicateKeyError = (err, res) => {
  if (err.code === 11000) {
    if (err.keyPattern?.email) {
      return res.status(409).json({ message: "Email already in use" });
    }
    if (err.keyPattern?.phone) {
      return res.status(409).json({ message: "Phone number already in use" });
    }
    return res.status(409).json({ message: "Duplicate value error" });
  }
  return null; // means not a duplicate key error
};

/**
 * User Registration
 */
export const register = async (req, res) => {
  const { error, value } = Joi.object({
    username: usernameSchema,
    email: Joi.string().email().required().messages({
      "string.email": "A valid email is required",
      "string.empty": "Email is required",
    }),
    password: passwordSchema,
    phone: phoneSchema.required().messages({
      "string.empty": "Phone number is required",
    }),
  }).validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((err) => err.message),
    });
  }

  const { username, email, password, phone } = value;

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const user = new User({ username, email, phone, isVerified: false });
    user.password = password; // virtual setter for hashing
    await user.save();

    const { blocked, resendsLeft } = await createOrResendOtp({
      email,
      purpose: "register",
      username,
    });

    if (blocked) {
      return res.status(429).json({
        message: "Too many attempts or resends. Try again later.",
        resendsLeft,
      });
    }

    return res.status(201).json({
      message:
        "User registered successfully. Please check your email for the OTP.",
      resendsLeft,
    });
  } catch (err) {
    console.error("Register error:", err);

    if (handleDuplicateKeyError(err, res)) return;

    return res
      .status(500)
      .json({ message: "Server error during registration" });
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

    const { valid, attemptsLeft, blocked } = await verifyOtpHelper({
      email,
      otp,
      purpose: "register",
    });

    if (!valid) {
      if (blocked) {
        return res.status(429).json({
          message: "Maximum attempts reached. Please request a new OTP.",
        });
      }
      return res.status(400).json({ message: "Invalid OTP", attemptsLeft });
    }

    user.isVerified = true;
    await user.save();

    return res.json({ message: "Account verified successfully" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res
      .status(500)
      .json({ message: "Server error during OTP verification" });
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
    if (user.isVerified)
      return res.status(400).json({ message: "User already verified" });

    const { attemptsLeft, resendsLeft, blocked } = await createOrResendOtp({
      email,
      purpose: "register",
      username: user.username,
    });

    if (blocked) {
      return res.status(429).json({
        message:
          "Too many invalid attempts or OTP resends. Please try again later.",
        attemptsLeft,
        resendsLeft,
      });
    }

    return res.json({
      message: "OTP resent successfully",
      attemptsLeft,
      resendsLeft,
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    return res.status(500).json({
      message: "Server error during OTP resend",
    });
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
    if (!user.isVerified)
      return res.status(403).json({ message: "Account not verified" });

    const validPass = await user.verifyPassword(password);
    if (!validPass)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken({ id: user._id, role: "user" });
    return res.json({ message: "Login successful", token, user });
  } catch (err) {
    console.error("Login error:", err);
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
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error while fetching profile" });
  }
};

/**
 * Update Profile
 */
export const updateProfile = async (req, res) => {
  try {
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
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (username) user.username = username;
    if (phone) user.phone = phone;
    if (address) user.address = { ...user.address, ...address };
    if (password) user.password = password;

    await user.save();

    return res.json({
      message: "Profile updated successfully",
      user: user.toJSON(),
    });
  } catch (err) {
    console.error("Update profile error:", err);

    if (handleDuplicateKeyError(err, res)) return;

    res
      .status(500)
      .json({ message: "Server error while updating profile" });
  }
};
