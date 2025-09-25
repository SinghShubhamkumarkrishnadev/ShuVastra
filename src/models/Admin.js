import mongoose from "mongoose";
import argon2 from "argon2";

const { Schema, model } = mongoose;

const AdminSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
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
      // no required: true here, since it's set in pre-save
    },
    isVerified: {
      type: Boolean,
      default: true, // seeded admin will always be verified
    },
    role: {
      type: String,
      enum: ["admin", "superadmin"],
      default: "admin",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

// Virtual password field (not stored in DB)
AdminSchema.virtual("password")
  .set(function (password) {
    this._password = password;
  })
  .get(function () {
    return this._password;
  });

// Pre-save hook to hash password
AdminSchema.pre("save", async function (next) {
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
AdminSchema.methods.verifyPassword = async function (plain) {
  if (!this.passwordHash) return false;
  try {
    return await argon2.verify(this.passwordHash, plain);
  } catch (err) {
    return false;
  }
};

// Hide passwordHash in JSON responses
AdminSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

const Admin = model("Admin", AdminSchema);
export default Admin;
