import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [show, setShow] = useState(false);

  const result = location.state?.result;

  useEffect(() => {
    if (!result) { navigate("/verify"); return; }
    setTimeout(() => setShow(true), 300);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let W = canvas.width, H = canvas.height;
    let mouseX = W / 2, mouseY = H / 2;
    const nodes = Array.from({ length: 60 }, () => ({
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
            ctx.strokeStyle = `rgba(${result?.verified ? "0,255,100" : "255,50,50"},${(1 - dist / 140) * 0.3})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        const md = Math.sqrt((nodes[i].x - mouseX) ** 2 + (nodes[i].y - mouseY) ** 2);
        const glow = md < 150 ? (1 - md / 150) : 0;
        ctx.beginPath();
        ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r + glow * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${result?.verified ? "0,255,100" : "255,50,50"},${nodes[i].op})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  if (!result) return null;

  const isValid = result.verified;
  const accent = isValid ? "#00ff88" : "#ff4444";
  const accentDim = isValid ? "rgba(0,255,100,0.15)" : "rgba(255,50,50,0.15)";
  const accentBorder = isValid ? "rgba(0,255,100,0.25)" : "rgba(255,50,50,0.25)";
  const gradTop = isValid ? "rgba(0,255,100,0.08)" : "rgba(255,50,50,0.08)";

  return (
    <div style={{ background: "#05080f", minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>

      <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", zIndex: 0, pointerEvents: "none" }} />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(5,8,15,0.75)" }} />

      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 4, repeat: Infinity }}
        style={{ position: "fixed", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "600px", borderRadius: "50%", background: `radial-gradient(circle, ${isValid ? "rgba(0,255,100,0.12)" : "rgba(255,50,50,0.12)"}, transparent)`, filter: "blur(60px)", zIndex: 1, pointerEvents: "none" }}
      />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: "680px" }}>
        <AnimatePresence>
          {show && (
            <motion.div
              initial={{ opacity: 0, y: 60, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            >

              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.98), rgba(8,12,22,0.98))", border: `1px solid ${accentBorder}`, borderRadius: "24px", overflow: "hidden", backdropFilter: "blur(30px)", boxShadow: `0 0 60px ${isValid ? "rgba(0,255,100,0.12)" : "rgba(255,50,50,0.12)"}, 0 40px 80px rgba(0,0,0,0.6)` }}>

                <div style={{ height: "3px", background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />

                <div style={{ padding: "3rem 2.5rem 2rem", textAlign: "center", background: `linear-gradient(180deg, ${gradTop}, transparent)` }}>

                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
                    style={{ display: "inline-block", marginBottom: "1.5rem" }}
                  >
                    <motion.div
                      animate={{ boxShadow: [`0 0 0 0 ${isValid ? "rgba(0,255,100,0.4)" : "rgba(255,50,50,0.4)"}`, `0 0 0 20px ${isValid ? "rgba(0,255,100,0)" : "rgba(255,50,50,0)"}`, `0 0 0 0 ${isValid ? "rgba(0,255,100,0)" : "rgba(255,50,50,0)"}`] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ width: "100px", height: "100px", borderRadius: "50%", background: accentDim, border: `2px solid ${accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}
                    >
                      {isValid ? "✅" : "❌"}
                    </motion.div>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                    <div style={{ fontSize: "3rem", fontWeight: 800, color: accent, letterSpacing: "-2px", marginBottom: ".4rem", lineHeight: 1 }}>
                      {isValid ? "VERIFIED" : "FAKE DETECTED"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: ".95rem" }}>
                      {isValid
                        ? "This certificate is authentic and exists on the Polygon blockchain"
                        : "This certificate was NOT found on the blockchain — it may be tampered or fake"}
                    </div>
                  </motion.div>
                </div>

                {isValid ? (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ padding: "0 2.5rem 2.5rem" }}>

                    <div style={{ marginBottom: "1.2rem" }}>
                      <div style={{ color: "#6b7280", fontSize: ".72rem", letterSpacing: "2px", textTransform: "uppercase", marginBottom: ".8rem" }}>📋 Certificate Details</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        {[
                          { icon: "👤", label: "Student Name", value: result.studentName },
                          { icon: "🎓", label: "Degree", value: result.degree },
                          { icon: "🏛️", label: "University", value: result.university },
                          { icon: "📅", label: "Issue Date", value: result.issuedDate },
                        ].map((item) => (
                          <motion.div key={item.label} whileHover={{ scale: 1.02, borderColor: "rgba(0,255,100,0.25)" }}
                            style={{ background: "rgba(0,255,100,0.04)", border: "1px solid rgba(0,255,100,0.1)", borderRadius: "14px", padding: "1rem 1.2rem", transition: "all 0.2s" }}>
                            <div style={{ fontSize: ".7rem", color: "rgba(0,255,100,0.5)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "5px" }}>
                              {item.icon} {item.label}
                            </div>
                            <div style={{ color: "#f7f6f2", fontWeight: 600, fontSize: ".9rem" }}>{item.value}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginBottom: "1.2rem" }}>
                      <div style={{ color: "#6b7280", fontSize: ".72rem", letterSpacing: "2px", textTransform: "uppercase", marginBottom: ".8rem" }}>⛓️ Blockchain Proof</div>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "1.2rem", marginBottom: "10px" }}>
                        <div style={{ color: "#6b7280", fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "6px" }}>🔐 Certificate Hash</div>
                        <div style={{ color: "#00d4ff", fontFamily: "monospace", fontSize: ".72rem", wordBreak: "break-all" }}>{result.certHash}</div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px", padding: "1.2rem" }}>
                        <div style={{ color: "#6b7280", fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "6px" }}>🔑 Issued By (Wallet)</div>
                        <div style={{ color: "#7ba8ff", fontFamily: "monospace", fontSize: ".72rem", wordBreak: "break-all" }}>{result.issuedBy}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <motion.a
                        whileHover={{ scale: 1.03, boxShadow: "0 0 25px rgba(0,255,100,0.3)" }}
                        whileTap={{ scale: 0.97 }}
                        href={`https://amoy.polygonscan.com/`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ flex: 1, padding: ".85rem", borderRadius: "12px", background: "linear-gradient(135deg, rgba(0,255,100,0.15), rgba(0,200,80,0.1))", border: "1px solid rgba(0,255,100,0.25)", color: "#00ff88", textDecoration: "none", textAlign: "center", fontWeight: 700, fontSize: ".85rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                      >
                        🔍 View on PolygonScan ↗
                      </motion.a>

                      <button
                        onClick={() => navigate("/employer")}
                        style={{ padding: ".85rem 1.5rem", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontWeight: 700, fontSize: ".85rem", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        ← Back to Dashboard
                      </button>
                    </div>

                  </motion.div>
                ) : (

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} style={{ padding: "0 2.5rem 2.5rem" }}>
                    <div style={{ background: "rgba(255,50,50,0.06)", border: "1px solid rgba(255,50,50,0.15)", borderRadius: "14px", padding: "1.5rem", marginBottom: "1.2rem" }}>
                      <div style={{ color: "#ff4444", fontWeight: 700, marginBottom: ".5rem" }}>⚠️ Why verification failed:</div>
                      {[
                        "The certificate PDF may have been edited or tampered",
                        "The SHA-256 hash doesn't match any record on blockchain",
                        "This certificate was never registered on CertifyPro",
                      ].map((reason, i) => (
                        <div key={i} style={{ color: "#6b7280", fontSize: ".85rem", padding: ".4rem 0", borderBottom: i < 2 ? "1px solid rgba(255,50,50,0.08)" : "none", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ color: "#ff4444" }}>→</span> {reason}
                        </div>
                      ))}
                    </div>

                    <div style={{ background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.2)", borderRadius: "14px", padding: "1.2rem", marginBottom: "1.2rem" }}>
                      <div style={{ color: "#ffaa00", fontSize: ".85rem", lineHeight: 1.6 }}>
                        ⚠️ <strong>Warning:</strong> Do not accept this certificate. Contact the institution directly to verify authenticity.
                      </div>
                    </div>

                    <button
                      onClick={() => navigate("/employer")}
                      style={{ width: "100%", padding: ".9rem", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", fontWeight: 700, fontSize: ".9rem", textAlign: "center", cursor: "pointer" }}
                    >
                      ← Back to Dashboard
                    </button>
                  </motion.div>
                )}

                <div style={{ padding: "1.2rem 2.5rem", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "18px", height: "18px", borderRadius: "5px", background: "linear-gradient(135deg,#1a4cff,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ color: "#fff", fontSize: "8px", fontWeight: 700 }}>C</span>
                    </div>
                    <span style={{ color: "#6b7280", fontSize: ".8rem", fontWeight: 600 }}>CertifyPro</span>
                  </Link>
                  <div style={{ color: "#6b7280", fontSize: ".75rem" }}>
                    Verified on Polygon blockchain · {new Date().toLocaleDateString()}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}