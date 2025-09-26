// src/models/Product.js
import mongoose from "mongoose";
import Cart from "./Cart.js";

const { Schema, model } = mongoose;

/**
 * Helper: create a URL-friendly slug from a string
 */
function slugify(text = "") {
  return text
    .toString()
    .trim()
    .toLowerCase()
    // replace non-alphanumeric characters with hyphens
    .replace(/[^a-z0-9]+/g, "-")
    // collapse multiple hyphens
    .replace(/-+/g, "-")
    // trim hyphens from ends
    .replace(/^-+|-+$/g, "");
}

/**
 * Variant sub-schema (no _id, no unique SKU constraint at schema level)
 * NOTE: We intentionally DO NOT set `unique: true` on `sku` here because
 * unique constraints in subdocuments are unreliable across documents.
 * Enforce SKU uniqueness at the application/controller level if necessary.
 */
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
      // do not set unique here
      sparse: true,
      trim: true,
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
      index: true,
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
    variants: {
      type: [VariantSchema],
      default: [],
    },

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

/**
 * Recompute finalPrice from price & discount
 */
function computeFinalPrice(price, discount) {
  const p = Number(price || 0);
  const d = Number(discount || 0);
  if (isNaN(p) || isNaN(d)) return undefined;
  return Math.max(0, p - (p * d) / 100);
}

/**
 * Recompute product-level stock from variants (if variants exist).
 * If variants array is non-empty, product.stock becomes the sum of variant stocks.
 * If variants empty or not provided, product.stock remains as provided by client.
 */
function computeStockFromVariants(variants = []) {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.reduce((acc, v) => acc + (Number(v.stock || 0)), 0);
}

/**
 * Ensure slug is present and unique.
 * For new documents or when name changed, we generate a slug and if a conflict exists,
 * we append a numeric suffix (-1, -2, ...) to make it unique.
 */
ProductSchema.pre("save", async function (next) {
  try {
    // compute finalPrice
    if (typeof this.price !== "undefined") {
      this.finalPrice = computeFinalPrice(this.price, this.discount);
    }

    // compute stock from variants if variants exist
    const computedStock = computeStockFromVariants(this.variants);
    if (computedStock !== null) {
      this.stock = computedStock;
    }

    // generate slug if not provided or if name changed and slug is empty
    if (!this.slug && this.name) {
      let base = slugify(this.name);
      let candidate = base;
      // count matching slugs to avoid collisions
      // exclude this doc by _id if it's already present (in case of updates)
      const query = { slug: new RegExp(`^${base}(-\\d+)?$`, "i") };
      if (this._id) query._id = { $ne: this._id };

      const conflictCount = await this.constructor.countDocuments(query);
      if (conflictCount && conflictCount > 0) {
        candidate = `${base}-${conflictCount + 1}`;
      }

      this.slug = candidate;
    }

    next();
  } catch (err) {
    next(err);
  }
});

/**
 * For updates performed via findOneAndUpdate / findByIdAndUpdate: recompute finalPrice, stock and slug when appropriate.
 * This hook runs before the query executes and updates the update object.
 */
ProductSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate() || {};
    // Normalize update.$set for easier merging
    const $set = update.$set ? { ...update.$set } : { ...update };

    // Fetch current document to fallback for missing fields
    const docToUpdate = await this.model.findOne(this.getQuery()).lean();

    // Determine new price & discount (prefer incoming update values)
    const newPrice = typeof $set.price !== "undefined" ? $set.price : docToUpdate?.price;
    const newDiscount = typeof $set.discount !== "undefined" ? $set.discount : docToUpdate?.discount;

    // Recompute finalPrice
    if (typeof newPrice !== "undefined") {
      $set.finalPrice = computeFinalPrice(newPrice, newDiscount);
    }

    // Determine variants (incoming or existing)
    const newVariants = typeof $set.variants !== "undefined" ? $set.variants : docToUpdate?.variants;

    // Recompute stock if variants are present in incoming payload or exist currently
    const computedStock = computeStockFromVariants(newVariants);
    if (computedStock !== null) {
      $set.stock = computedStock;
    } else if (typeof $set.stock !== "undefined") {
      // if client provided stock explicitly (and no variants), keep it (validation will run)
      $set.stock = $set.stock;
    }

    // If name changed and slug not provided explicitly, regenerate slug & make unique
    if (typeof $set.name !== "undefined" && (typeof $set.slug === "undefined" || !$set.slug)) {
      const base = slugify($set.name);
      let candidate = base;
      const query = { slug: new RegExp(`^${base}(-\\d+)?$`, "i") };
      // exclude the current doc by id
      const idQuery = this.getQuery();
      if (idQuery && idQuery._id) {
        query._id = { $ne: idQuery._id };
      }
      const conflictCount = await this.model.countDocuments(query);
      if (conflictCount && conflictCount > 0) {
        candidate = `${base}-${conflictCount + 1}`;
      }
      $set.slug = candidate;
    } else if (typeof $set.slug !== "undefined" && $set.slug) {
      // normalize provided slug
      $set.slug = slugify($set.slug);
    }

    // Apply normalized $set back to update
    this.setUpdate({ ...update, $set });
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Indexes
 */
ProductSchema.index({ name: "text", description: "text", category: "text", tags: "text" });
// unique index on slug (already declared on field), ensure it's created in DB
ProductSchema.index({ slug: 1 }, { unique: true, sparse: true });
// composite index to speed up category + subCategory queries
ProductSchema.index({ category: 1, subCategory: 1 });
// add indexes for price/finalPrice for sorting/filtering performance
ProductSchema.index({ price: 1 });
ProductSchema.index({ finalPrice: 1 });


/**
 * When a product is deleted, remove it (and its variants) from all carts automatically.
 */
ProductSchema.post("findOneAndDelete", async function (doc) {
  if (!doc?._id) return;

  try {
    // Find all carts containing this product
    const carts = await Cart.find({ "items.product": doc._id });
    for (const cart of carts) {
      await cart.cleanupItems();
    }
  } catch (err) {
    console.error("Error cleaning carts after product deletion:", err.message);
  }
});

ProductSchema.post("findByIdAndDelete", async function (doc) {
  if (!doc?._id) return;

  try {
    const carts = await Cart.find({ "items.product": doc._id });
    for (const cart of carts) {
      await cart.cleanupItems();
    }
  } catch (err) {
    console.error("Error cleaning carts after product deletion:", err.message);
  }
});

// ⚠️ Variant deletion cleanup
// If your app supports deleting/updating variants individually (via $pull or direct updates),
// hook into `findOneAndUpdate` to cleanup carts too.
ProductSchema.post("findOneAndUpdate", async function (doc) {
  if (!doc?._id) return;

  try {
    const carts = await Cart.find({ "items.product": doc._id });
    for (const cart of carts) {
      await cart.cleanupItems();
    }
  } catch (err) {
    console.error("Error cleaning carts after variant update:", err.message);
  }
});

const Product = model("Product", ProductSchema);
export default Product;
