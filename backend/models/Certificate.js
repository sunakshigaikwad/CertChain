const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
  studentName: { type: String, required: true },
  rollNumber: { type: String, default: null },
  degree: { type: String, required: true },
  university: { type: String, required: true },
  certHash: { type: String, required: true, unique: true },
  issuedBy: { type: String, required: true },
  issuedDate: { type: Date, default: Date.now },
  txHash: { type: String, default: null },
  blockNumber: { type: Number, default: null },
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  qrCode: { type: String, default: null },
  ipfsHash: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Certificate", certificateSchema);