//src/models/User.js
import mongoose from "mongoose";
import argon2 from "argon2";

const { Schema, model } = mongoose;

const UserSchema = new Schema(
  {
    username: {
      type: String,
      trim: true,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user"],
      default: "user",
    },
  },
  { timestamps: true }
);

// Virtual password field
UserSchema.virtual("password")
  .set(function (password) {
    this._password = password;
  })
  .get(function () {
    return this._password;
  });

// Pre-save hook to hash password
UserSchema.pre("save", async function (next) {
  if (this._password) {
    try {
      this.passwordHash = await argon2.hash(this._password);
      this._password = undefined;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Method to verify password
UserSchema.methods.verifyPassword = async function (plain) {
  if (!this.passwordHash) return false;
  try {
    return await argon2.verify(this.passwordHash, plain);
  } catch {
    return false;
  }
};

// Hide sensitive fields
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

const User = model("User", UserSchema);
export default User;
