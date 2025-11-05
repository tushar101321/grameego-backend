const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["customer", "driver"],
    required: true,
  },
  village: String,
  vehicleType: String,
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
