// src/utils/token.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

if (!JWT_SECRET) {
  throw new Error("❌ Missing JWT_SECRET in environment variables");
}

/**
 * Generate JWT
 * @param {Object} payload - must include at least { id, role }
 * @param {string} expiresIn - custom expiration (default from .env)
 */
export const generateToken = (payload, expiresIn = JWT_EXPIRES_IN) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Verify JWT
 * @param {string} token
 * @returns decoded payload if valid
 * @throws jwt.JsonWebTokenError | jwt.TokenExpiredError
 */
export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};
