// File: src/controllers/cartController.js
import Joi from "joi";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

/**
 * Validation schemas
 */
const addItemSchema = Joi.object({
    productId: Joi.string().length(24).required().messages({
        "string.length": "productId must be a 24-char ObjectId",
    }),
    variantId: Joi.string().length(24).optional(),
    quantity: Joi.number().integer().min(1).max(1000).default(1),
});

const updateItemSchema = Joi.object({
    quantity: Joi.number().integer().min(0).max(1000).required(),
});

/**
 * GET /api/cart
 */
export const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product");
    if (!cart) return res.json({ items: [], totalPrice: 0 });

    // Manually expand variant details
    const itemsWithVariant = cart.items.map((item) => {
      const obj = item.toObject();
      if (obj.variant) {
        // find matching variant inside the populated product
        const variantDetails = item.product?.variants?.find((v) =>
          v._id.equals(obj.variant)
        );
        obj.variant = variantDetails || null;
      }
      return obj;
    });

    return res.json({
      _id: cart._id,
      user: cart.user,
      totalPrice: cart.totalPrice,
      items: itemsWithVariant,
    });
  } catch (err) {
    console.error("Get cart error:", err.message);
    return res
      .status(500)
      .json({ message: "Server error while fetching cart" });
  }
};


/**
 * POST /api/cart/items
 * body: { productId, quantity }
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

    // resolve price
    let price = Number(product.finalPrice) || Number(product.price) || 0;
    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!variant) return res.status(404).json({ message: "Variant not found" });
      price = Number(variant.price) || price;
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    // check if product+variant already exists in cart
    const idx = cart.items.findIndex(
      (i) =>
        i.product.toString() === productId &&
        String(i.variantId || "") === String(variantId || "")
    );

    if (idx > -1) {
      cart.items[idx].quantity += quantity;
      cart.items[idx].price = price; // refresh snapshot
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
 * body: { quantity }
 */
// --- updateCartItem ---
export const updateCartItem = async (req, res) => {
  const { itemId } = req.params;
  const { error, value } = updateItemSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({ message: "Validation failed", errors: error.details.map((d) => d.message) });
  }

  const { quantity } = value;

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const itemIndex = cart.items.findIndex((it) => it._id.toString() === itemId);
    if (itemIndex === -1) return res.status(404).json({ message: "Item not found in cart" });

    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = quantity;

      // refresh price
      const prod = await Product.findById(cart.items[itemIndex].product);
      if (prod) {
        let price = Number(prod.finalPrice) || Number(prod.price) || cart.items[itemIndex].price;
        if (cart.items[itemIndex].variantId) {
          const variant = prod.variants.id(cart.items[itemIndex].variantId);
          if (variant) price = Number(variant.price) || price;
        }
        cart.items[itemIndex].price = price;
      }
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
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.status(404).json({ message: "Cart not found" });

        const itemIndex = cart.items.findIndex(it => it._id.toString() === itemId);
        if (itemIndex === -1) return res.status(404).json({ message: "Item not found in cart" });

        cart.items.splice(itemIndex, 1);
        await cart.save();
        await cart.populate("items.product");

        return res.json({ message: "Item removed from cart", cart });
    } catch (err) {
        console.error("Remove from cart error:", err.message);
        return res.status(500).json({ message: "Server error while removing item from cart" });
    }
};

/**
 * DELETE /api/cart  -> clear cart
 */
export const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) return res.json({ message: "Cart is already empty" });

        cart.items = [];
        await cart.save();

        return res.json({ message: "Cart cleared", cart });
    } catch (err) {
        console.error("Clear cart error:", err.message);
        return res.status(500).json({ message: "Server error while clearing cart" });
    }
};

