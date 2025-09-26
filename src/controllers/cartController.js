// File: src/controllers/cartController.js
import Joi from "joi";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

/**
 * Validation schemas
 */
const addItemSchema = Joi.object({
  productId: Joi.string().length(24).required(),
  variantId: Joi.string().length(24).optional(),
  quantity: Joi.number().integer().min(1).max(1000).default(1),
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(0).max(1000).required(),
});

/**
 * Helper: resolve price from product/variant
 */
const resolvePrice = (product, variantId) => {
  let price = Number(product.finalPrice) || Number(product.price) || 0;
  if (variantId) {
    const variant = product.variants.id(variantId);
    if (variant) {
      price = Number(variant.price) || price;
    }
  }
  return price;
};

/**
 * Helper: resolve stock from product/variant
 */
const resolveStock = (product, variantId) => {
  if (variantId) {
    const variant = product.variants.id(variantId);
    return variant ? variant.stock : 0;
  }
  return product.stock;
};

/**
 * GET /api/cart
 */
export const getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
    if (!cart) return res.json({ items: [], totalPrice: 0 });

    await cart.populate("items.product");

    const itemsWithDetails = cart.items.map((item) => {
      const obj = item.toObject();
      const product = item.product?.toObject?.() || null;

      if (item.variantId && product?.variants) {
        const variant = product.variants.find((v) =>
          v._id.equals(item.variantId)
        );
        obj.variant = variant || null;
      }

      return obj;
    });

    return res.json({
      _id: cart._id,
      user: cart.user,
      totalPrice: cart.totalPrice,
      items: itemsWithDetails,
    });
  } catch (err) {
    console.error("Get cart error:", err.message);
    return res.status(500).json({ message: "Server error while fetching cart" });
  }
};

/**
 * POST /api/cart/items
 */
export const addToCart = async (req, res) => {
  const { error, value } = addItemSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((d) => d.message),
    });
  }

  const { productId, variantId, quantity } = value;

  try {
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const stock = resolveStock(product, variantId);
    if (quantity > stock) {
      return res.status(400).json({ message: "Insufficient stock available" });
    }

    const price = resolvePrice(product, variantId);

    let cart = await Cart.getOrCreate(req.user._id);

    const idx = cart.items.findIndex(
      (i) =>
        i.product.toString() === productId &&
        String(i.variantId || "") === String(variantId || "")
    );

    if (idx > -1) {
      const newQty = cart.items[idx].quantity + quantity;
      if (newQty > stock) {
        return res.status(400).json({ message: "Insufficient stock for this variant" });
      }
      cart.items[idx].quantity = newQty;
      cart.items[idx].price = price;
    } else {
      cart.items.push({ product: product._id, variantId, quantity, price });
    }

    await cart.save();
    await cart.populate("items.product");

    return res.json({ message: "Item added/updated in cart", cart });
  } catch (err) {
    console.error("Add to cart error:", err.message);
    return res.status(500).json({ message: "Server error while adding to cart" });
  }
};

/**
 * PUT /api/cart/items/:itemId
 */
export const updateCartItem = async (req, res) => {
  const { itemId } = req.params;
  const { error, value } = updateItemSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      message: "Validation failed",
      errors: error.details.map((d) => d.message),
    });
  }

  const { quantity } = value;

  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found in cart" });

    if (quantity === 0) {
      item.remove();
    } else {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ message: "Product not found" });

      const stock = resolveStock(product, item.variantId);
      if (quantity > stock) {
        return res.status(400).json({ message: "Insufficient stock available" });
      }

      item.quantity = quantity;
      item.price = resolvePrice(product, item.variantId);
    }

    await cart.save();
    await cart.populate("items.product");

    return res.json({ message: "Cart updated", cart });
  } catch (err) {
    console.error("Update cart item error:", err.message);
    return res.status(500).json({ message: "Server error while updating cart item" });
  }
};

/**
 * DELETE /api/cart/items/:itemId
 */
export const removeFromCart = async (req, res) => {
  const { itemId } = req.params;
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.items.id(itemId);
    if (!item) return res.status(404).json({ message: "Item not found in cart" });

    item.remove();
    await cart.save();
    await cart.populate("items.product");

    return res.json({ message: "Item removed from cart", cart });
  } catch (err) {
    console.error("Remove from cart error:", err.message);
    return res.status(500).json({ message: "Server error while removing item from cart" });
  }
};

/**
 * DELETE /api/cart -> clear cart
 */
export const clearCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.json({ message: "Cart is already empty" });

    cart.items = [];
    await cart.save();

    return res.json({ message: "Cart cleared", cart });
  } catch (err) {
    console.error("Clear cart error:", err.message);
    return res.status(500).json({ message: "Server error while clearing cart" });
  }
};
