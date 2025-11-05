// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import deliveryRoutes from "./routes/delivery.js";
import authRoutes from "./routes/auth.js";
import shopsRoutes from "./routes/shops.js";

dotenv.config();

const app = express();

// --- CORS ---
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://grameego-frontend.onrender.com"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false
}));
app.options("*", cors());

// --- Body parser ---
app.use(express.json());

// --- Routes ---
app.use("/api/shops", shopsRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/auth", authRoutes);

// --- Root endpoint ---
app.get("/", (_req, res) => {
  res.send("✅ GrameeGo Backend is running!");
});

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
  });
