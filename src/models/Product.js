// FILE: src/models/Product.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Sub-schema for product variants (sizes, colors, stock)
const VariantSchema = new Schema(
  {
    size: {
      type: String, // e.g., "S", "M", "L", "XL", "32", "Free Size"
      trim: true,
    },
    color: {
      name: { type: String, trim: true }, // e.g., "Red", "Black"
      hexCode: { type: String, trim: true }, // optional (#FF0000)
    },
    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
      trim: true, // Stock Keeping Unit
    },
    price: {
      type: Number,
      min: 0,
    },
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String },
      },
    ],
  },
  { _id: false }
);

// Main product schema
const ProductSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // Pricing
    price: {
      type: Number,
      required: true,
      min: [0, "Price must be positive"],
    },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
      default: 0,
    },
    finalPrice: {
      type: Number,
      min: 0,
    },

    // Stock & Variants
    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    variants: [VariantSchema],

    // Media
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String },
      },
    ],
    videoUrl: {
      type: String,
      trim: true,
    },

    // Flags
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNewArrival: {
      type: Boolean,
      default: false,
    },

    // SEO & Meta
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

// Pre-save hook to calculate final price
ProductSchema.pre("save", function (next) {
  if (this.price && this.discount >= 0) {
    this.finalPrice = this.price - (this.price * this.discount) / 100;
  }
  next();
});

// Text index for searching
ProductSchema.index({
  name: "text",
  description: "text",
  category: "text",
  tags: "text",
});

const Product = model("Product", ProductSchema);
export default Product;
