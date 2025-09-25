// File: src/routes/cartRoutes.js
import express from "express";
import {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart,
} from "../controllers/cartController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";


const router = express.Router();

// All cart routes require an authenticated user
router.use(authMiddleware(["user"]));

// GET /api/cart -> fetch current user's cart
router.get("/", getCart);

// POST /api/cart/items -> add item or increase quantity
router.post("/items", addToCart);

// PUT /api/cart/items/:itemId -> update item quantity (set). quantity=0 removes it
router.put("/items/:itemId", updateCartItem);

// DELETE /api/cart/items/:itemId -> remove single item
router.delete("/items/:itemId", removeFromCart);

// DELETE /api/cart -> clear entire cart
router.delete("/", clearCart);


export default router;