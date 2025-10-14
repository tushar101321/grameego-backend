import mongoose from "mongoose";

const deliveryRequestSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    villageName: { type: String, required: true },
    itemDescription: { type: String, required: true },
    contactNumber: { type: String, required: true },
    deliveryStatus: {
      type: String,
      enum: ["Pending", "Accepted", "Delivered", "Cancelled"],
      default: "Pending",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "deliveryRequests" }
);

export default mongoose.model("DeliveryRequest", deliveryRequestSchema);
