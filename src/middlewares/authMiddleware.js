import { verifyToken } from "../utils/token.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

/**
 * Verify JWT token and attach user/admin to req.user
 */
export const authMiddleware = (roles = []) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers["authorization"];
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
      }

      const token = authHeader.split(" ")[1];
      const decoded = verifyToken(token);

      if (!decoded) {
        return res.status(401).json({ message: "Invalid or expired token" });
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
      if (roles.length && !roles.includes(entity.role)) {
        return res.status(403).json({ message: "Forbidden: insufficient role" });
      }

      req.user = entity;
      next();
    } catch (err) {
      console.error("Auth error:", err.message);
      return res.status(500).json({ message: "Server error" });
    }
  };
};
