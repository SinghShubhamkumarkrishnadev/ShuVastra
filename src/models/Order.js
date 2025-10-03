// src/models/Order.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },

    productName: { type: String, required: true },
    sku: { type: String }, 
    size: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    lineTotal: { type: Number, required: true }, 
  },
  { _id: false }
);

const AddressSchema = new Schema(
  {
    name: { type: String },
    phone: { type: String },
    street: { type: String },
    city: { type: String },
    state: { type: String },
    postalCode: { type: String },
    country: { type: String },
  },
  { _id: false }
);

const PaymentSchema = new Schema(
  {
    method: { type: String, enum: ["COD"], default: "COD" }, // expand later
    // For non-sensitive bookkeeping only — do NOT store full card details here.
    paid: { type: Boolean, default: false }, // for COD, remains false until delivered/collected if you want
    paidAt: { type: Date },
    transactionId: { type: String },
  },
  { _id: false }
);

const OrderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    items: [OrderItemSchema],

    // pricing summary
    subTotal: { type: Number, required: true, default: 0 }, // sum of lineTotal
    tax: { type: Number, required: true, default: 0 },
    shipping: { type: Number, required: true, default: 0 },
    discount: { type: Number, required: true, default: 0 }, // total discount amount
    total: { type: Number, required: true, default: 0 }, // final payable

    shippingAddress: AddressSchema,
    billingAddress: AddressSchema,

    // fulfillment & status
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "refunded"],
      default: "pending",
    },
    trackingNumber: { type: String },
    shippingCarrier: { type: String },

    // payment snapshot
    payment: PaymentSchema,

    // flags
    isPaid: { type: Boolean, default: false },
    isReturned: { type: Boolean, default: false },

    // Admin notes, optional
    notes: { type: String },
  },
  { timestamps: true }
);

// Small helper to compute totals server-side if needed
OrderSchema.methods.computeTotals = function () {
  this.subTotal = this.items.reduce((s, it) => s + Number(it.lineTotal || 0), 0);
  // Simple tax/shipping calc placeholders — you can replace these with real logic
  if (!this.tax) this.tax = Math.round(this.subTotal * 0.05 * 100) / 100; // 5% tax
  if (!this.shipping) this.shipping = this.subTotal > 2000 ? 0 : 50; // free shipping over 2000
  // total = subTotal + tax + shipping - discount
  this.total = Math.round((this.subTotal + this.tax + this.shipping - (this.discount || 0)) * 100) / 100;
};

const Order = model("Order", OrderSchema);
export default Order;
