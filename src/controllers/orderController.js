// File: src/controllers/orderController.js
import Cart from "../models/Cart.js";
import Order from "../models/Order.js";

/**
 * Create an order from the current user's cart
 * POST /api/orders
 */
export const createOrder = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const order = new Order({
      user: req.user._id,
      items: cart.items.map((it) => ({
        product: it.product._id,
        quantity: it.quantity,
        price: it.price,
      })),
      totalPrice: cart.totalPrice,
      shippingAddress: req.user.address || {},
      status: "pending",
      paymentMethod: req.body.paymentMethod || "cod",
      paymentStatus: "unpaid",
    });

    await order.save();

    // clear the cart
    cart.items = [];
    await cart.save();

    return res.status(201).json({ message: "Order created", order });
  } catch (err) {
    console.error("Create order error:", err.message);
    return res.status(500).json({ message: "Server error while creating order" });
  }
};

/**
 * Get all orders for logged-in user
 * GET /api/orders
 */
export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).populate("items.product");
    return res.json(orders);
  } catch (err) {
    console.error("Get orders error:", err.message);
    return res.status(500).json({ message: "Server error while fetching orders" });
  }
};

/**
 * Get a specific order by id
 * GET /api/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).populate("items.product");
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json(order);
  } catch (err) {
    console.error("Get order error:", err.message);
    return res.status(500).json({ message: "Server error while fetching order" });
  }
};

/**
 * Admin: update order status
 * PUT /api/orders/:id/status
 */
export const updateOrderStatus = async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "Status is required" });

  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = status;
    await order.save();

    return res.json({ message: "Order status updated", order });
  } catch (err) {
    console.error("Update order status error:", err.message);
    return res.status(500).json({ message: "Server error while updating order status" });
  }
};
