// src/middlewares/authMiddleware.js
import { verifyToken } from "../utils/token.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

/**
 * Verify JWT token and attach user/admin to req.user
 * @param {Array} roles - Allowed roles, e.g. ["user"], ["admin"], ["user", "admin"]
 */
export const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (err) {
        return res.status(401).json({ message: "Please login first." });
      }

      let entity = null;
      if (decoded.role === "user") {
        entity = await User.findById(decoded.id);
      } else if (decoded.role === "admin") {
        entity = await Admin.findById(decoded.id);
      }

      if (!entity) {
        return res.status(401).json({ message: "Account not found" });
      }

      // If specific roles are required
      if (roles.length && !roles.includes(decoded.role)) {
        return res
          .status(403)
          .json({ message: "Forbidden: insufficient role" });
      }

      req.user = entity;
      req.userRole = decoded.role; // attach role explicitly for clarity
      next();
    } catch (err) {
      console.error("Auth error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  };
};
