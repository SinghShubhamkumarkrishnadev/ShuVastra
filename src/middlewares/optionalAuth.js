// src/middlewares/optionalAuth.js
import { verifyToken } from "../utils/token.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";

export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = verifyToken(token);

        let entity = null;
        if (decoded.role === "user") {
          entity = await User.findById(decoded.id).select("_id wishlist");
        } else if (decoded.role === "admin") {
          entity = await Admin.findById(decoded.id).select("_id");
        }

        if (entity) {
          req.user = entity;
          req.userRole = decoded.role;
        }
      } catch {
        // ignore invalid/expired token (public route stays public)
      }
    }
    next();
  } catch (err) {
    console.error("Optional auth error:", err.message);
    next();
  }
};
