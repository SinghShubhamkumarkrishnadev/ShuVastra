// src/controllers/orderController.js
import Joi from "joi";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

/** ===============================
 * Validation schema for placing an order
 * =============================== */
const placeOrderSchema = Joi.object({
  shippingAddress: Joi.object({
    name: Joi.string().optional(),
    phone: Joi.string().optional(),
    street: Joi.string().optional(),
    city: Joi.string().optional(),
    state: Joi.string().optional(),
    postalCode: Joi.string().optional(),
    country: Joi.string().optional(),
  }).optional(),
  billingAddress: Joi.object().optional(),
  paymentMethod: Joi.string().valid("COD").default("COD"),
  shippingMethod: Joi.string().valid("standard", "express").default("standard"),
  notes: Joi.string().max(1000).optional(),
});

/** ===============================
 * Place Order: POST /api/orders
 * =============================== */
export const placeOrder = async (req, res) => {
  const userId = req.user._id;

  const { error, value } = placeOrderSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map(d => d.message),
    });
  }

  const { shippingAddress, billingAddress, paymentMethod, shippingMethod, notes } = value;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Load cart
    const cart = await Cart.findOne({ user: userId })
      .session(session)
      .populate("items.product");
    if (!cart || !cart.items.length) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Prepare order items & validate stock
    const orderItems = [];
    for (const it of cart.items) {
      const product = await Product.findById(it.product._id).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Product ${it.product._id} not found` });
      }

      const currentStock = product.stock || 0;
      const snapshotPrice =
        Number(it.price) ||
        Number(product.finalPrice) ||
        Number(product.price) ||
        0;

      if ((it.quantity || 0) > currentStock) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Requested ${it.quantity}, available ${currentStock}`,
        });
      }

      // Snapshot line
      const lineTotal = Math.round(snapshotPrice * it.quantity * 100) / 100;
      orderItems.push({
        product: product._id,
        productName: product.name,
        size: it.size || null,
        quantity: it.quantity,
        price: snapshotPrice,
        lineTotal,
      });
    }

    // Deduct stock
    for (const it of cart.items) {
      const product = await Product.findById(it.product._id).session(session);
      product.stock = Math.max(0, (product.stock || 0) - it.quantity);
      await product.save({ session });
    }

    // Build order document
    const order = new Order({
      user: userId,
      items: orderItems,
      subTotal: 0,
      tax: 0,
      shipping: 0,
      discount: 0,
      total: 0,
      shippingAddress: shippingAddress || undefined,
      billingAddress: billingAddress || shippingAddress || undefined,
      payment: {
        method: paymentMethod,
        paid: false,
      },
      status: "pending",
      notes: notes || "",
    });

    // Fallback shipping address from user profile
    if (!order.shippingAddress) {
      const user = await User.findById(userId).session(session);
      if (user?.address) {
        order.shippingAddress = {
          name: user.username,
          phone: user.phone,
          street: user.address.street,
          city: user.address.city,
          state: user.address.state,
          postalCode: user.address.postalCode,
          country: user.address.country,
        };
      }
    }

    // Compute totals
    order.computeTotals();

    await order.save({ session });

    // Clear cart
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    const populatedOrder = await Order.findById(order._id).populate("user", "-passwordHash");
    return res.status(201).json({ message: "Order placed", order: populatedOrder });
  } catch (err) {
    console.error("Place order error:", err);
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (e) {
      console.error("Abort session error:", e);
    }
    return res.status(500).json({ message: "Server error while placing order" });
  }
};

/** ===============================
 * GET /api/orders (user’s own orders)
 * =============================== */
export const getUserOrders = async (req, res) => {
  const userId = req.user._id;
  try {
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
    return res.json({ orders });
  } catch (err) {
    console.error("Get user orders error:", err);
    return res.status(500).json({ message: "Server error while fetching orders" });
  }
};

/** ===============================
 * GET /api/orders/:orderId
 * =============================== */
export const getOrderById = async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await Order.findById(orderId).populate("user", "-passwordHash");
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (req.user.role !== "admin" && order.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to view this order" });
    }

    return res.json({ order });
  } catch (err) {
    console.error("Get order by id error:", err);
    return res.status(500).json({ message: "Server error while fetching order" });
  }
};

/** ===============================
 * ADMIN: List all orders
 * =============================== */
export const adminListOrders = async (req, res) => {
  const { status, page = 1, limit = 25 } = req.query;
  const q = {};
  if (status) q.status = status;

  try {
    const skip = (Math.max(0, Number(page) - 1)) * Number(limit);
    const orders = await Order.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("user", "-passwordHash");
    const total = await Order.countDocuments(q);
    return res.json({ orders, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error("Admin list orders error:", err);
    return res.status(500).json({ message: "Server error while listing orders" });
  }
};

/** ===============================
 * ADMIN: Update order status
 * =============================== */
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid("pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded")
    .required(),
  trackingNumber: Joi.string().optional(),
  shippingCarrier: Joi.string().optional(),
});

export const updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { error, value } = updateStatusSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ message: "Validation failed", errors: error.details.map(d => d.message) });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = value.status;
    if (value.trackingNumber) order.trackingNumber = value.trackingNumber;
    if (value.shippingCarrier) order.shippingCarrier = value.shippingCarrier;

    if (value.status === "delivered") {
      order.isPaid = order.payment.method !== "COD" ? order.isPaid : true;
      order.payment.paid = order.payment.paid || (order.payment.method !== "COD");
      order.payment.paidAt = order.payment.paidAt || new Date();
    }

    await order.save();
    return res.json({ message: "Order status updated", order });
  } catch (err) {
    console.error("Update order status error:", err);
    return res.status(500).json({ message: "Server error while updating order status" });
  }
};

/** ===============================
 * User cancel order
 * =============================== */
export const cancelOrder = async (req, res) => {
  const { orderId } = req.params;
  const userId = req.user._id;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role !== "admin" && order.user.toString() !== userId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ message: "Not authorized to cancel this order" });
    }

    if (["shipped", "out_for_delivery", "delivered", "refunded"].includes(order.status)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Cannot cancel order at this stage" });
    }

    // Restore stock
    for (const it of order.items) {
      const product = await Product.findById(it.product).session(session);
      if (!product) continue;
      product.stock = (product.stock || 0) + it.quantity;
      await product.save({ session });
    }

    order.status = "cancelled";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.json({ message: "Order cancelled", order });
  } catch (err) {
    console.error("Cancel order error:", err);
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (e) {
      console.error("Abort session error:", e);
    }
    return res.status(500).json({ message: "Server error while cancelling order" });
  }
};
