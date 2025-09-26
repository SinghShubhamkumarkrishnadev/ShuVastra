// FILE: src/controllers/productController.js
import Product from "../models/Product.js";
import {
  validateCreateProduct,
  validateUpdateProduct,
} from "../utils/productValidation.js";

// Utility to format Joi errors
const formatValidationError = (error) =>
  error.details.map((err) => err.message);

// ✅ Create Product
export const createProduct = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = validateCreateProduct(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, errors: formatValidationError(error) });
    }

    // Auto-generate slug if not provided
    if (!value.slug) {
      value.slug = value.name.toLowerCase().replace(/\s+/g, "-");
    }

    const product = new Product(value);
    await product.save();

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error (slug or SKU)
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `Duplicate value for ${field}. Please use another one.`,
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Get All Products with Filters, Pagination, and Sorting
export const getAllProducts = async (req, res) => {
  try {
    const {
      search,
      category,
      subCategory,
      tags,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    // 🔍 Search (MongoDB text index or regex fallback)
    if (search) {
      query.$text = { $search: search };
    }

    // 🏷 Category filter
    if (category) query.category = category;

    // 🏷 Subcategory filter
    if (subCategory) query.subCategory = subCategory;

    // 🏷 Tags filter
    if (tags) {
      const tagsArray = tags.split(",").map((tag) => tag.trim().toLowerCase());
      query.tags = { $in: tagsArray };
    }

    // 💰 Price range filter
    if (minPrice || maxPrice) {
      query.finalPrice = {};
      if (minPrice) query.finalPrice.$gte = Number(minPrice);
      if (maxPrice) query.finalPrice.$lte = Number(maxPrice);
    }

    // 📄 Pagination setup
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    const skip = (pageNumber - 1) * limitNumber;

    // ↕ Sorting setup
    let sort = { createdAt: -1 }; // default
    if (sortBy) {
      const order = sortOrder === "asc" ? 1 : -1;
      sort = { [sortBy]: order };
    }

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limitNumber),
      Product.countDocuments(query),
    ]);

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
    const product = await Product.findById(req.params.id);
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
    const product = await Product.findOne({ slug: req.params.slug });
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

// ✅ Update Product
export const updateProduct = async (req, res) => {
  try {
    // Validate request body
    const { error, value } = validateUpdateProduct(req.body);
    if (error) {
      return res
        .status(400)
        .json({ success: false, errors: formatValidationError(error) });
    }

    if (value.slug) {
      value.slug = value.slug.toLowerCase().replace(/\s+/g, "-");
    }

    const product = await Product.findByIdAndUpdate(req.params.id, value, {
      new: true,
      runValidators: true,
    });

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
    const product = await Product.findByIdAndDelete(req.params.id);
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
