// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["customer", "driver", "shop"],
      required: true,
    },

    // For customers: optional village
    village: {
      type: String,
    },

    // For drivers: optional vehicle info
    vehicleType: {
      type: String,
    },

    // For shop accounts: which shop they manage.
    // This should match one of the ids from backend/data/shops.js (e.g. "shop1", "shop2", ...)
    shopId: {
      type: String,
    },
  },
  { timestamps: true }
);

// Helpful index for shop lookups
userSchema.index({ role: 1, shopId: 1 });

const User = mongoose.model("User", userSchema);
export default User;
