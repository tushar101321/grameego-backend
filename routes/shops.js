// backend/routes/shops.js
import express from "express";
import shops from "../data/shops.js";

const router = express.Router();

// GET /api/shops
router.get("/", (_req, res) => {
  // Return shops without huge payload changes later
  res.json(shops.map(s => ({
    id: s.id,
    name: s.name,
    address: s.address,
    productsCount: s.products.length,
  })));
});

// GET /api/shops/:id
router.get("/:id", (req, res) => {
  const s = shops.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ message: "Shop not found" });
  res.json(s); // includes products
});

export default router;
