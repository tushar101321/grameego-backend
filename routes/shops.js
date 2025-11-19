// backend/routes/shops.js
import express from "express";
import jwt from "jsonwebtoken";
import shops from "../data/shops.js";
import Delivery from "../models/DeliveryRequest.js";

const router = express.Router();

// ---------- Public: list shops (for customers) ----------

// GET /api/shops
router.get("/", (_req, res) => {
  res.json(
    shops.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      productsCount: s.products.length,
    }))
  );
});

// GET /api/shops/:id  -> full shop info including products
router.get("/:id", (req, res) => {
  const s = shops.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ message: "Shop not found" });
  res.json(s);
});

// ---------- Auth helper for shop accounts ----------

function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : h;
    if (!token) return res.status(401).json({ message: "No token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, name, shopId? }
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

function requireShopRole(req, res, next) {
  if (!req.user || req.user.role !== "shop") {
    return res.status(403).json({ message: "Only shops can access this resource" });
  }
  if (!req.user.shopId) {
    return res
      .status(400)
      .json({ message: "Shop account is missing shopId mapping" });
  }
  next();
}

// ---------- Shop Panel Endpoints ----------

/**
 * GET /api/shops/my/orders
 * For logged-in shop accounts:
 * Returns all deliveries that target this shop (by shopId),
 * newest first.
 */
router.get("/my/orders", requireAuth, requireShopRole, async (req, res) => {
  try {
    const shopId = req.user.shopId;

    const list = await Delivery.find({ shopId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(list);
  } catch (e) {
    console.error("Shop my/orders error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PATCH /api/shops/my/orders/:id/confirm
 * body: { action: "accept" | "reject", note?: string }
 *
 * - Only the correct shop (matching shopId) can update its orders.
 * - Sets shopConfirmationStatus + shopConfirmationAt + optional note.
 */
router.patch(
  "/my/orders/:id/confirm",
  requireAuth,
  requireShopRole,
  async (req, res) => {
    try {
      const shopId = req.user.shopId;
      const { action, note } = req.body || {};

      if (!["accept", "reject"].includes(action)) {
        return res
          .status(400)
          .json({ message: "action must be 'accept' or 'reject'" });
      }

      const d = await Delivery.findById(req.params.id);
      if (!d) return res.status(404).json({ message: "Delivery not found" });

      if (d.shopId !== shopId) {
        return res
          .status(403)
          .json({ message: "This order does not belong to your shop" });
      }

      if (d.shopConfirmationStatus === "Rejected") {
        return res
          .status(400)
          .json({ message: "Order already rejected by shop" });
      }

      if (action === "accept") {
        d.shopConfirmationStatus = "Accepted";
        d.shopConfirmationAt = new Date();
        if (note) d.shopNote = String(note).slice(0, 300);
        // we do NOT auto-change deliveryStatus here; driver flow stays separate
      } else if (action === "reject") {
        d.shopConfirmationStatus = "Rejected";
        d.shopConfirmationAt = new Date();
        if (note) d.shopNote = String(note).slice(0, 300);

        // Optionally make it non-attractive to drivers:
        // keep deliveryStatus as "Pending" but with Rejected flag,
        // and we'll filter these from "available" list on driver side later if needed.
      }

      await d.save();

      return res.json({
        message: "Updated",
        delivery: {
          id: d._id,
          shopConfirmationStatus: d.shopConfirmationStatus,
          shopConfirmationAt: d.shopConfirmationAt,
          shopNote: d.shopNote,
        },
      });
    } catch (e) {
      console.error("Shop confirm error:", e);
      return res.status(500).json({ message: "Server error" });
    }
  }
);

export default router;
