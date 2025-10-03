// FILE: src/utils/reviewValidation.js
import Joi from "joi";

const imageSchema = Joi.object({
  url: Joi.string().uri().required(),
  alt: Joi.string().trim().optional(),
});

const baseReviewSchema = {
  rating: Joi.number().min(1).max(5).required(),
  title: Joi.string().trim().optional(),
  comment: Joi.string().trim().optional(),
  images: Joi.array().items(imageSchema).default([]),
  // user: comes from req.user, never from client
  status: Joi.string().valid("pending", "approved", "rejected").optional(),
};

// ✅ Add Review Schema
export const validateCreateReview = (data) =>
  Joi.object(baseReviewSchema).validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

// ✅ Update Review Schema (all optional except at least one field)
export const validateUpdateReview = (data) =>
  Joi.object({
    ...Object.keys(baseReviewSchema).reduce((acc, key) => {
      acc[key] = baseReviewSchema[key].optional();
      return acc;
    }, {}),
  })
    .min(1)
    .validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });
