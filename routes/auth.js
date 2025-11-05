import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();

// helper: create JWT
function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

/**
 * @route  POST /api/auth/signup
 * @desc   Register new user (customer or driver)
 * @body   { name, mobile, password, role, village?, vehicleType? }
 */
router.post("/signup", async (req, res) => {
  try {
    const { name, mobile, password, role, village, vehicleType } = req.body;

    if (!name || !mobile || !password || !role) {
      return res.status(400).json({ message: "Missing required fields." });
    }
    if (!["customer", "driver"].includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(409).json({ message: "Mobile already registered." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      mobile,
      password: hashed,
      role,
      village,
      vehicleType,
    });

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        village: user.village || null,
        vehicleType: user.vehicleType || null,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * @route  POST /api/auth/login
 * @desc   Login with mobile + password
 * @body   { mobile, password }
 */
router.post("/login", async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({ message: "Missing mobile or password." });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
        village: user.village || null,
        vehicleType: user.vehicleType || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * @route  GET /api/auth/me
 * @desc   Return current user profile (requires Authorization: Bearer <token>)
 */
router.get("/me", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "No token provided." });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid token." });
    }

    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ user });
  } catch (err) {
    console.error("Me error:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
