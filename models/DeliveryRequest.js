// backend/models/DeliveryRequest.js
import mongoose from "mongoose";

const DeliverySchema = new mongoose.Schema(
  {
    // Who created the request (customer)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Human-readable summary of items / basket
    itemDescription: {
      type: String,
      required: true,
    },

    // Customer contact + village
    contactNumber: {
      type: String,
      required: true,
    },

    village: {
      type: String,
      required: true,
    },

    // Linked shop info (display)
    shopName: {
      type: String,
      required: true,
    },

    shopAddress: {
      type: String,
      required: true,
    },

    /**
     * Logical shop identifier:
     * - For static shops (from backend/data/shops.js), this should match s.id ("shop1", "shop2", ...)
     * - For future dynamic shops, you can store their ID / code here.
     * Used so "shop" users can filter only their orders.
     */
    shopId: {
      type: String,
      index: true,
    },

    // Distance + price (driver payout / delivery fee)
    estimatedDistanceKm: {
      type: Number,
      default: null,
    },

    price: {
      type: Number,
      required: true,
      default: 4.0,
    },

    // Optional: customer requested delivery time
    needByAt: {
      type: Date,
      default: null,
    },

    // Assignment to driver
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    deliveryStatus: {
      type: String,
      enum: ["Pending", "Assigned", "Picked", "Delivered"],
      default: "Pending",
    },

    /**
     * Shop confirmation flow:
     * - "Pending": customer placed order, waiting for shop decision
     * - "Accepted": shop has confirmed items are available / will prepare
     * - "Rejected": shop declined (e.g., out of stock)
     *
     * Driver should ideally only accept jobs that are "Accepted" or at least visible with this flag.
     */
    shopConfirmationStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },

    shopConfirmationAt: {
      type: Date,
      default: null,
    },

    shopNote: {
      type: String,
      default: "",
    },

    // Optional: normalized items snapshot for future (already being sent from frontend)
    // Not strictly required, but you’re already passing items/productTotal/etc from frontend.
    items: [
      {
        id: String,
        name: String,
        qty: Number,
        price: Number,
      },
    ],

    productTotal: {
      type: Number,
      default: null,
    },

    deliveryFee: {
      type: Number,
      default: null,
    },

    grandTotal: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true }
);

// Useful indexes
DeliverySchema.index({ deliveryStatus: 1, assignedDriver: 1 });
DeliverySchema.index({ shopId: 1, shopConfirmationStatus: 1 });

export default mongoose.model("Delivery", DeliverySchema);
