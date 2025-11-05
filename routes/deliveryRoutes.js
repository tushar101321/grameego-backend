// routes/delivery.js
import express from "express";
import jwt from "jsonwebtoken";
import Delivery from "../models/delivery.js";

const router = express.Router();

// --- Minimal auth middleware for this router
function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : h;
    if (!token) return res.status(401).json({ message: "No token" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, name }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// --- POST /api/deliveries  (customer creates a request)
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can create requests" });
    }

    const { itemDescription, contactNumber, village } = req.body;
    if (!itemDescription || !contactNumber) {
      return res.status(400).json({ message: "itemDescription and contactNumber are required" });
    }

    // Use provided village or fall back to the user’s stored village (if you added it to profile/me)
    const v = village || req.body.village || "Unknown";

    const doc = await Delivery.create({
      createdBy: req.user.id,
      itemDescription,
      contactNumber,
      village: v,
    });

    return res.status(201).json(doc);
  } catch (e) {
    console.error("Create delivery error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --- GET /api/deliveries/mine  (customer sees own requests)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const list = await Delivery.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(list);
  } catch (e) {
    console.error("List mine error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// (Optional) keep your previous public GET if you had one:
// router.get("/", async (req,res)=>{ const all = await Delivery.find().sort({createdAt:-1}); res.json(all); });

export default router;
