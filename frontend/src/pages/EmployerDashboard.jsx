import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import jsQR from "jsqr";

function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const nodes = Array.from({ length: 40 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: 1.5 + Math.random() * 1.5, op: 0.2 + Math.random() * 0.35
    }));
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
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
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,212,255,${(1 - dist / 120) * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${nodes[i].op})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none" }} />;
}

function ScannerCorners() {
  const s = (pos) => {
    const base = { position: "absolute", width: "28px", height: "28px", borderColor: "#00d4ff", borderStyle: "solid" };
    const top = pos.includes("top") ? { top: 0, borderTopWidth: "3px" } : { bottom: 0, borderBottomWidth: "3px" };
    const side = pos.includes("left") ? { left: 0, borderLeftWidth: "3px", borderRightWidth: 0 } : { right: 0, borderRightWidth: "3px", borderLeftWidth: 0 };
    const radius = pos === "top-left" ? "6px 0 0 0" : pos === "top-right" ? "0 6px 0 0" : pos === "bottom-left" ? "0 0 0 6px" : "0 0 6px 0";
    return <div key={pos} style={{ ...base, ...top, ...side, borderRadius: radius }} />;
  };
  return <>{s("top-left")}{s("top-right")}{s("bottom-left")}{s("bottom-right")}</>;
}

const API = "http://localhost:3001";

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [mode, setMode] = useState("home");
  const [hashInput, setHashInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanLine, setScanLine] = useState(0);
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    if (user.role !== "employer") { navigate("/login"); return; }
    loadRecentFromAPI();
  }, []);

  async function loadRecentFromAPI() {
    setLoadingRecent(true);
    try {
      const res = await fetch(`${API}/api/certificates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // certificates endpoint is admin only, so we use verify endpoint
      // Just show empty for now — employer sees results after verifying
      setRecentVerifications([]);
    } catch (err) {
      console.error("Could not load recent:", err);
    } finally {
      setLoadingRecent(false);
    }
  }

  function addToRecent(result) {
    setRecentVerifications(prev => [{
      id: Date.now(),
      name: result.studentName || "Unknown",
      degree: result.degree || "Unknown",
      result: result.verified ? "verified" : "fake",
      hash: result.certHash || "",
      time: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    }, ...prev.slice(0, 4)]);
  }

  useEffect(() => {
    if (!cameraActive) return;
    let dir = 1, pos = 0;
    const interval = setInterval(() => {
      pos += dir * 1.5;
      if (pos >= 100) dir = -1;
      if (pos <= 0) dir = 1;
      setScanLine(pos);
    }, 16);
    return () => clearInterval(interval);
  }, [cameraActive]);

  async function startCamera() {
    setMode("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
      startQRScan();
    } catch {
      toast.error("Camera access denied. Try uploading a QR image instead.");
      setMode("home");
    }
  }

  function stopCamera() {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    setCameraActive(false);
    setMode("home");
  }

  function startQRScan() {
    scanIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== 4) return;
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code && code.data) {
        handleQRResult(code.data);
        clearInterval(scanIntervalRef.current);
      }
    }, 300);
  }

  function handleQRResult(data) {
    stopCamera();
    setScanning(true);
    toast.success("QR Code detected!");
    setTimeout(() => {
      setScanning(false);
      try {
        const url = new URL(data);
        const hash = url.searchParams.get("hash");
        if (hash) navigate(`/verify?hash=${hash}`);
        else navigate(`/verify?hash=${data}`);
      } catch { navigate(`/verify?hash=${data}`); }
    }, 1000);
  }

  function handleQRImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const imageData = canvas.getContext("2d").getImageData(0, 0, img.width, img.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code) { toast.success("QR code found!"); handleQRResult(code.data); }
        else toast.error("No QR code found in this image");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function handlePDFUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    toast.success("PDF uploaded! Extracting hash...");
    setScanning(true);
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      const certHash = "0x" + hashHex;
      setTimeout(() => {
        setScanning(false);
        navigate(`/verify?hash=${certHash}`);
      }, 1000);
    } catch {
      setScanning(false);
      toast.error("Could not process PDF");
    }
  }

  function handleManualVerify() {
    if (!hashInput || hashInput.length < 10) return toast.error("Enter a valid certificate hash");
    navigate(`/verify?hash=${hashInput.trim()}`);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    };
  }, []);

  const verifyOptions = [
    { id: "camera", icon: "📷", title: "Scan with Camera", subtitle: "Point camera at QR code", color: "#00d4ff", action: startCamera },
    { id: "upload", icon: "🖼️", title: "Upload QR Image", subtitle: "Upload a screenshot or photo", color: "#7ba8ff", action: () => fileInputRef.current?.click() },
    { id: "manual", icon: "⌨️", title: "Enter Hash Manually", subtitle: "Paste certificate hash directly", color: "#00ff88", action: () => setMode("manual") },
    { id: "pdf", icon: "📄", title: "Upload Certificate PDF", subtitle: "Hash extracted automatically", color: "#ffaa00", action: () => pdfInputRef.current?.click() },
  ];

  return (
    <div style={{ background: "#05080f", minHeight: "100vh", fontFamily: "sans-serif", position: "relative" }}>
      <ParticleCanvas />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(5,8,15,0.78)" }} />
      <div style={{ position: "fixed", top: "20%", left: "10%", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.07), transparent)", filter: "blur(60px)", zIndex: 1, pointerEvents: "none" }} />

      <Toaster position="top-right" toastOptions={{ style: { background: "#0e1320", color: "#f7f6f2", border: "1px solid rgba(255,255,255,0.1)" } }} />
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleQRImageUpload} />
      <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handlePDFUpload} />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: "700px", margin: "0 auto", padding: "3rem 1.5rem" }}>

        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: "2.5rem" }}>

          {/* Logout + user info top right */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#00aa55,#00ff88)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".8rem", fontWeight: 700, color: "#05080f" }}>
                {user.name ? user.name[0].toUpperCase() : "E"}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ color: "#f7f6f2", fontSize: ".8rem", fontWeight: 600 }}>{user.name || "Employer"}</div>
                <div style={{ color: "#6b7280", fontSize: ".7rem" }}>{user.email || ""}</div>
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={handleLogout}
              style={{ padding: ".4rem .9rem", borderRadius: "8px", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.08)", color: "#ff4444", cursor: "pointer", fontSize: ".78rem", fontWeight: 600 }}>
              🚪 Logout
            </motion.button>
          </div>

          <motion.div
            animate={{ boxShadow: ["0 0 15px rgba(0,212,255,0.2)", "0 0 30px rgba(0,212,255,0.4)", "0 0 15px rgba(0,212,255,0.2)"] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", padding: ".4rem 1.2rem", borderRadius: "20px", fontSize: ".73rem", color: "#00d4ff", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "1rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", display: "inline-block" }} />
            Employer Verification Portal
          </motion.div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 800, color: "#f7f6f2", letterSpacing: "-2px", margin: "0 0 .5rem", lineHeight: 1 }}>
            Verify a Certificate
          </h1>
          <p style={{ color: "#6b7280", fontSize: ".9rem" }}>Authenticate any certificate on the blockchain in seconds</p>
        </motion.div>

        <AnimatePresence mode="wait">

          {mode === "home" && (
            <motion.div key="home" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {verifyOptions.map((opt, i) => (
                  <motion.button key={opt.id}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    whileHover={{ x: 6, boxShadow: "0 20px 50px rgba(0,0,0,0.4)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={opt.action}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: "1.2rem", background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "1.4rem 1.6rem", cursor: "pointer", position: "relative", overflow: "hidden", textAlign: "left", transition: "all 0.3s" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${opt.color}44, transparent)` }} />
                    <div style={{ position: "absolute", left: 0, top: "15%", bottom: "15%", width: "3px", background: opt.color, borderRadius: "0 3px 3px 0", opacity: 0.8 }} />
                    <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `${opt.color}18`, border: `1px solid ${opt.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>
                      {opt.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem", marginBottom: "2px" }}>{opt.title}</div>
                      <div style={{ color: "#6b7280", fontSize: ".82rem" }}>{opt.subtitle}</div>
                    </div>
                    <div style={{ color: opt.color, fontSize: "1.1rem", opacity: 0.7 }}>→</div>
                  </motion.button>
                ))}
              </div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                style={{ marginTop: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".8rem" }}>
                  <div style={{ color: "#6b7280", fontSize: ".75rem", letterSpacing: "1px", textTransform: "uppercase" }}>
                    Recent Verifications This Session
                  </div>
                </div>

                {recentVerifications.length === 0 && (
                  <div style={{ textAlign: "center", padding: "1.5rem", color: "#6b7280", fontSize: ".82rem", background: "rgba(255,255,255,0.02)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    No verifications yet. Verify a certificate above!
                  </div>
                )}

                {recentVerifications.map((v, i) => (
                  <motion.div key={v.id || i}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: ".8rem 1.1rem", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", marginBottom: ".5rem", cursor: "pointer" }}
                    onClick={() => navigate(`/verify?hash=${v.hash}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: v.result === "verified" ? "rgba(0,255,136,0.1)" : "rgba(255,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".9rem" }}>
                        {v.result === "verified" ? "✅" : "❌"}
                      </div>
                      <div>
                        <div style={{ color: "#f7f6f2", fontSize: ".82rem", fontWeight: 600 }}>{v.name}</div>
                        <div style={{ color: "#6b7280", fontSize: ".72rem" }}>{v.degree}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: ".68rem", fontWeight: 700, textTransform: "uppercase", background: v.result === "verified" ? "rgba(0,255,136,0.1)" : "rgba(255,68,68,0.1)", color: v.result === "verified" ? "#00ff88" : "#ff6666", border: `1px solid ${v.result === "verified" ? "rgba(0,255,136,0.2)" : "rgba(255,68,68,0.2)"}` }}>
                        {v.result}
                      </span>
                      <div style={{ color: "#6b7280", fontSize: ".68rem", marginTop: "3px" }}>{v.time}</div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {mode === "camera" && (
            <motion.div key="camera" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.97), rgba(10,14,25,0.97))", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "24px", padding: "2rem", textAlign: "center", overflow: "hidden", position: "relative" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent)" }} />
                <div style={{ color: "#00d4ff", fontWeight: 700, fontSize: "1rem", marginBottom: ".3rem" }}>📷 Camera Scanner</div>
                <div style={{ color: "#6b7280", fontSize: ".82rem", marginBottom: "1.5rem" }}>Point camera at the QR code</div>
                <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", display: "inline-block", maxWidth: "100%", width: "380px", aspectRatio: "1", background: "#000" }}>
                  <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(5,8,15,0.4)" }} />
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "200px", height: "200px" }}>
                    <ScannerCorners />
                    {cameraActive && (
                      <motion.div style={{ position: "absolute", left: "5%", right: "5%", height: "2px", background: "linear-gradient(90deg, transparent, #00d4ff, transparent)", top: `${scanLine}%`, boxShadow: "0 0 10px rgba(0,212,255,0.8)" }} />
                    )}
                  </div>
                  <div style={{ position: "absolute", bottom: "12px", left: "50%", transform: "translateX(-50%)", background: "rgba(5,8,15,0.85)", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "20px", padding: "4px 14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                      style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff" }} />
                    <span style={{ color: "#00d4ff", fontSize: ".72rem", fontWeight: 700 }}>SCANNING...</span>
                  </div>
                </div>
                <div style={{ marginTop: "1.5rem" }}>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={stopCamera}
                    style={{ padding: ".65rem 1.5rem", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#6b7280", cursor: "pointer", fontSize: ".85rem", fontWeight: 700 }}>
                    Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "manual" && (
            <motion.div key="manual" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "24px", padding: "2rem", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,255,136,0.4), transparent)" }} />
                <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem", marginBottom: ".3rem" }}>⌨️ Enter Certificate Hash</div>
                <div style={{ color: "#6b7280", fontSize: ".82rem", marginBottom: "1.5rem" }}>Paste the 0x hash — will verify directly on blockchain</div>
                <input value={hashInput} onChange={e => setHashInput(e.target.value)}
                  placeholder="0x3f8ac21d7b04e9f2a831d50c..."
                  onKeyDown={e => e.key === "Enter" && handleManualVerify()}
                  style={{ width: "100%", padding: "1rem 1.1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", color: "#00d4ff", fontSize: ".875rem", outline: "none", fontFamily: "monospace", marginBottom: "1.2rem", boxSizing: "border-box", transition: "all 0.2s" }}
                  onFocus={e => { e.target.style.borderColor = "rgba(0,255,136,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(0,255,136,0.06)"; }}
                  onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                <div style={{ display: "flex", gap: ".8rem" }}>
                  <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(0,255,136,0.2)" }} whileTap={{ scale: 0.98 }}
                    onClick={handleManualVerify}
                    style={{ flex: 1, padding: ".9rem", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #00aa55, #00ff88)", color: "#05080f", fontWeight: 800, fontSize: ".9rem", cursor: "pointer" }}>
                    🔍 Verify on Blockchain
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setMode("home"); setHashInput(""); }}
                    style={{ padding: ".9rem 1.2rem", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#6b7280", cursor: "pointer", fontSize: ".85rem", fontWeight: 700 }}>
                    Back
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {scanning && (
            <motion.div key="scanning" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{ textAlign: "center", padding: "4rem 2rem" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                style={{ width: "60px", height: "60px", borderRadius: "50%", border: "3px solid rgba(0,212,255,0.2)", borderTopColor: "#00d4ff", margin: "0 auto 1.5rem" }} />
              <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1.1rem" }}>Processing...</div>
              <div style={{ color: "#6b7280", fontSize: ".85rem", marginTop: ".5rem" }}>Redirecting to blockchain verification...</div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: rgba(255,255,255,0.2); }`}</style>
    </div>
  );
}