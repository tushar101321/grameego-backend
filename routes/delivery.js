// backend/routes/delivery.js
import express from "express";
import jwt from "jsonwebtoken";
import Delivery from "../models/DeliveryRequest.js";

const router = express.Router();

// --- Auth middleware ---
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

// --- Pricing helper (driver payout / delivery fee approximation) ---
function computePrice(distanceKm) {
  if (typeof distanceKm === "number" && !Number.isNaN(distanceKm) && distanceKm > 0) {
    const price = 2 + 0.6 * distanceKm;
    return Math.max(3, Math.round(price * 100) / 100);
  }
  return 4.0;
}

// --------------------------------------------------------
// POST /api/deliveries
// Customer creates a delivery request
// --------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can create requests" });
    }

    const {
      itemDescription,
      contactNumber,
      village,
      shopName,
      shopAddress,
      estimatedDistanceKm,
      needByAt,

      // from frontend basket snapshot (optional but we support it)
      items,
      productTotal,
      deliveryFee,
      grandTotal,

      // logical shop identifier (must match shops.js id when using static shops)
      shopId,
    } = req.body;

    if (!itemDescription || !contactNumber || !shopName || !shopAddress) {
      return res.status(400).json({
        message:
          "itemDescription, contactNumber, shopName and shopAddress are required",
      });
    }

    const finalVillage =
      (village || "").trim() ||
      ""; // if you want: || (await find user village) but keeping simple

    if (!finalVillage) {
      return res.status(400).json({ message: "village is required" });
    }

    // distance + pricing
    const dist =
      estimatedDistanceKm == null || estimatedDistanceKm === ""
        ? null
        : Number(estimatedDistanceKm);

    const computedPrice = computePrice(
      typeof dist === "number" && !Number.isNaN(dist) ? dist : null
    );

    // Parse needByAt if provided
    let needByDate = null;
    if (needByAt) {
      const t = new Date(needByAt);
      if (Number.isNaN(t.getTime())) {
        return res.status(400).json({ message: "Invalid needByAt datetime" });
      }
      needByDate = t;
    }

    // Normalize optional items snapshot safely
    const safeItems = Array.isArray(items)
      ? items.map((it) => ({
          id: String(it.id || ""),
          name: String(it.name || ""),
          qty: Number.isFinite(+it.qty) ? +it.qty : 0,
          price: Number.isFinite(+it.price) ? +it.price : 0,
        }))
      : [];

    const safeProductTotal =
      typeof productTotal === "number" && !Number.isNaN(productTotal)
        ? productTotal
        : null;

    const safeDeliveryFee =
      typeof deliveryFee === "number" && !Number.isNaN(deliveryFee)
        ? deliveryFee
        : null;

    const safeGrandTotal =
      typeof grandTotal === "number" && !Number.isNaN(grandTotal)
        ? grandTotal
        : null;

    const doc = await Delivery.create({
      createdBy: req.user.id,

      itemDescription,
      contactNumber,
      village: finalVillage,

      shopName,
      shopAddress,
      shopId: shopId || null,

      estimatedDistanceKm:
        typeof dist === "number" && !Number.isNaN(dist) ? dist : null,

      // "price" kept as server-side computed delivery payout baseline
      price: computedPrice,

      needByAt: needByDate,

      // shop confirmation workflow: starts as Pending
      shopConfirmationStatus: "Pending",
      shopConfirmationAt: null,
      shopNote: "",

      // basket snapshot
      items: safeItems,
      productTotal: safeProductTotal,
      deliveryFee: safeDeliveryFee,
      grandTotal: safeGrandTotal,
    });

    return res.status(201).json(doc);
  } catch (e) {
    console.error("Create delivery error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --------------------------------------------------------
// GET /api/deliveries/mine  (customer views own)
// --------------------------------------------------------
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const list = await Delivery.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .populate("assignedDriver", "name mobile")
      .lean();

    return res.json(list);
  } catch (e) {
    console.error("List mine error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --------------------------------------------------------
// GET /api/deliveries/available  (driver views pending jobs)
// For now: all Pending requests, regardless of shopConfirmationStatus.
// Later we can restrict to Accepted only if you want stricter flow.
// --------------------------------------------------------
router.get("/available", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Only drivers can view available requests" });
    }

    const list = await Delivery.find({ deliveryStatus: "Pending" })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(list);
  } catch (e) {
    console.error("Available error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --------------------------------------------------------
// POST /api/deliveries/:id/accept  (driver accepts an unassigned job)
// --------------------------------------------------------
router.post("/:id/accept", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Only drivers can accept requests" });
    }

    const id = req.params.id;

    const updated = await Delivery.findOneAndUpdate(
      { _id: id, deliveryStatus: "Pending", assignedDriver: { $exists: false } },
      { $set: { deliveryStatus: "Assigned", assignedDriver: req.user.id } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(409).json({ message: "This request has already been taken." });
    }

    return res.json(updated);
  } catch (e) {
    console.error("Accept delivery error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --------------------------------------------------------
// PATCH /api/deliveries/:id/status  (driver updates to Picked/Delivered)
// --------------------------------------------------------
router.patch("/:id/status", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Only drivers can update status" });
    }

    const { newStatus } = req.body;
    if (!["Picked", "Delivered"].includes(newStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const d = await Delivery.findById(req.params.id);
    if (!d) return res.status(404).json({ message: "Delivery not found" });

    if (!d.assignedDriver || String(d.assignedDriver) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not your assignment" });
    }

    const order = ["Assigned", "Picked", "Delivered"];
    const currentIdx = order.indexOf(d.deliveryStatus);
    const nextIdx = order.indexOf(newStatus);
    if (nextIdx < currentIdx) {
      return res.status(400).json({ message: "Cannot move status backwards" });
    }

    d.deliveryStatus = newStatus;
    await d.save();

    return res.json({ message: "Updated", delivery: d });
  } catch (e) {
    console.error("Status update error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --------------------------------------------------------
// GET /api/deliveries/assigned-to-me  (driver: list my jobs)
// --------------------------------------------------------
router.get("/assigned-to-me", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Only drivers can view assigned jobs" });
    }

    const list = await Delivery.find({ assignedDriver: req.user.id })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json(list);
  } catch (e) {
    console.error("Assigned-to-me error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --------------------------------------------------------
// DELETE /api/deliveries/:id  (customer cancels PENDING only)
// --------------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "customer") {
      return res.status(403).json({ message: "Only customers can cancel" });
    }

    const d = await Delivery.findById(req.params.id);
    if (!d) return res.status(404).json({ message: "Not found" });

    if (String(d.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not your request" });
    }

    if (d.deliveryStatus !== "Pending") {
      return res.status(400).json({ message: "Only Pending requests can be cancelled" });
    }

    await d.deleteOne();
    return res.json({ message: "Cancelled" });
  } catch (e) {
    console.error("Cancel error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

// --------------------------------------------------------
// POST /api/deliveries/:id/unassign
// Driver releases an "Assigned" job back to Pending
// --------------------------------------------------------
router.post("/:id/unassign", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ message: "Only drivers can unassign" });
    }

    const d = await Delivery.findById(req.params.id);
    if (!d) return res.status(404).json({ message: "Not found" });

    if (!d.assignedDriver || String(d.assignedDriver) !== String(req.user.id)) {
      return res.status(403).json({ message: "Not your assignment" });
    }

    if (d.deliveryStatus !== "Assigned") {
      return res.status(400).json({
        message: "You can only unassign while status is Assigned",
      });
    }

    d.assignedDriver = undefined;
    d.deliveryStatus = "Pending";
    await d.save();

    return res.json({ message: "Unassigned", delivery: d });
  } catch (e) {
    console.error("Unassign error:", e);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
