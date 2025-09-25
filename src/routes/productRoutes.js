// FILE: src/routes/productRoutes.js
import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Public Routes
 */
router.get("/", getAllProducts); // anyone can browse all products
router.get("/:id", getProductById); // anyone can view single product

/**
 * Admin-only Routes
 */
router.post("/", authMiddleware(["admin"]), createProduct);
router.put("/:id", authMiddleware(["admin"]), updateProduct);
router.delete("/:id", authMiddleware(["admin"]), deleteProduct);

export default router;
