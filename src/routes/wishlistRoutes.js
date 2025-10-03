// src/routes/wishlistRoutes.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "../controllers/wishlistController.js";

const router = express.Router();

// user must be logged in
router.get("/", authMiddleware(["user", "admin"]), getWishlist);
router.post("/:productId", authMiddleware(["user", "admin"]), addToWishlist);
router.delete("/:productId", authMiddleware(["user", "admin"]), removeFromWishlist);

export default router;
