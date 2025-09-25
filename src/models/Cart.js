// File: src/models/Cart.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const CartItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId }, // references Product.variants._id
    quantity: { type: Number, required: true, min: 1, default: 1 },
    // snapshot of price (variant price if available, else product price)
    price: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const CartSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [CartItemSchema],
    totalPrice: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Recalculate total price
CartSchema.methods.recalculate = function () {
  this.totalPrice = this.items.reduce((sum, it) => {
    const itemTotal = (Number(it.price) || 0) * (Number(it.quantity) || 0);
    return sum + itemTotal;
  }, 0);
};

CartSchema.pre("save", function (next) {
  this.recalculate();
  next();
});

// Helper: get or create cart for a user
CartSchema.statics.getOrCreate = async function (userId) {
  let cart = await this.findOne({ user: userId });
  if (!cart) {
    cart = await this.create({ user: userId, items: [], totalPrice: 0 });
  }
  return cart;
};

const Cart = model("Cart", CartSchema);
export default Cart;
