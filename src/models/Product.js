import mongoose from "mongoose";
import Cart from "./Cart.js";

const { Schema, model } = mongoose;

/** Helper: slugify */
function slugify(text = "") {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Variant schema (with _id now) */
const VariantSchema = new Schema({
  size: { type: String, trim: true },
  color: {
    name: { type: String, trim: true },
    hexCode: { type: String, trim: true },
  },
  stock: {
    type: Number,
    required: true,
    min: [0, "Stock cannot be negative"],
    default: 0,
  },
  sku: { type: String, trim: true },
  price: { type: Number, min: 0 },
  images: [
    {
      url: { type: String, required: true },
      alt: { type: String },
    },
  ],
});

// Main product schema
const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    subCategory: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],

    price: { type: Number, required: true, min: [0, "Price must be positive"] },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
      default: 0,
    },
    finalPrice: { type: Number, min: 0 },

    stock: { type: Number, required: true, min: [0, "Stock cannot be negative"], default: 0 },
    variants: { type: [VariantSchema], default: [] },

    images: [{ url: { type: String, required: true }, alt: { type: String } }],
    videoUrl: { type: String, trim: true },

    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },

    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

/** Helpers */
function computeFinalPrice(price, discount) {
  const p = Number(price || 0);
  const d = Number(discount || 0);
  if (isNaN(p) || isNaN(d)) return undefined;
  return Math.max(0, p - (p * d) / 100);
}
function computeStockFromVariants(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.reduce((acc, v) => acc + (Number(v.stock || 0)), 0);
}

/** Pre-save hook */
ProductSchema.pre("save", async function (next) {
  try {
    if (typeof this.price !== "undefined") {
      this.finalPrice = computeFinalPrice(this.price, this.discount);
    }
    const computedStock = computeStockFromVariants(this.variants);
    if (computedStock !== null) this.stock = computedStock;

    if (!this.slug && this.name) {
      let base = slugify(this.name);
      let candidate = base;

      const query = { slug: new RegExp(`^${base}(-\\d+)?$`, "i") };
      if (this._id) query._id = { $ne: this._id };

      const conflictCount = await this.constructor.countDocuments(query);
      if (conflictCount > 0) candidate = `${base}-${conflictCount + 1}`;

      this.slug = candidate;
    }
    next();
  } catch (err) {
    next(err);
  }
});

/** Pre-update hook */
ProductSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set ? { ...update.$set } : { ...update };
    const docToUpdate = await this.model.findOne(this.getQuery()).lean();

    const newPrice = $set.price ?? docToUpdate?.price;
    const newDiscount = $set.discount ?? docToUpdate?.discount;
    if (typeof newPrice !== "undefined") {
      $set.finalPrice = computeFinalPrice(newPrice, newDiscount);
    }

    const newVariants = $set.variants ?? docToUpdate?.variants;
    const computedStock = computeStockFromVariants(newVariants);
    if (computedStock !== null) $set.stock = computedStock;

    if (typeof $set.name !== "undefined" && (!$set.slug || $set.slug === "")) {
      const base = slugify($set.name);
      let candidate = base;

      const query = { slug: new RegExp(`^${base}(-\\d+)?$`, "i") };
      const idQuery = this.getQuery();
      if (idQuery && idQuery._id) query._id = { $ne: idQuery._id };

      const conflictCount = await this.model.countDocuments(query);
      if (conflictCount > 0) candidate = `${base}-${conflictCount + 1}`;

      $set.slug = candidate;
    } else if ($set.slug) {
      $set.slug = slugify($set.slug);
    }

    this.setUpdate({ ...update, $set });
    next();
  } catch (err) {
    next(err);
  }
});

/** Indexes */
ProductSchema.index({ name: "text", description: "text", category: "text", tags: "text" });
ProductSchema.index({ category: 1, subCategory: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ finalPrice: 1 });

/** Cascade cleanup: remove product from carts */
ProductSchema.post(["findOneAndDelete", "findByIdAndDelete", "findOneAndUpdate"], async function (doc) {
  if (!doc?._id) return;
  try {
    const carts = await Cart.find({ "items.product": doc._id });
    for (const cart of carts) {
      await cart.cleanupItems();
    }
  } catch (err) {
    console.error("Error cleaning carts after product change:", err.message);
  }
});

const Product = model("Product", ProductSchema);
export default Product;
