require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const multer  = require("multer");
const crypto  = require("crypto");
const { ethers } = require("ethers");
const fs      = require("fs");
const path    = require("path");

const app = express();

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Multer stores uploaded files in memory
const upload = multer({ storage: multer.memoryStorage() });

// ─── BLOCKCHAIN SETUP ─────────────────────────────────────

// Load ABI and contract address
const contractJSON    = require("./CertifyProABI.json");
const contractABI     = contractJSON.abi;
const deploymentInfo  = require("./contractAddress.json");
const CONTRACT_ADDRESS = deploymentInfo.contractAddress;

console.log("📋 Contract Address:", CONTRACT_ADDRESS);

// Connect to blockchain
const provider = new ethers.JsonRpcProvider(
  process.env.POLYGON_RPC || "http://127.0.0.1:8545"
);

// Wallet for writing to blockchain
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Two contract instances
const contractRead  = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
const contractWrite = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

// ─── HELPER FUNCTION ──────────────────────────────────────

// Generate SHA-256 hash from file buffer
function generateHash(fileBuffer) {
  const hashHex = crypto
    .createHash("sha256")
    .update(fileBuffer)
    .digest("hex");
  return "0x" + hashHex;
}

// ─── ROUTES ───────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "CertifyPro API is running ✅",
    contractAddress: CONTRACT_ADDRESS
  });
});

// Issue a certificate
app.post("/api/issue", upload.single("certificate"), async (req, res) => {
  try {
    // Check file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No certificate file uploaded" });
    }

    // Get form fields
    const { studentName, degree, university } = req.body;
    if (!studentName || !degree || !university) {
      return res.status(400).json({
        error: "Missing studentName, degree, or university"
      });
    }

    // Generate hash
    const certHash = generateHash(req.file.buffer);
    console.log("📄 Certificate hash:", certHash);

    // Store on blockchain
    console.log("⛓️  Writing to blockchain...");
    const tx = await contractWrite.issueCertificate(
      certHash,
      studentName,
      degree,
      university
    );

    console.log("⏳ Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt.blockNumber);

    res.json({
      success: true,
      certHash,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: `Certificate for ${studentName} stored on blockchain!`
    });

  } catch (error) {
    console.error("❌ Issue error:", error.message);
    if (error.message.includes("Certificate already issued")) {
      return res.status(400).json({
        error: "This certificate was already issued!"
      });
    }
    res.status(500).json({ error: error.message });
  }
});

// Verify a certificate by uploading PDF
app.post("/api/verify", upload.single("certificate"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No certificate file uploaded" });
    }

    // Hash the uploaded file
    const certHash = generateHash(req.file.buffer);
    console.log("🔍 Verifying hash:", certHash);

    // Query blockchain
    const result = await contractRead.verifyCertificate(certHash);
    const [isValid, studentName, degree, university, issuedAt, issuedBy] = result;

    if (!isValid) {
      return res.json({
        verified: false,
        message: "❌ Certificate NOT found on blockchain!"
      });
    }

    const issuedDate = new Date(Number(issuedAt) * 1000).toLocaleDateString();

    res.json({
      verified: true,
      message: "✅ Certificate is VERIFIED!",
      details: {
        studentName,
        degree,
        university,
        issuedDate,
        issuedBy,
        certHash
      }
    });

  } catch (error) {
    console.error("❌ Verify error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Verify by hash (used by QR code)
app.get("/api/verify/:hash", async (req, res) => {
  try {
    const certHash = req.params.hash;

    if (!certHash.startsWith("0x") || certHash.length !== 66) {
      return res.status(400).json({ error: "Invalid hash format" });
    }

    const result = await contractRead.verifyCertificate(certHash);
    const [isValid, studentName, degree, university, issuedAt, issuedBy] = result;

    if (!isValid) {
      return res.json({
        verified: false,
        message: "Certificate not found on blockchain"
      });
    }

    const issuedDate = new Date(Number(issuedAt) * 1000).toLocaleDateString();

    res.json({
      verified: true,
      details: {
        studentName,
        degree,
        university,
        issuedDate,
        issuedBy,
        certHash
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── START SERVER ─────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 CertifyPro API running at http://localhost:${PORT}`);
  console.log(`📋 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🌐 Network: ${process.env.POLYGON_RPC}\n`);
});