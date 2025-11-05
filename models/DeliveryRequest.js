// models/DeliveryRequest.js
import mongoose from "mongoose";

const DeliverySchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    itemDescription: { type: String, required: true },
    contactNumber:   { type: String, required: true },
    village:         { type: String, required: true },

    shopName:    { type: String, required: true },
    shopAddress: { type: String, required: true },

    estimatedDistanceKm: { type: Number, default: null },
    price: { type: Number, required: true, default: 4.0 },

    // NEW: customer’s requested delivery time (optional for backward compatibility)
    needByAt: { type: Date, default: null },

    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deliveryStatus: {
      type: String,
      enum: ["Pending", "Assigned", "Picked", "Delivered"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

DeliverySchema.index({ deliveryStatus: 1, assignedDriver: 1 });

export default mongoose.model("Delivery", DeliverySchema);
