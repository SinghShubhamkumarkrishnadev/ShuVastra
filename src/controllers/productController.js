// FILE: src/controllers/productController.js
import Product from "../models/Product.js";
import {
  validateCreateProduct,
  validateUpdateProduct,
} from "../utils/productValidation.js";

import {
  validateCreateReview,
  validateUpdateReview,
} from "../utils/reviewValidation.js";

/**
 * Utility: format Joi errors
 */
const formatValidationError = (error) =>
  error.details.map((err) => err.message);

// ✅ Create Product
export const createProduct = async (req, res) => {
  try {
    const { error, value } = validateCreateProduct(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: formatValidationError(error),
      });
    }

    // model pre-save will handle slug, sku, finalPrice, and uniqueness
    const product = new Product(value);
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate value for ${field}. Please use another one.`,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get All Products (filters, pagination, sorting)
export const getAllProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      subCategory,
      tags,
      gender,
      priceRange,   
      sortBy,
      sortOrder,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;
    if (gender) query.gender = gender;

    if (tags) {
      const tagsArray = tags.split(",").map((t) => t.trim().toLowerCase());
      query.tags = { $in: tagsArray };
    }

    // --- Price range buckets ---
    if (priceRange) {
      if (priceRange.startsWith("below-")) {
        const val = Number(priceRange.split("-")[1]);
        if (!isNaN(val)) {
          query.finalPrice = { $lt: val };
        }
      } else if (priceRange.startsWith("above-")) {
        const val = Number(priceRange.split("-")[1]);
        if (!isNaN(val)) {
          query.finalPrice = { $gt: val };
        }
      } else if (priceRange.endsWith("+")) {
        // e.g. "10000+" → >= 10000
        const val = Number(priceRange.replace("+", ""));
        if (!isNaN(val)) {
          query.finalPrice = { $gte: val };
        }
      } else if (priceRange.includes("-")) {
        const [min, max] = priceRange.split("-").map(Number);
        if (!isNaN(min) && !isNaN(max)) {
          query.finalPrice = { $gte: min, $lte: max };
        }
      }
    }

    // --- Pagination & Sorting ---
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    let sort = { createdAt: -1 };
    if (sortBy) {
      const order = sortOrder === "asc" ? 1 : -1;
      sort = { [sortBy]: order };
    }

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limitNumber),
      Product.countDocuments(query),
    ]);

    // --- Inject isInWishlist ---
    let wishlistIds = [];
    if (req.user && req.user.wishlist) {
      wishlistIds = req.user.wishlist.map((id) => String(id));
    }

    const productsWithWishlist = products.map((p) => ({
      ...p.toObject(),
      isInWishlist: wishlistIds.includes(String(p._id)),
    }));

    res.status(200).json({
      success: true,
      total,
      page: pageNumber,
      pages: Math.ceil(total / limitNumber),
      data: products,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get Single Product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(200).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get Single Product by Slug
export const getProductBySlug = async (req, res) => {
  try {
    const product = await Product.findOne({
      slug: String(req.params.slug || "").toLowerCase(),
    });
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    let isInWishlist = false;
    if (req.user && req.user.wishlist) {
      isInWishlist = req.user.wishlist.some((id) => String(id) === String(product._id));
    }

    res.status(200).json({
      success: true,
      data: { ...product.toObject(), isInWishlist },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Search Suggestions (autocomplete)
export const getProductSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.json({ success: true, data: [] });
    }

    // Return name, slug, and only the first image object
    const suggestions = await Product.find(
      { name: { $regex: q, $options: "i" } },
      { name: 1, slug: 1, images: { $slice: 1 } } // projection to limit payload
    )
      .limit(10)
      .lean();

    // --- Inject isInWishlist ---
    let wishlistIds = [];
    if (req.user && req.user.wishlist) {
      wishlistIds = req.user.wishlist.map((id) => String(id));
    }

    const enrichedSuggestions = suggestions.map((s) => ({
      ...s,
      isInWishlist: wishlistIds.includes(String(s._id)),
    }));

    res.json({ success: true, data: enrichedSuggestions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Update Product
export const updateProduct = async (req, res) => {
  try {
    const { error, value } = validateUpdateProduct(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: formatValidationError(error),
      });
    }

    // Prevent manual slug / sku overwrite (remove even empty string cases)
    if ("slug" in value) delete value.slug;
    if ("sku" in value) delete value.sku;

    const product = await Product.findByIdAndUpdate(
      req.params.productId,
      { $set: value },
      { new: true, runValidators: true, context: "query" }
    );

    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate value for ${field}. Please use another one.`,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Add Review
export const addReview = async (req, res) => {
  try {
    const { error, value } = validateCreateReview(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((d) => d.message),
      });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // attach user from auth
    const review = { ...value, user: req.user._id };
    if (!req.user.roles?.includes("admin")) delete review.status;

    await product.addReview(review);

    res.status(201).json({
      success: true,
      message: "Review added successfully",
      data: product,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get Reviews
export const getReviews = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId, "reviews ratings");
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }
    res.status(200).json({
      success: true,
      averageRating: product.ratings.average,
      totalReviews: product.ratings.count,
      reviews: product.reviews,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Update Review
export const updateReview = async (req, res) => {
  try {
    const { error, value } = validateUpdateReview(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        errors: error.details.map((d) => d.message),
      });
    }

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const review = product.reviews.id(req.params.reviewId);
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    // Only allow owner (or admin)
    if (
      String(review.user) !== String(req.user._id) &&
      !req.user.roles.includes("admin")
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this review",
      });
    }

    if ("status" in value && !req.user.roles?.includes("admin")) {
      delete value.status;
    }
    Object.assign(review, value);

    await product.recalculateRatings();

    res.status(200).json({
      success: true,
      message: "Review updated successfully",
      data: product,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Delete Review
export const deleteReview = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const review = product.reviews.id(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    if (String(review.user) !== String(req.user._id) && !req.user.roles?.includes("admin")) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this review" });
    }
    await product.removeReviewById(req.params.reviewId);

    res.status(200).json({
      success: true,
      message: "Review deleted successfully",
      data: product,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
