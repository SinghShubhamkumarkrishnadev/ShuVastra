// src/utils/otpHelper.js
import Otp from "../models/Otp.js";
import argon2 from "argon2";
import { generateOtp } from "./generateOtp.js";
import { sendEmail } from "./sendEmail.js";
import { generateOtpEmailTemplate } from "./emailTemplates.js";

const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 5;

/**
 * Generate or resend OTP
 */
export const createOrResendOtp = async ({
  email,
  purpose,
  username = "User",
  sendMail = true,
}) => {
  if (!email || !purpose) throw new Error("Email and purpose are required");

  let otpDoc = await Otp.findOne({ targetEmail: email, purpose });

  // If blocked due to too many invalid attempts
  if (otpDoc && otpDoc.attempts >= MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: otpDoc._id });
    return { blocked: true, attemptsLeft: 0, resendsLeft: 0 };
  }

  // If blocked due to too many resends
  if (otpDoc && otpDoc.resendCount >= MAX_RESENDS) {
    await Otp.deleteOne({ _id: otpDoc._id });
    return { blocked: true, attemptsLeft: MAX_ATTEMPTS, resendsLeft: 0 };
  }

  const otp = generateOtp();
  const hashedOtp = await argon2.hash(otp);

  if (otpDoc) {
    otpDoc.hashedOtp = hashedOtp;
    otpDoc.expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // increment resend counter
    otpDoc.resendCount += 1;
    await otpDoc.save();
  } else {
    otpDoc = await Otp.create({
      targetEmail: email,
      hashedOtp,
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });
  }

  if (sendMail) {
    const { subject, html } = generateOtpEmailTemplate({
      username,
      otp,
      purpose,
    });
    await sendEmail(email, subject, html);
  }

  const attemptsLeft = MAX_ATTEMPTS - (otpDoc.attempts || 0);
  const resendsLeft = MAX_RESENDS - (otpDoc.resendCount || 0);

  return { otpDoc, otp, attemptsLeft, resendsLeft, blocked: false };
};

/**
 * Verify OTP and increment attempts if invalid
 */
export const verifyOtpHelper = async ({ email, otp, purpose }) => {
  const otpDoc = await Otp.findOne({ targetEmail: email, purpose });
  if (!otpDoc) return { valid: false, attemptsLeft: 0, blocked: false };

  const valid = await argon2.verify(otpDoc.hashedOtp, otp);

  if (!valid) {
    otpDoc.attempts += 1;
    await otpDoc.save();

    const attemptsLeft = MAX_ATTEMPTS - otpDoc.attempts;
    if (otpDoc.attempts >= MAX_ATTEMPTS) {
      await Otp.deleteOne({ _id: otpDoc._id });
      return { valid: false, attemptsLeft: 0, blocked: true };
    }

    return { valid: false, attemptsLeft, blocked: false };
  }

  // OTP valid -> clear all OTPs for this email/purpose
  await Otp.deleteMany({ targetEmail: email, purpose });
  return { valid: true, attemptsLeft: MAX_ATTEMPTS, blocked: false };
};
