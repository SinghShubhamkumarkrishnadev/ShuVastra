// src/models/Product.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

/** -------------------------
 * Helpers
 * --------------------------*/
function slugify(text = "") {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateRandomSuffix(len = 5) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

async function generateUniqueSku(Model, base = "prd", maxAttempts = 10) {
  base =
    String(base || "prd")
      .replace(/[^A-Z0-9]/gi, "")
      .slice(0, 10)
      .toUpperCase() || "PRD";

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = `${base}-${generateRandomSuffix(5)}`;
    const exists = await Model.exists({ sku: candidate });
    if (!exists) return candidate;
  }
  return `${base}-${Date.now().toString(36).toUpperCase()}`;
}

function computeFinalPrice(price, discount) {
  const p = Number(price || 0);
  const d = Number(discount || 0);
  if (isNaN(p) || isNaN(d)) return undefined;
  return Math.max(0, Math.round((p - (p * d) / 100) * 100) / 100);
}

function computeRatingsFromReviews(reviews = []) {
  if (!Array.isArray(reviews)) return { average: 0, count: 0 };
  // only approved reviews count
  const approved = reviews.filter(
    (r) => r && typeof r.rating === "number" && r.status === "approved"
  );
  const count = approved.length;
  const average =
    count === 0
      ? 0
      : approved.reduce((s, r) => s + Number(r.rating || 0), 0) / count;
  return { average: Math.round(average * 10) / 10, count };
}

/** -------------------------
 * Sub-schemas
 * --------------------------*/
const ImageSubSchema = new Schema(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, trim: true },
  },
  { _id: false }
);

const ReviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true },
    comment: { type: String, trim: true },
    images: [ImageSubSchema],
    helpfulCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
  },
  { timestamps: true }
);

/** -------------------------
 * Product Schema
 * --------------------------*/
const ProductSchema = new Schema(
  {
    // Core
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    subCategory: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],

    // Pricing
    price: { type: Number, required: true, min: [0, "Price must be positive"] },
    discount: {
      type: Number,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot exceed 100%"],
      default: 0,
    },
    finalPrice: { type: Number, min: 0 },

    // Stock & Inventory
    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    allowBackorder: { type: Boolean, default: false },
    sku: { type: String, unique: true, trim: true, index: true },

    // Clothing-specific multiple fields
    sizes: [{ type: String, trim: true }],  // e.g., ["S", "M", "L", "XL"]

    material: { type: String, trim: true },
    gender: { type: String, enum: ["Men", "Women", "Unisex", "Boys", "Girls"], trim: true },
    season: { type: String, trim: true },

    // Media
    images: { type: [ImageSubSchema], default: [] },
    videoUrl: { type: String, trim: true },

    // Shipping
    shipping: {
      weightGrams: { type: Number, min: 0 },
      dimensionsCm: {
        length: { type: Number, min: 0 },
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 },
      },
      shippingClass: { type: String, trim: true },
      originCountry: { type: String, trim: true },
    },

    // Returns
    returnable: { type: Boolean, default: true },
    returnPeriodDays: { type: Number, default: 30, min: 0 },

    // Ratings & Reviews
    ratings: {
      average: { type: Number, min: 0, max: 5, default: 0 },
      count: { type: Number, default: 0 },
    },
    reviews: { type: [ReviewSchema], default: [] },

    // Flags
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isNewArrival: { type: Boolean, default: false },

    // SEO
    metaTitle: { type: String, trim: true },
    metaDescription: { type: String, trim: true },
    keywords: [{ type: String, trim: true }],

    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

/** -------------------------
 * Indexes
 * --------------------------*/
ProductSchema.index(
  {
    name: "text",
    description: "text",
    brand: "text",
    category: "text",
    tags: "text",
  },
  { weights: { name: 5, brand: 3, description: 2, category: 2, tags: 1 } }
);

ProductSchema.index({ category: 1, subCategory: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ finalPrice: 1 });

/** -------------------------
 * Instance / Static Methods
 * --------------------------*/
ProductSchema.methods.recalculateRatings = async function () {
  const { average, count } = computeRatingsFromReviews(this.reviews || []);
  this.ratings = { average, count };
  return this.save();
};

ProductSchema.methods.addReview = async function (review = {}) {
  this.reviews.push(review);
  const { average, count } = computeRatingsFromReviews(this.reviews);
  this.ratings = { average, count };
  return this.save();
};

ProductSchema.methods.removeReviewById = async function (reviewId) {
  const beforeCount = (this.reviews || []).length;
  this.reviews = (this.reviews || []).filter(
    (r) => String(r._id) !== String(reviewId)
  );
  if ((this.reviews || []).length === beforeCount) return this;
  const { average, count } = computeRatingsFromReviews(this.reviews);
  this.ratings = { average, count };
  return this.save();
};

ProductSchema.statics.findBySlug = function (slug) {
  if (!slug) return null;
  return this.findOne({ slug: slug.toString().toLowerCase() });
};

/** -------------------------
 * Pre-save hook
 * --------------------------*/
ProductSchema.pre("save", async function (next) {
  try {
    if (typeof this.price !== "undefined") {
      this.finalPrice = computeFinalPrice(this.price, this.discount);
    }

    if (this.name) {
      const base = slugify(this.name);
      let candidate = base || slugify(String(this._id || "prd"));
      let i = 0;
      while (
        await this.constructor.exists({ slug: candidate, _id: { $ne: this._id } })
      ) {
        i++;
        candidate = `${base}-${i}`;
      }
      this.slug = candidate;
    }

    if (!this.sku) {
      let baseSku =
        (this.slug &&
          this.slug.replace(/[^A-Z0-9]/gi, "").slice(0, 10).toUpperCase()) ||
        "PRD";
      this.sku = await generateUniqueSku(this.constructor, baseSku);
    }

    if (this.isModified("reviews")) {
      const { average, count } = computeRatingsFromReviews(this.reviews || []);
      this.ratings = { average, count };
    }

    next();
  } catch (err) {
    next(err);
  }
});

/** -------------------------
 * Pre-findOneAndUpdate hook
 * --------------------------*/
ProductSchema.pre("findOneAndUpdate", async function (next) {
  try {
    let update = this.getUpdate() || {};
    if (!Object.keys(update).some((k) => k.startsWith("$"))) {
      update = { $set: { ...update } };
    }
    const $set = update.$set || {};
    const $push = update.$push || {};
    const $pull = update.$pull || {};

    const query = this.getQuery();
    const docToUpdate = await this.model.findOne(query).lean();

    const newPrice =
      typeof $set.price !== "undefined" ? $set.price : docToUpdate?.price;
    const newDiscount =
      typeof $set.discount !== "undefined"
        ? $set.discount
        : docToUpdate?.discount;
    if (typeof newPrice !== "undefined") {
      $set.finalPrice = computeFinalPrice(newPrice, newDiscount);
    }

    if (typeof $set.name !== "undefined") {
      const base = slugify($set.name);
      let candidate = base;
      let i = 0;
      const excludeId = docToUpdate?._id;
      while (
        await this.model.exists({ slug: candidate, _id: { $ne: excludeId } })
      ) {
        i++;
        candidate = `${base}-${i}`;
      }
      $set.slug = candidate;
    } else {
      if ("slug" in $set && ($set.slug === undefined || $set.slug === null)) {
        delete $set.slug;
      }
    }

    if ((!$set.sku || $set.sku === "") && docToUpdate?.sku) {
      $set.sku = docToUpdate.sku;
    }

    let computedReviews = null;
    if (typeof $set.reviews !== "undefined") {
      computedReviews = Array.isArray($set.reviews) ? $set.reviews : [];
    } else if ($push.reviews) {
      const toPush = $push.reviews;
      let incoming = [];
      if (toPush && typeof toPush === "object" && Array.isArray(toPush.$each)) {
        incoming = toPush.$each;
      } else if (Array.isArray(toPush)) {
        incoming = toPush;
      } else {
        incoming = [toPush];
      }
      computedReviews = [...(docToUpdate?.reviews || []), ...incoming];
    } else if ($pull && $pull.reviews && $pull.reviews._id) {
      computedReviews = (docToUpdate?.reviews || []).filter(
        (r) => String(r._id) !== String($pull.reviews._id)
      );
    }

    if (computedReviews !== null) {
      const { average, count } = computeRatingsFromReviews(computedReviews);
      $set.ratings = { average, count };
    }

    update.$set = $set;
    this.setUpdate(update);
    next();
  } catch (err) {
    next(err);
  }
});

/** -------------------------
 * Post-delete cascade
 * --------------------------*/
ProductSchema.post(
  ["findOneAndDelete", "findByIdAndDelete"],
  async function (doc) {
    if (!doc?._id) return;
    try {
      const CartModel =
        mongoose.models.Cart || (await import("./Cart.js")).default;
      const carts = await CartModel.find({ "items.product": doc._id });
      for (const cart of carts) {
        if (typeof cart.cleanupItems === "function") {
          await cart.cleanupItems();
        } else {
          cart.items = (cart.items || []).filter(
            (it) => String(it.product) !== String(doc._id)
          );
          await cart.save();
        }
      }
    } catch (err) {
      console.error(
        "Error cleaning carts after product deletion:",
        err?.message || err
      );
    }
  }
);

/** -------------------------
 * toJSON transform
 * --------------------------*/
if (!ProductSchema.options.toJSON) ProductSchema.options.toJSON = {};
ProductSchema.options.toJSON.transform = function (doc, ret) {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
  return ret;
};

const Product = model("Product", ProductSchema);
export default Product;
