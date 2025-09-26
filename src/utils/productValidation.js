// FILE: src/utils/validation/productValidation.js
import Joi from "joi";

// Variant validation schema
const variantSchema = Joi.object({
  size: Joi.string().trim().optional(), // e.g., "M", "L", "Free Size"
  color: Joi.object({
    name: Joi.string().trim().required(),
    hexCode: Joi.string()
      .trim()
      .pattern(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .optional(),
  }).optional(),
  stock: Joi.number().integer().min(0).default(0),
  sku: Joi.string().trim().optional(), // uniqueness validated at controller level
  price: Joi.number().min(0).optional(),
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        alt: Joi.string().trim().optional(),
      })
    )
    .optional(),
});

// Main product validation schema
const productSchema = Joi.object({
  name: Joi.string().trim().required(),
  slug: Joi.string().trim().lowercase().optional(), // auto-generated if missing
  description: Joi.string().trim().optional(),
  brand: Joi.string().trim().optional(),
  category: Joi.string().trim().required(),
  subCategory: Joi.string().trim().optional(),
  tags: Joi.array().items(Joi.string().trim().lowercase()).optional(),

  // Pricing
  price: Joi.number().min(0).required(),
  discount: Joi.number().min(0).max(100).default(0),

  // Stock & Variants
  stock: Joi.number().integer().min(0).default(0),
  variants: Joi.array().items(variantSchema).optional(),

  // Media
  images: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        alt: Joi.string().trim().optional(),
      })
    )
    .min(1)
    .required(), // at least 1 image required
  videoUrl: Joi.string().uri().optional(),

  // Flags
  isActive: Joi.boolean().default(true),
  isFeatured: Joi.boolean().default(false),
  isNewArrival: Joi.boolean().default(false),

  // SEO & Meta
  metaTitle: Joi.string().trim().optional(),
  metaDescription: Joi.string().trim().optional(),
  keywords: Joi.array().items(Joi.string().trim()).optional(),
});

// Separate schemas for create & update
export const validateCreateProduct = (data) =>
  productSchema.validate(data, { abortEarly: false, stripUnknown: true });

export const validateUpdateProduct = (data) =>
  productSchema
    .fork(
      Object.keys(productSchema.describe().keys),
      (field) => field.optional() // make all fields optional in update
    )
    .validate(data, { abortEarly: false, stripUnknown: true });
