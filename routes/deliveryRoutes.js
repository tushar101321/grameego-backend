import express from "express";
import DeliveryRequest from "../models/DeliveryRequest.js";

const router = express.Router();

// Create a new delivery request
router.post("/", async (req, res) => {
  try {
    const newRequest = new DeliveryRequest(req.body);
    const saved = await newRequest.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all delivery requests
router.get("/", async (req, res) => {
  try {
    const requests = await DeliveryRequest.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
