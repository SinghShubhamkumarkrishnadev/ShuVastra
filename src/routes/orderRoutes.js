// src/routes/orderRoutes.js
import express from "express";
import {
  placeOrder,
  getUserOrders,
  getOrderById,
  adminListOrders,
  updateOrderStatus,
  cancelOrder,
} from "../controllers/orderController.js";

import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * User routes — requires logged-in user role
 */
router.use(authMiddleware(["user", "admin"])); // both user and admin can place orders (admin for testing)

/**
 * POST /api/auth/orders  -> place an order (from cart)
 */
router.post("/", placeOrder);

/**
 * GET /api/auth/orders -> list orders for current user (admin can see all by using admin endpoint)
 */
router.get("/", getUserOrders);

/**
 * GET /api/auth/orders/:orderId -> get details
 */
router.get("/:orderId", getOrderById);

/**
 * POST /api/auth/orders/:orderId/cancel -> cancel (user or admin)
 */
router.post("/:orderId/cancel", cancelOrder);

/**
 * Admin-only routes
 * NOTE: keep admin endpoints under same router; restrict to admin role for these routes
 */
router.get("/admin/all", authMiddleware(["admin"]), adminListOrders); // list all orders (admin)
router.put("/:orderId/status", authMiddleware(["admin"]), updateOrderStatus); // admin update status

export default router;
