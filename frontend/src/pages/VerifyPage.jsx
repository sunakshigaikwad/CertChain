import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { getReadContract, generateCertHash } from "../utils/contract";

export default function VerifyPage() {
  const canvasRef = useRef(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hashInput, setHashInput] = useState("");

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

    const hashFromQR = searchParams.get("hash");
    if (hashFromQR) verifyByHash(hashFromQR);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] }, maxFiles: 1,
    onDrop: (files) => { setFile(files[0]); toast.success("File loaded!"); }
  });

  async function verifyByHash(certHash) {
    setLoading(true);
    try {
      const contract = await getReadContract();
      const res = await contract.verifyCertificate(certHash);
      const [isValid, studentName, degree, university, issuedAt, issuedBy] = res;
      if (!isValid) {
        navigate("/result", { state: { result: { verified: false } } });
      } else {
        const issuedDate = new Date(Number(issuedAt) * 1000).toLocaleDateString("en-IN", {
          day: "numeric", month: "long", year: "numeric"
        });
        navigate("/result", {
          state: {
            result: { verified: true, studentName, degree, university, issuedDate, issuedBy, certHash }
          }
        });
      }
    } catch (err) {
      toast.error("Verification failed: " + err.message.slice(0, 60));
    } finally { setLoading(false); }
  }

  async function handleVerifyFile() {
    if (!file) return toast.error("Upload a certificate PDF first");
    setLoading(true);
    try {
      const certHash = await generateCertHash(file);
      await verifyByHash(certHash);
    } catch (err) {
      toast.error(err.message);
      setLoading(false);
    }
  }

  async function handleVerifyHash() {
    if (!hashInput || hashInput.length !== 66) return toast.error("Enter a valid 0x... hash");
    await verifyByHash(hashInput.trim());
  }

  return (
    <div style={{ background: "#05080f", minHeight: "100vh", paddingTop: "80px", position: "relative", overflow: "hidden" }}>

      <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(5,8,15,0.7)" }} />
      <div style={{ position: "fixed", top: "10%", left: "5%", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.08), transparent)", filter: "blur(60px)", zIndex: 1, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "10%", right: "5%", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(26,76,255,0.1), transparent)", filter: "blur(50px)", zIndex: 1, pointerEvents: "none" }} />

      <Toaster position="top-right" toastOptions={{ style: { background: "#0e1320", color: "#f7f6f2", border: "1px solid rgba(255,255,255,0.1)" } }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: "760px", margin: "0 auto", padding: "3rem 2rem" }}>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: "3rem" }}>
          <motion.div
            animate={{ boxShadow: ["0 0 20px rgba(0,212,255,0.2)", "0 0 40px rgba(0,212,255,0.4)", "0 0 20px rgba(0,212,255,0.2)"] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", padding: ".4rem 1.2rem", borderRadius: "20px", fontSize: ".75rem", color: "#00d4ff", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "1.2rem" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", display: "inline-block" }} />
            Employer Verification Portal
          </motion.div>
          <h1 style={{ fontSize: "2.8rem", fontWeight: 700, color: "#f7f6f2", letterSpacing: "-2px", marginBottom: ".6rem", lineHeight: 1 }}>
            Verify Certificate
          </h1>
          <p style={{ color: "#6b7280", fontSize: "1rem" }}>
            Instantly check if a certificate is genuine on the blockchain
          </p>
        </motion.div>

        {/* Upload Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          whileHover={{ y: -2, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))",
            border: file ? "1px solid rgba(0,212,255,0.3)" : "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px", padding: "1.8rem", marginBottom: "1rem",
            backdropFilter: "blur(20px)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            position: "relative", overflow: "hidden", transition: "all 0.3s"
          }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>📂</div>
            <div>
              <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem" }}>Upload Certificate PDF</div>
              <div style={{ color: "#6b7280", fontSize: ".8rem" }}>System will recompute SHA-256 hash and verify on-chain</div>
            </div>
          </div>

          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? "#00d4ff" : "rgba(255,255,255,0.08)"}`,
            borderRadius: "14px", padding: "2.5rem 1rem",
            textAlign: "center", cursor: "pointer",
            background: isDragActive ? "rgba(0,212,255,0.05)" : "rgba(255,255,255,0.02)",
            transition: "all 0.2s"
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
                  <div style={{ color: "#f7f6f2", fontWeight: 600, marginBottom: "4px" }}>Drop certificate PDF here</div>
                  <div style={{ color: "#6b7280", fontSize: ".8rem" }}>or click to browse files</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0,212,255,0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleVerifyFile}
            disabled={loading || !file}
            style={{
              width: "100%", padding: "1rem", borderRadius: "12px", border: "none",
              background: loading || !file ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#0066cc,#00d4ff)",
              color: loading || !file ? "#6b7280" : "#fff",
              fontWeight: 700, fontSize: "1rem",
              cursor: loading || !file ? "not-allowed" : "pointer",
              marginTop: "1.2rem",
              boxShadow: file && !loading ? "0 8px 25px rgba(0,212,255,0.2)" : "none"
            }}>
            {loading ? "🔍 Verifying on blockchain..." : "✅ Verify Certificate"}
          </motion.button>
        </motion.div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.5rem 0" }}>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
          <span style={{ color: "#6b7280", fontSize: ".8rem", letterSpacing: "1px" }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.07)" }} />
        </div>

        {/* Hash Input Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          whileHover={{ y: -2, boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}
          style={{
            background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px", padding: "1.8rem", marginBottom: "2rem",
            backdropFilter: "blur(20px)", boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            position: "relative", overflow: "hidden"
          }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(26,76,255,0.4), transparent)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "1.5rem" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "rgba(26,76,255,0.08)", border: "1px solid rgba(26,76,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>🔗</div>
            <div>
              <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem" }}>Verify by Hash</div>
              <div style={{ color: "#6b7280", fontSize: ".8rem" }}>Paste a certificate hash directly from blockchain</div>
            </div>
          </div>

          <input
            type="text"
            placeholder="0x3f8ac21d7b04e9f2a831d50c..."
            value={hashInput}
            onChange={(e) => setHashInput(e.target.value)}
            style={{
              width: "100%", padding: ".9rem 1.1rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px", color: "#00d4ff",
              fontSize: ".85rem", outline: "none",
              fontFamily: "monospace", marginBottom: "1rem",
              transition: "all 0.2s",
              boxSizing: "border-box"
            }}
            onFocus={(e) => { e.target.style.borderColor = "rgba(26,76,255,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(26,76,255,0.08)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }}
          />

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(26,76,255,0.3)" }}
            whileTap={{ scale: 0.98 }}
            onClick={handleVerifyHash}
            disabled={loading}
            style={{
              width: "100%", padding: ".9rem", borderRadius: "10px",
              background: loading ? "rgba(255,255,255,0.05)" : "rgba(26,76,255,0.15)",
              color: loading ? "#6b7280" : "#7ba8ff",
              fontWeight: 700, fontSize: ".9rem",
              cursor: loading ? "not-allowed" : "pointer",
              border: "1px solid rgba(26,76,255,0.25)"
            }}>
            {loading ? "🔍 Verifying..." : "🔍 Verify by Hash"}
          </motion.button>
        </motion.div>

        <style>{`input::placeholder { color: rgba(255,255,255,0.2); }`}</style>
      </div>
    </div>
  );
}