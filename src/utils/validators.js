// FILE: src/utils/validators.js
import Joi from "joi";

/**
 * Username validation
 * - 3 to 30 chars
 * - letters, numbers, underscores only
 */
export const usernameSchema = Joi.string()
  .pattern(/^[a-zA-Z0-9_]{3,30}$/)
  .required()
  .messages({
    "string.empty": "Username is required",
    "string.pattern.base":
      "Username can only contain letters, numbers, and underscores (3–30 chars)",
    "any.required": "Username is required",
  });

/**
 * Password validation
 * - at least 8 characters
 * - must contain uppercase, lowercase, number, special char
 */
export const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/)
  .required()
  .messages({
    "string.base": "Password must be a string",
    "string.empty": "Password is required",
    "string.min": "Password must be at least 8 characters",
    "string.pattern.base":
      "Password must include uppercase, lowercase, number, and special character",
    "any.required": "Password is required",
  });

/**
 * Phone validation for India
 * - Must be exactly 10 digits
 * - Must start with 6, 7, 8, or 9
 * - Allows optional +91 or 91 prefix
 */
export const phoneSchema = Joi.string()
  .pattern(/^(?:\+91|91)?[6-9]\d{9}$/)
  .messages({
    "string.pattern.base":
      "Phone number must be a valid Indian mobile number (10 digits, starting with 6-9, e.g., 9876543210 or +919876543210)",
  });

/**
 * Address validation
 */
export const addressSchema = Joi.object({
  street: Joi.string().min(3).max(100).required().messages({
    "string.empty": "Street is required",
    "string.min": "Street must be at least 3 characters",
  }),
  city: Joi.string().min(2).max(50).required().messages({
    "string.empty": "City is required",
    "string.min": "City must be at least 2 characters",
  }),
  state: Joi.string().min(2).max(50).required().messages({
    "string.empty": "State is required",
  }),
  postalCode: Joi.string().pattern(/^\d{6}$/).required().messages({
    "string.pattern.base": "Postal code must be exactly 6 digits",
    "string.empty": "Postal code is required",
  }),
  country: Joi.string().min(2).max(50).required().messages({
    "string.empty": "Country is required",
  }),
});

/**
 * Profile update schema
 * - All fields optional, but validated if provided
 */
export const profileUpdateSchema = Joi.object({
  username: usernameSchema.optional(),
  password: passwordSchema.optional(),
  phone: phoneSchema.optional(),
  email: Joi.string().email().optional().messages({
    "string.email": "Email must be a valid email address",
  }),
  address: addressSchema.optional(),
});
