const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const { ethers } = require("ethers");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Certificate = require("./models/Certificate");

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// Blockchain Setup
const contractJSON = require("./CertChainABI.json");
const contractABI = contractJSON.abi;
const deploymentInfo = require("./contractAddress.json");
const CONTRACT_ADDRESS = deploymentInfo.contractAddress;

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC || "http://127.0.0.1:8545");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contractRead = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);
const contractWrite = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer);

console.log("📋 Contract:", CONTRACT_ADDRESS);

// Helper Functions
function generateHash(fileBuffer) {
  const hashHex = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  return "0x" + hashHex;
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-12345";

function generateToken(user) {
  return jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
}

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({
    status: "CertChain API Running",
    contract: CONTRACT_ADDRESS,
    mongo: mongoose.connection.readyState === 1
  });
});

// AUTH ROUTES
app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, role, organization, rollNumber, name, degree, company } = req.body;
    if (!email || !password || !role) return res.status(400).json({ error: "Missing fields" });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: "User exists" });

    const newUser = new User({ email: email.toLowerCase(), password, role, organization, rollNumber, name, degree, company });
    await newUser.save();
    const token = generateToken(newUser);

    res.json({ success: true, token, user: { id: newUser._id, email: newUser.email, role: newUser.role, name: newUser.name } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing email/password" });

    const user = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { rollNumber: email }
      ]
    });

    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isValid = await user.comparePassword(password);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    const token = generateToken(user);
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        organization: user.organization,
        company: user.company,
        rollNumber: user.rollNumber,
        degree: user.degree
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/verify", verifyToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// CERTIFICATE ROUTES
app.post("/api/issue", verifyToken, upload.single("certificate"), async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    if (!req.file) return res.status(400).json({ error: "No file" });

    const { studentName, degree, university } = req.body;
    if (!studentName || !degree || !university) return res.status(400).json({ error: "Missing fields" });

    const certHash = generateHash(req.file.buffer);
    console.log("📄 Hash:", certHash);

    const tx = await contractWrite.issueCertificate(certHash, studentName, degree, university);
    const receipt = await tx.wait();
    console.log("✅ Block:", receipt.blockNumber);

    const certificate = new Certificate({
      studentName,
      degree,
      university,
      certHash,
      issuedBy: signer.address,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    });
    await certificate.save();

    res.json({ success: true, certHash, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/verify", upload.single("certificate"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file" });

    const certHash = generateHash(req.file.buffer);
    const result = await contractRead.verifyCertificate(certHash);
    const [isValid, studentName, degree, university, issuedAt, issuedBy] = result;

    if (!isValid) return res.json({ verified: false });

    const issuedDate = new Date(Number(issuedAt) * 1000).toLocaleDateString();
    const certFromDB = await Certificate.findOne({ certHash });

    res.json({
      verified: true,
      details: { studentName, degree, university, issuedDate, issuedBy, certHash }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/verify/:hash", async (req, res) => {
  try {
    const certHash = req.params.hash;
    if (!certHash.startsWith("0x") || certHash.length !== 66) return res.status(400).json({ error: "Invalid hash" });

    const result = await contractRead.verifyCertificate(certHash);
    const [isValid, studentName, degree, university, issuedAt, issuedBy] = result;

    if (!isValid) return res.json({ verified: false });

    const issuedDate = new Date(Number(issuedAt) * 1000).toLocaleDateString();
    res.json({
      verified: true,
      details: { studentName, degree, university, issuedDate, issuedBy, certHash }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/student/certificates/:email", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ error: "Student only" });

    const { email } = req.params;
    const student = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { rollNumber: email }
      ],
      role: "student"
    });

    if (!student) return res.status(404).json({ error: "Not found" });

    const certificates = await Certificate.find({ studentName: student.name });
    const verifiedCerts = await Promise.all(certificates.map(async (cert) => {
      try {
        const result = await contractRead.verifyCertificate(cert.certHash);
        const [isValid] = result;
        return {
          id: cert._id,
          degree: cert.degree,
          university: cert.university,
          issuedDate: cert.issuedDate.toLocaleDateString("en-IN"),
          hash: cert.certHash,
          issuedBy: cert.issuedBy,
          status: isValid ? "verified" : "revoked",
          student: cert.studentName
        };
      } catch {
        return null;
      }
    }));

    res.json({ certificates: verifiedCerts.filter(Boolean) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// ADMIN creates a student account
app.post("/api/admin/create-student", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });

    const { name, rollNumber, email, password, degree, organization } = req.body;
    if (!name || !rollNumber || !password) return res.status(400).json({ error: "Name, roll number and password are required" });

    // Check if roll number already exists
    const existing = await User.findOne({ rollNumber });
    if (existing) return res.status(400).json({ error: "Roll number already registered" });

    const newStudent = new User({
      name,
      rollNumber,
      email: email || `${rollNumber}@certchain.edu`,
      password,
      role: "student",
      degree: degree || null,
      organization: organization || null
    });

    await newStudent.save();
    res.json({ success: true, message: "Student created!", student: { name, rollNumber, email: newStudent.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ADMIN issues certificate linked to student roll number
app.post("/api/admin/issue-to-student", verifyToken, upload.single("certificate"), async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { rollNumber, studentName, degree, university } = req.body;
    if (!rollNumber || !studentName || !degree || !university) return res.status(400).json({ error: "Missing fields" });

    // Find student
    const student = await User.findOne({ rollNumber, role: "student" });
    if (!student) return res.status(404).json({ error: "Student not found with this roll number" });

    const certHash = generateHash(req.file.buffer);

    const tx = await contractWrite.issueCertificate(certHash, studentName, degree, university);
    const receipt = await tx.wait();

    const certificate = new Certificate({
      studentName,
      rollNumber,
      degree,
      university,
      certHash,
      issuedBy: signer.address,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    });
    await certificate.save();

    res.json({ success: true, certHash, txHash: tx.hash, blockNumber: receipt.blockNumber });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET student certificates by roll number
app.get("/api/student/my-certificates", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ error: "Student only" });

    const student = await User.findById(req.user.id);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const certificates = await Certificate.find({ rollNumber: student.rollNumber }).sort({ createdAt: -1 });

    const verifiedCerts = await Promise.all(certificates.map(async (cert) => {
      try {
        const result = await contractRead.verifyCertificate(cert.certHash);
        const [isValid] = result;
        return {
          id: cert._id,
          studentName: cert.studentName,
          degree: cert.degree,
          university: cert.university,
          issuedDate: cert.issuedDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
          certHash: cert.certHash,
          txHash: cert.txHash,
          blockNumber: cert.blockNumber,
          issuedBy: cert.issuedBy,
          status: isValid ? "active" : "revoked",
          qrCode: cert.qrCode
        };
      } catch { return null; }
    }));

    res.json({ success: true, student: { name: student.name, rollNumber: student.rollNumber }, certificates: verifiedCerts.filter(Boolean) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all students (admin only)
app.get("/api/admin/students", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const students = await User.find({ role: "student" }).select("-password").sort({ createdAt: -1 });
    res.json({ success: true, students });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/certificates", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const certificates = await Certificate.find().sort({ createdAt: -1 });
    res.json({ certificates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 CertChain API at http://localhost:${PORT}`);
  console.log(`📋 Contract: ${CONTRACT_ADDRESS}`);
});