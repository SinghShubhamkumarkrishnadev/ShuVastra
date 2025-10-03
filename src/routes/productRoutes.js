// FILE: src/routes/productRoutes.js
import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  addReview,
  getReviews,
  updateReview,
  deleteReview,
  getProductSuggestions,
} from "../controllers/productController.js";
import { optionalAuth } from "../middlewares/optionalAuth.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Public Product Routes
 */
router.get("/", optionalAuth, getAllProducts);                  // list all products
router.get("/slug/:slug", optionalAuth, getProductBySlug);      // SEO-friendly slug lookup
router.get("/suggestions", optionalAuth, getProductSuggestions);
router.get("/:productId", getProductById);        // lookup by MongoDB ObjectId

/**
 * Review Routes
 */
router.get("/:productId/reviews", getReviews);    // public: read reviews

// auth required for write ops
router.post(
  "/:productId/reviews",
  authMiddleware(["user", "admin"]),
  addReview
);
router.put(
  "/:productId/reviews/:reviewId",
  authMiddleware(["user", "admin"]),
  updateReview
);
router.delete(
  "/:productId/reviews/:reviewId",
  authMiddleware(["user", "admin"]),
  deleteReview
);

/**
 * Admin-only Product Routes
 */
router.post("/", authMiddleware(["admin"]), createProduct);
router.put("/:productId", authMiddleware(["admin"]), updateProduct);
router.delete("/:productId", authMiddleware(["admin"]), deleteProduct);

export default router;
