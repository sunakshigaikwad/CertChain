import { useState, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "qrcode";
import { getWriteContract, generateCertHash } from "../utils/contract";

export default function IssuePage() {
  const canvasRef = useRef(null);
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({ studentName: "", degree: "", university: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [walletAddress, setWalletAddress] = useState("");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let W = canvas.width, H = canvas.height;
    let mouseX = W / 2, mouseY = H / 2;
    const nodes = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: 1.5 + Math.random() * 2, op: 0.3 + Math.random() * 0.5
    }));
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onMouse = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouse);
    let animId;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,212,255,${(1 - dist / 140) * 0.4})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        const md = Math.sqrt((nodes[i].x - mouseX) ** 2 + (nodes[i].y - mouseY) ** 2);
        const glow = md < 150 ? (1 - md / 150) : 0;
        if (glow > 0.1) {
          ctx.beginPath();
          ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r + glow * 10, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,212,255,${glow * 0.15})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r + glow * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${nodes[i].op})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); window.removeEventListener("mousemove", onMouse); };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] }, maxFiles: 1,
    onDrop: (files) => { setFile(files[0]); toast.success("Certificate loaded!"); }
  });

  async function connectWallet() {
    try {
      if (!window.ethereum) throw new Error("MetaMask not found!");
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWalletAddress(accounts[0]);
      toast.success("Wallet connected!");
    } catch (err) { toast.error(err.message); }
  }

  async function handleIssue() {
    if (!file) return toast.error("Upload a PDF first");
    if (!walletAddress) return toast.error("Connect MetaMask first");
    if (!formData.studentName) return toast.error("Enter student name");
    if (!formData.degree) return toast.error("Enter degree");
    if (!formData.university) return toast.error("Enter university");
    setLoading(true);
    try {
      toast.loading("Generating SHA-256 hash...", { id: "tx" });
      const certHash = await generateCertHash(file);
      toast.loading("Check MetaMask popup...", { id: "tx" });
      const contract = await getWriteContract();
      const tx = await contract.issueCertificate(certHash, formData.studentName, formData.degree, formData.university);
      toast.loading("Confirming on blockchain...", { id: "tx" });
      const receipt = await tx.wait();
      toast.success("Issued on blockchain!", { id: "tx" });
      const verifyURL = window.location.origin + "/verify?hash=" + certHash;
      const qrDataURL = await QRCode.toDataURL(verifyURL, { width: 200, margin: 1 });
      setResult({ certHash, txHash: tx.hash, blockNumber: receipt.blockNumber, qrCode: qrDataURL });
    } catch (err) {
      if (err.message.includes("already issued")) toast.error("Already issued!", { id: "tx" });
      else if (err.message.includes("user rejected")) toast.error("Rejected!", { id: "tx" });
      else toast.error(err.message.slice(0, 60), { id: "tx" });
    } finally { setLoading(false); }
  }

  const steps = [
    { n: 1, done: !!walletAddress, active: !walletAddress },
    { n: 2, done: !!(formData.studentName && formData.degree && formData.university), active: !!walletAddress },
    { n: 3, done: !!file, active: !!(formData.studentName && formData.degree && formData.university) },
  ];

  return (
    <div style={{ background: "#05080f", minHeight: "100vh", paddingTop: "80px", position: "relative", overflow: "hidden" }}>

      {/* Particles */}
      <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none" }} />

      {/* Dark overlay */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(5,8,15,0.7)" }} />

      {/* Glow blobs */}
      <div style={{ position: "fixed", top: "10%", right: "5%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(26,76,255,0.12), transparent)", filter: "blur(60px)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "10%", left: "5%", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.08), transparent)", filter: "blur(50px)", zIndex: 1, pointerEvents: "none" }} />

      <Toaster position="top-right" toastOptions={{ style: { background: "#0e1320", color: "#f7f6f2", border: "1px solid rgba(255,255,255,0.1)" } }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: "760px", margin: "0 auto", padding: "3rem 2rem" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: "3rem" }}>
          <motion.div
            animate={{ boxShadow: ["0 0 20px rgba(26,76,255,0.3)", "0 0 40px rgba(0,212,255,0.4)", "0 0 20px rgba(26,76,255,0.3)"] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(26,76,255,0.12)", border: "1px solid rgba(26,76,255,0.35)", padding: ".4rem 1.2rem", borderRadius: "20px", fontSize: ".75rem", color: "#7ba8ff", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "1.2rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", display: "inline-block", animation: "pulse 1.5s infinite" }} />
            University Admin Portal
          </motion.div>
          <h1 style={{ fontSize: "2.8rem", fontWeight: 700, color: "#f7f6f2", letterSpacing: "-2px", marginBottom: ".6rem", lineHeight: 1 }}>
            Issue Certificate
          </h1>
          <p style={{ color: "#6b7280", fontSize: "1rem" }}>
            Store a tamper-proof hash permanently on Polygon blockchain
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", marginBottom: "2.5rem" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "50%",
                background: s.done ? "linear-gradient(135deg,#00d4ff,#1a4cff)" : s.active ? "rgba(26,76,255,0.2)" : "rgba(255,255,255,0.05)",
                border: s.done ? "none" : s.active ? "1px solid #1a4cff" : "1px solid rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ".85rem", fontWeight: 700,
                color: s.done ? "#fff" : s.active ? "#7ba8ff" : "#6b7280",
                transition: "all 0.3s"
              }}>
                {s.done ? "✓" : s.n}
              </div>
              {i < steps.length - 1 && (
                <div style={{ width: "80px", height: "1px", background: s.done ? "linear-gradient(90deg,#00d4ff,#1a4cff)" : "rgba(255,255,255,0.08)", transition: "all 0.3s" }} />
              )}
            </div>
          ))}
        </motion.div>

        {/* Step 1: Connect Wallet */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          whileHover={{ y: -2, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))",
            border: walletAddress ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px", padding: "1.8rem", marginBottom: "1rem",
            backdropFilter: "blur(20px)",
            boxShadow: walletAddress ? "0 0 30px rgba(0,212,255,0.1), 0 20px 40px rgba(0,0,0,0.4)" : "0 20px 40px rgba(0,0,0,0.4)",
            transition: "all 0.3s", position: "relative", overflow: "hidden"
          }}>

          {/* Card shimmer line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "14px",
                background: walletAddress ? "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(26,76,255,0.2))" : "rgba(255,255,255,0.05)",
                border: walletAddress ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.3rem"
              }}>🦊</div>
              <div>
                <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem", marginBottom: "3px" }}>Connect MetaMask Wallet</div>
                <div style={{ color: "#6b7280", fontSize: ".8rem" }}>
                  {walletAddress ? (
                    <span style={{ color: "#00d4ff", fontFamily: "monospace" }}>{walletAddress.slice(0, 8)}...{walletAddress.slice(-6)} ✓</span>
                  ) : "Authorize your university wallet to issue certificates"}
                </div>
              </div>
            </div>
            {!walletAddress ? (
              <motion.button whileHover={{ scale: 1.05, boxShadow: "0 0 25px rgba(26,76,255,0.5)" }} whileTap={{ scale: 0.95 }}
                onClick={connectWallet}
                style={{ background: "linear-gradient(135deg,#1a4cff,#0066ff)", color: "#fff", border: "none", padding: ".65rem 1.4rem", borderRadius: "10px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                Connect →
              </motion.button>
            ) : (
              <div style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "8px", padding: ".4rem .8rem", color: "#00d4ff", fontSize: ".8rem", fontWeight: 600 }}>
                ✓ Connected
              </div>
            )}
          </div>
        </motion.div>

        {/* Step 2: Certificate Details */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          whileHover={{ y: -2, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px", padding: "1.8rem", marginBottom: "1rem",
            backdropFilter: "blur(20px)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            position: "relative", overflow: "hidden"
          }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(26,76,255,0.4), transparent)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(26,76,255,0.12)", border: "1px solid rgba(26,76,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>📋</div>
            <div>
              <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem" }}>Certificate Details</div>
              <div style={{ color: "#6b7280", fontSize: ".8rem" }}>Enter the graduate's information</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {[
              { key: "studentName", placeholder: "Student Full Name", icon: "👤", label: "Student Name" },
              { key: "degree", placeholder: "e.g. B.Tech Computer Science", icon: "🎓", label: "Degree / Programme" },
              { key: "university", placeholder: "e.g. IIT Bombay", icon: "🏛️", label: "University / Institution" }
            ].map((field) => (
              <div key={field.key}>
                <label style={{ display: "block", color: "#6b7280", fontSize: ".75rem", marginBottom: "6px", letterSpacing: ".5px", textTransform: "uppercase" }}>{field.icon} {field.label}</label>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={formData[field.key]}
                  onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                  style={{
                    width: "100%", padding: ".85rem 1.1rem",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "10px", color: "#f7f6f2",
                    fontSize: ".9rem", outline: "none", transition: "all 0.2s"
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(0,212,255,0.4)"; e.target.style.background = "rgba(0,212,255,0.04)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.background = "rgba(255,255,255,0.04)"; e.target.style.boxShadow = "none"; }}
                />
              </div>
            ))}
          </div>
        </motion.div>

        {/* Step 3: Upload PDF */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          whileHover={{ y: -2, boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))",
            border: file ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px", padding: "1.8rem", marginBottom: "1.5rem",
            backdropFilter: "blur(20px)",
            boxShadow: file ? "0 0 30px rgba(0,212,255,0.08), 0 20px 40px rgba(0,0,0,0.4)" : "0 20px 40px rgba(0,0,0,0.4)",
            position: "relative", overflow: "hidden", transition: "all 0.3s"
          }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>📄</div>
            <div>
              <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem" }}>Upload Certificate PDF</div>
              <div style={{ color: "#6b7280", fontSize: ".8rem" }}>SHA-256 hash will be generated automatically</div>
            </div>
          </div>

          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? "#00d4ff" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "14px", padding: "2.5rem 1rem", textAlign: "center", cursor: "pointer",
            background: isDragActive ? "rgba(0,212,255,0.05)" : "rgba(255,255,255,0.02)",
            transition: "all 0.2s", position: "relative"
          }}>
            <input {...getInputProps()} />
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", margin: "0 auto .8rem" }}>📄</div>
                  <div style={{ color: "#00d4ff", fontWeight: 700, marginBottom: "4px" }}>{file.name}</div>
                  <div style={{ color: "#6b7280", fontSize: ".8rem" }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", margin: "0 auto .8rem" }}>☁️</div>
                  <div style={{ color: "#f7f6f2", fontWeight: 600, marginBottom: "4px" }}>Drop PDF here</div>
                  <div style={{ color: "#6b7280", fontSize: ".8rem" }}>or click to browse files</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Issue Button */}
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: "0 0 40px rgba(26,76,255,0.5), 0 20px 40px rgba(0,0,0,0.4)" }}
          whileTap={{ scale: 0.98 }}
          onClick={handleIssue}
          disabled={loading}
          style={{
            width: "100%", padding: "1.1rem", borderRadius: "14px", border: "none",
            background: loading ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#1a4cff,#00aaff)",
            color: loading ? "#6b7280" : "#fff",
            fontWeight: 700, fontSize: "1.05rem", cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "2rem", position: "relative", overflow: "hidden",
            boxShadow: loading ? "none" : "0 8px 30px rgba(26,76,255,0.3)"
          }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", transform: "translateX(-100%)", animation: loading ? "none" : "shimmer 2s infinite" }} />
          {loading ? "⏳ Processing Transaction..." : "⛓️ Issue Certificate on Blockchain"}
        </motion.button>

        <style>{`
          @keyframes shimmer { to { transform: translateX(100%); } }
          @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(0,212,255,.6);} 50%{box-shadow:0 0 0 6px rgba(0,212,255,0);} }
          input::placeholder { color: rgba(255,255,255,0.2); }
        `}</style>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 150, damping: 20 }}
              style={{
                background: "linear-gradient(135deg, rgba(0,212,255,0.06), rgba(26,76,255,0.06))",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: "20px", padding: "2rem",
                backdropFilter: "blur(20px)",
                boxShadow: "0 0 40px rgba(0,212,255,0.1), 0 30px 60px rgba(0,0,0,0.5)",
                position: "relative", overflow: "hidden"
              }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: "linear-gradient(90deg,#1a4cff,#00d4ff,#1a4cff)" }} />

              <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "1.8rem" }}>
                <motion.div
                  animate={{ scale: [1, 1.1, 1], boxShadow: ["0 0 0 0 rgba(0,212,255,0.4)", "0 0 0 10px rgba(0,212,255,0)", "0 0 0 0 rgba(0,212,255,0)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                  ✅
                </motion.div>
                <div>
                  <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1.2rem" }}>Certificate Issued!</div>
                  <div style={{ color: "#6b7280", fontSize: ".82rem" }}>Permanently stored on Polygon blockchain</div>
                </div>
              </div>

              <div style={{ display: "grid", gap: "10px", marginBottom: "1.5rem" }}>
                {[
                  { label: "🔐 Certificate Hash", value: result.certHash, color: "#00d4ff" },
                  { label: "⛓️ Transaction Hash", value: result.txHash, color: "#7ba8ff" },
                  { label: "📦 Block Number", value: String(result.blockNumber), color: "#f7f6f2", short: true },
                ].map((item) => (
                  <motion.div key={item.label} whileHover={{ scale: 1.01, borderColor: "rgba(0,212,255,0.3)" }}
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "12px", padding: "1rem 1.2rem", cursor: "default", transition: "all 0.2s" }}>
                    <div style={{ color: "#6b7280", fontSize: ".72rem", marginBottom: "5px", letterSpacing: ".5px", textTransform: "uppercase" }}>{item.label}</div>
                    <div style={{ color: item.color, fontFamily: "monospace", fontSize: item.short ? "1.1rem" : ".72rem", wordBreak: "break-all", fontWeight: item.short ? 700 : 400 }}>{item.value}</div>
                  </motion.div>
                ))}
              </div>

              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "1.5rem", textAlign: "center" }}>
                <div style={{ color: "#6b7280", fontSize: ".82rem", marginBottom: "1.2rem", letterSpacing: ".5px", textTransform: "uppercase" }}>📱 QR Code for Verification</div>
                <motion.div whileHover={{ scale: 1.03 }} style={{ display: "inline-block", background: "#fff", padding: "14px", borderRadius: "14px", marginBottom: "1.2rem", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
                  <img src={result.qrCode} alt="QR" style={{ width: "160px", height: "160px", display: "block" }} />
                </motion.div>
                <br />
                <motion.a whileHover={{ scale: 1.05 }} href={result.qrCode} download="certchain-qr.png"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg,rgba(26,76,255,0.2),rgba(0,212,255,0.1))", border: "1px solid rgba(26,76,255,0.35)", color: "#7ba8ff", padding: ".7rem 1.6rem", borderRadius: "10px", textDecoration: "none", fontSize: ".85rem", fontWeight: 700 }}>
                  ⬇ Download QR Code
                </motion.a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}