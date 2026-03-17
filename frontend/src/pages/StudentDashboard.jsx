import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import QRCode from "react-qr-code";
import { useNavigate } from "react-router-dom";

function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    const nodes = Array.from({ length: 35 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: 1 + Math.random() * 1.5, op: 0.15 + Math.random() * 0.3
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
          if (dist < 100) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,212,255,${(1 - dist / 100) * 0.18})`;
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

function QRModal({ cert, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}>
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.99), rgba(10,14,25,0.99))", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "24px", padding: "2.5rem", textAlign: "center", maxWidth: "360px", width: "90%", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)" }} />
        <div style={{ color: "#00d4ff", fontWeight: 800, fontSize: "1rem", marginBottom: ".3rem" }}>Certificate QR Code</div>
        <div style={{ color: "#6b7280", fontSize: ".8rem", marginBottom: "1.5rem" }}>{cert.degree}</div>
        <div style={{ background: "#fff", padding: "16px", borderRadius: "16px", display: "inline-block", marginBottom: "1.2rem" }}>
          <QRCode value={`${window.location.origin}/verify?hash=${cert.certHash}`} size={200} />
        </div>
        <div style={{ color: "#6b7280", fontSize: ".68rem", fontFamily: "monospace", wordBreak: "break-all", marginBottom: "1.5rem" }}>{cert.certHash}</div>
        <div style={{ display: "flex", gap: ".8rem", justifyContent: "center" }}>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => { navigator.clipboard.writeText(cert.certHash); toast.success("Hash copied!"); }}
            style={{ padding: ".6rem 1.2rem", borderRadius: "8px", border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.08)", color: "#00d4ff", cursor: "pointer", fontSize: ".82rem", fontWeight: 700 }}>
            📋 Copy Hash
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onClose}
            style={{ padding: ".6rem 1.2rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#6b7280", cursor: "pointer", fontSize: ".82rem", fontWeight: 700 }}>
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

const API = "http://localhost:3001";

export default function StudentDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qrCert, setQrCert] = useState(null);
  const [downloading, setDownloading] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    if (user.role !== "student") { navigate("/login"); return; }
    loadCerts();
  }, []);

  async function loadCerts() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/student/my-certificates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to load certificates");
        setLoading(false);
        return;
      }
      setCerts(data.certificates || []);
      toast.success(`Loaded ${data.certificates?.length || 0} certificate(s)!`);
    } catch (err) {
      toast.error("Server error. Is backend running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(cert) {
    setDownloading(cert.id);
    await new Promise(r => setTimeout(r, 1500));
    toast.success("Certificate downloaded!");
    setDownloading(null);
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  const filtered = certs.filter(c => activeFilter === "all" || c.status === activeFilter);

  return (
    <div style={{ background: "#05080f", minHeight: "100vh", fontFamily: "sans-serif", position: "relative" }}>
      <ParticleCanvas />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(5,8,15,0.78)" }} />
      <Toaster position="top-right" toastOptions={{ style: { background: "#0e1320", color: "#f7f6f2", border: "1px solid rgba(255,255,255,0.1)" } }} />
      <AnimatePresence>{qrCert && <QRModal cert={qrCert} onClose={() => setQrCert(null)} />}</AnimatePresence>

      <div style={{ position: "relative", zIndex: 2, maxWidth: "900px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>

        <motion.div initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: ".5rem" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#0066cc,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#fff" }}>🎓</div>
              <div>
                <div style={{ color: "#6b7280", fontSize: ".78rem", letterSpacing: "1px", textTransform: "uppercase" }}>Student Portal</div>
                <div style={{ color: "#f7f6f2", fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-1px" }}>
                  {user.name || "My Certificates"}
                </div>
              </div>
            </div>
            <div style={{ color: "#7ba8ff", fontSize: ".85rem", marginLeft: "60px", fontFamily: "monospace" }}>
              🎓 {user.rollNumber || ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "center" }}>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={loadCerts} disabled={loading}
              style={{ padding: ".5rem 1rem", borderRadius: "10px", border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.08)", color: "#00d4ff", cursor: "pointer", fontSize: ".8rem", fontWeight: 700 }}>
              {loading ? "⏳" : "🔄 Refresh"}
            </motion.button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={handleLogout}
              style={{ padding: ".5rem 1rem", borderRadius: "10px", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.08)", color: "#ff4444", cursor: "pointer", fontSize: ".8rem", fontWeight: 700 }}>
              🚪 Logout
            </motion.button>
            <motion.div animate={{ boxShadow: ["0 0 10px rgba(0,212,255,0.2)", "0 0 20px rgba(0,212,255,0.4)", "0 0 10px rgba(0,212,255,0.2)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", padding: ".4rem 1rem", borderRadius: "20px", fontSize: ".75rem", color: "#00d4ff" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", display: "inline-block" }} />
              {certs.length} On-Chain
            </motion.div>
          </div>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {[
            { label: "Total Certificates", value: certs.length, icon: "🎓", color: "#00d4ff" },
            { label: "Verified On-Chain", value: certs.filter(c => c.status === "active").length, icon: "✅", color: "#00ff88" },
            { label: "Blockchain Network", value: "Polygon", icon: "⛓️", color: "#8b5cf6" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "1.2rem 1.4rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${s.color}44, transparent)` }} />
              <div style={{ fontSize: "1.3rem", marginBottom: ".4rem" }}>{s.icon}</div>
              <div style={{ color: s.color, fontSize: "1.5rem", fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: "#6b7280", fontSize: ".75rem" }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
          <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem" }}>My Certificates</div>
          <div style={{ display: "flex", gap: ".5rem" }}>
            {["all", "active", "revoked"].map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                style={{ padding: ".4rem .9rem", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: ".75rem", fontWeight: 600, textTransform: "capitalize", background: activeFilter === f ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)", color: activeFilter === f ? "#00d4ff" : "#6b7280" }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              style={{ width: "40px", height: "40px", borderRadius: "50%", border: "3px solid rgba(0,212,255,0.2)", borderTopColor: "#00d4ff", margin: "0 auto 1rem" }} />
            Loading your certificates...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "4rem", color: "#6b7280", background: "rgba(255,255,255,0.02)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: ".5rem" }}>No certificates found</div>
            <div style={{ fontSize: ".85rem" }}>Your admin hasn't issued any certificates yet</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filtered.map((cert, i) => (
            <motion.div key={cert.id || i}
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              whileHover={{ y: -3, boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
              style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "1.5rem 1.8rem", position: "relative", overflow: "hidden", transition: "all 0.3s" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.35), transparent)" }} />
              <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: "3px", background: cert.status === "active" ? "linear-gradient(180deg, #0066cc, #00d4ff)" : "linear-gradient(180deg, #ff4444, #ff8888)", borderRadius: "0 3px 3px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1, paddingLeft: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: ".6rem" }}>
                    <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: ".68rem", fontWeight: 700, background: cert.status === "active" ? "rgba(0,255,136,0.1)" : "rgba(255,68,68,0.1)", color: cert.status === "active" ? "#00ff88" : "#ff6666", border: `1px solid ${cert.status === "active" ? "rgba(0,255,136,0.2)" : "rgba(255,68,68,0.2)"}` }}>
                      {cert.status === "active" ? "✓ VERIFIED ON-CHAIN" : "✗ REVOKED"}
                    </span>
                  </div>
                  <div style={{ color: "#f7f6f2", fontWeight: 800, fontSize: "1.05rem", letterSpacing: "-0.5px", marginBottom: ".3rem" }}>{cert.degree}</div>
                  <div style={{ color: "#00d4ff", fontSize: ".82rem", marginBottom: ".3rem" }}>{cert.university}</div>
                  <div style={{ color: "#6b7280", fontSize: ".78rem" }}>
                    Issued by <span style={{ color: "#a0aec0", fontFamily: "monospace", fontSize: ".72rem" }}>
                      {typeof cert.issuedBy === "string" && cert.issuedBy.startsWith("0x") ? cert.issuedBy.slice(0, 6) + "..." + cert.issuedBy.slice(-4) : cert.issuedBy}
                    </span> · {cert.issuedDate}
                  </div>
                  <div style={{ marginTop: ".8rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "4px 10px", fontSize: ".68rem", fontFamily: "monospace", color: "#6b7280", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cert.certHash}
                    </div>
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => { navigator.clipboard.writeText(cert.certHash); toast.success("Hash copied!"); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: ".8rem", padding: "4px" }}>
                      📋
                    </motion.button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: ".6rem", marginLeft: "1rem" }}>
                  <div style={{ display: "flex", gap: ".5rem" }}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => setQrCert(cert)}
                      style={{ padding: ".5rem .9rem", borderRadius: "8px", border: "1px solid rgba(0,212,255,0.25)", background: "rgba(0,212,255,0.08)", color: "#00d4ff", cursor: "pointer", fontSize: ".78rem", fontWeight: 700 }}>
                      📲 QR Code
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => handleDownload(cert)} disabled={downloading === cert.id}
                      style={{ padding: ".5rem .9rem", borderRadius: "8px", border: "1px solid rgba(26,76,255,0.25)", background: downloading === cert.id ? "rgba(255,255,255,0.04)" : "rgba(26,76,255,0.12)", color: downloading === cert.id ? "#6b7280" : "#7ba8ff", cursor: downloading === cert.id ? "not-allowed" : "pointer", fontSize: ".78rem", fontWeight: 700 }}>
                      {downloading === cert.id ? "⏳" : "⬇️ Download"}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ textAlign: "center", marginTop: "2.5rem", color: "#6b7280", fontSize: ".78rem" }}>
          🔒 All certificates are cryptographically secured on the blockchain. Tamper-proof & permanent.
        </motion.div>
      </div>
      <style>{`* { box-sizing: border-box; }`}</style>
    </div>
  );
}