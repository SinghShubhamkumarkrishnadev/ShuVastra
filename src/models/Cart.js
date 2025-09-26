// File: src/models/Cart.js
import mongoose from "mongoose";
import Product from "./Product.js";

const { Schema, model } = mongoose;

const CartItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId }, // references Product.variants._id
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, default: 0 }, // snapshot price
  },
  { timestamps: true }
);

const CartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [CartItemSchema],
    totalPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 🔹 Recalculate total price
CartSchema.methods.recalculate = function () {
  this.totalPrice = this.items.reduce((sum, it) => {
    const itemTotal = (Number(it.price) || 0) * (Number(it.quantity) || 0);
    return sum + itemTotal;
  }, 0);
};

// 🔹 Auto recalc on save
CartSchema.pre("save", function (next) {
  this.recalculate();
  next();
});

// 🔹 Cleanup invalid cart items (deleted product/variant)
CartSchema.methods.cleanupItems = async function () {
  let changed = false;

  for (let i = this.items.length - 1; i >= 0; i--) {
    const item = this.items[i];
    const product = await Product.findById(item.product);

    // product missing → remove
    if (!product) {
      this.items.splice(i, 1);
      changed = true;
      continue;
    }

    // variant missing → remove
    if (item.variantId && !product.variants.id(item.variantId)) {
      this.items.splice(i, 1);
      changed = true;
    }
  }

  if (changed) {
    await this.save();
  }
  return this;
};

// 🔹 Get or create cart for a user
CartSchema.statics.getOrCreate = async function (userId) {
  let cart = await this.findOne({ user: userId });
  if (!cart) {
    cart = await this.create({ user: userId, items: [], totalPrice: 0 });
  }
  return cart;
};

const Cart = model("Cart", CartSchema);
export default Cart;
