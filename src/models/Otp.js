import mongoose from "mongoose";

const { Schema, model } = mongoose;

/**
 * OTP model for both user registration and admin login.
 * - hashedOtp: store a hashed OTP (you should hash OTP before saving).
 * - purpose: 'register' for user registration OTPs, 'login' for admin login OTPs (and future password resets).
 * - attempts: count of failed verification attempts (you can lock or remove after N attempts).
 * - expiresAt: used to auto-delete the OTP document via TTL index.
 */
const OtpSchema = new Schema(
  {
    targetEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    hashedOtp: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["register", "login", "password_reset"],
      default: "register",
    },
    attempts: {
      type: Number,
      default: 0,
    },
    // optional metadata
    meta: {
      type: Schema.Types.Mixed,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

/**
 * TTL index ensures expired OTP docs are auto-deleted by MongoDB.
 * expireAfterSeconds: 0 means delete exactly at `expiresAt`.
 */
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = model("Otp", OtpSchema);
export default Otp;
