// File: src/routes/orderRoutes.js
import express from "express";
import { createOrder, getMyOrders, getOrderById, updateOrderStatus } from "../controllers/orderController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// User routes
router.post("/", authMiddleware(["user"]), createOrder);
router.get("/", authMiddleware(["user"]), getMyOrders);
router.get("/:id", authMiddleware(["user"]), getOrderById);

// Admin route to update order status
router.put("/:id/status", authMiddleware(["admin"]), updateOrderStatus);

export default router;