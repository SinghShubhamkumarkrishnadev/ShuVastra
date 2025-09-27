import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Public Routes
 */
router.get("/", getAllProducts);                // anyone can browse all products
router.get("/slug/:slug", getProductBySlug);    // get by slug (cleaner & avoids clash with id)
router.get("/:id", getProductById);             // get by MongoDB ID

/**
 * Admin-only Routes
 */
router.post("/", authMiddleware(["admin"]), createProduct);
router.put("/:id", authMiddleware(["admin"]), updateProduct);
router.delete("/:id", authMiddleware(["admin"]), deleteProduct);

export default router;
