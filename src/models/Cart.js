// FILE: src/models/Cart.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

/** -------------------------
 * Sub-schema: Cart Item
 * --------------------------*/
const CartItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    size: { type: String },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, default: 0 }, // snapshot price
  },
  { timestamps: true }
);


/** -------------------------
 * Cart Schema
 * --------------------------*/
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

/** -------------------------
 * Instance Methods
 * --------------------------*/

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

  const productIds = [...new Set(this.items.map((i) => String(i.product)))];
  if (productIds.length === 0) return this;

  const ProductModel =
    mongoose.models.Product || (await import("./Product.js")).default;

  const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  for (let i = this.items.length - 1; i >= 0; i--) {
    const item = this.items[i];
    const product = productMap.get(String(item.product));

    if (!product) {
      this.items.splice(i, 1);
      changed = true;
      continue;
    }

    // check size exists
    if (item.size && !product.sizes.includes(item.size)) {
      this.items.splice(i, 1);
      changed = true;
      continue;
    }
  }

  if (changed) {
    await this.save();
  }
  return this;
};


/** -------------------------
 * Statics
 * --------------------------*/

// 🔹 Get or create cart for a user (handles race conditions)
CartSchema.statics.getOrCreate = async function (userId) {
  let cart = await this.findOne({ user: userId });
  if (cart) return cart;

  try {
    return await this.create({ user: userId, items: [], totalPrice: 0 });
  } catch (err) {
    if (err.code === 11000) {
      // duplicate key => another request created the cart
      return this.findOne({ user: userId });
    }
    throw err;
  }
};

/** -------------------------
 * Model Export
 * --------------------------*/
const Cart = model("Cart", CartSchema);
export default Cart;
