// FILE: src/utils/productValidation.js
import Joi from "joi";

const imageSchema = Joi.object({
  url: Joi.string().uri().required(),
  alt: Joi.string().trim().optional(),
});

const productSchema = Joi.object({
  // Core
  name: Joi.string().trim().required(),
  description: Joi.string().trim().optional(),
  brand: Joi.string().trim().optional(),
  category: Joi.string().trim().required(),
  subCategory: Joi.string().trim().optional(),
  tags: Joi.array().items(Joi.string().trim().lowercase()).optional(),

  // Pricing
  price: Joi.number().min(0).required(),
  discount: Joi.number().min(0).max(100).default(0),

  // Stock & Inventory
  stock: Joi.number().integer().min(0).default(0),
  lowStockThreshold: Joi.number().integer().min(0).default(5),
  allowBackorder: Joi.boolean().default(false),

  // Clothing-specific
  sizes: Joi.array().items(Joi.string().trim()),

  material: Joi.string().trim().optional(),
  gender: Joi.string().valid("Men", "Women", "Unisex", "Boys", "Girls").optional(),
  season: Joi.string().trim().optional(),

  // Media
  images: Joi.array().items(imageSchema).default([]), // allow empty array
  videoUrl: Joi.string().uri().optional(),

  // Shipping & dimensions
  shipping: Joi.object({
    weightGrams: Joi.number().min(0).optional(),
    dimensionsCm: Joi.object({
      length: Joi.number().min(0).optional(),
      width: Joi.number().min(0).optional(),
      height: Joi.number().min(0).optional(),
    }).optional(),
    shippingClass: Joi.string().trim().optional(),
    originCountry: Joi.string().trim().optional(),
  }).optional(),

  // Returns & policies
  returnable: Joi.boolean().default(true),
  returnPeriodDays: Joi.number().integer().min(0).default(30),

  // Flags
  isActive: Joi.boolean().default(true),
  isFeatured: Joi.boolean().default(false),
  isNewArrival: Joi.boolean().default(false),

  // SEO
  metaTitle: Joi.string().trim().optional(),
  metaDescription: Joi.string().trim().optional(),
  keywords: Joi.array().items(Joi.string().trim()).optional(),
});

export const validateCreateProduct = (data) =>
  productSchema.validate(data, { abortEarly: false, stripUnknown: true });

export const validateUpdateProduct = (data) =>
  productSchema
    .fork(Object.keys(productSchema.describe().keys), (field) => field.optional())
    .validate(data, { abortEarly: false, stripUnknown: true });
