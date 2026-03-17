import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";

function ParticleCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    let mouseX = W / 2, mouseY = H / 2;
    const nodes = Array.from({ length: 70 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: 1.5 + Math.random() * 2.5, op: 0.4 + Math.random() * 0.6,
    }));
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onMouse = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouse);
    let animId;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,212,255,${(1 - dist / 150) * 0.5})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        const mdx = nodes[i].x - mouseX, mdy = nodes[i].y - mouseY;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        const glow = md < 150 ? 1 - md / 150 : 0;
        if (glow > 0.1) {
          ctx.beginPath();
          ctx.arc(nodes[i].x, nodes[i].y, nodes[i].r + glow * 12, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,212,255,${glow * 0.2})`;
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
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);
  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", top: 0, left: 0,
      width: "100vw", height: "100vh",
      zIndex: 0, pointerEvents: "none",
    }} />
  );
}

const ROLES = [
  {
    id: "admin", icon: "🏛️", label: "Admin", sublabel: "College / University",
    desc: "Issue & manage certificates on the blockchain",
    color: "#00d4ff",
    gradient: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,102,204,0.1))",
    border: "rgba(0,212,255,0.3)", glow: "rgba(0,212,255,0.2)",
    route: "/admin",
  },
  {
    id: "student", icon: "🎓", label: "Student", sublabel: "Graduate / Alumni",
    desc: "View, download & share your certificates",
    color: "#7ba8ff",
    gradient: "linear-gradient(135deg, rgba(123,168,255,0.15), rgba(26,76,255,0.1))",
    border: "rgba(123,168,255,0.3)", glow: "rgba(123,168,255,0.2)",
    route: "/student",
  },
  {
    id: "employer", icon: "🔍", label: "Employer", sublabel: "HR / Recruiter",
    desc: "Verify candidate certificates instantly",
    color: "#00ff88",
    gradient: "linear-gradient(135deg, rgba(0,255,136,0.12), rgba(0,170,85,0.08))",
    border: "rgba(0,255,136,0.3)", glow: "rgba(0,255,136,0.15)",
    route: "/employer",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState("role");
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState({ id: "", pass: "", name: "", confirmPass: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoveredRole, setHoveredRole] = useState(null);
  const [isRegister, setIsRegister] = useState(false);

  useEffect(() => {
    const cursor = document.getElementById("cc-cursor");
    const ring = document.getElementById("cc-ring");
    let cx = 0, cy = 0, rx = 0, ry = 0;
    const onMove = (e) => {
      cx = e.clientX; cy = e.clientY;
      if (cursor) { cursor.style.left = cx + "px"; cursor.style.top = cy + "px"; }
    };
    document.addEventListener("mousemove", onMove);
    let rafId;
    function animRing() {
      rx += (cx - rx) * 0.12; ry += (cy - ry) * 0.12;
      if (ring) { ring.style.left = rx + "px"; ring.style.top = ry + "px"; }
      rafId = requestAnimationFrame(animRing);
    }
    animRing();
    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  function selectRole(role) {
    setSelectedRole(role);
    setForm({ id: "", pass: "", name: "", confirmPass: "" });
    setIsRegister(false);
    setStep("login");
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!form.id || !form.pass) return toast.error("Fill in all fields");
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.id, password: form.pass }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }
      if (data.user.role !== selectedRole.id) {
        toast.error(`This account is not a ${selectedRole.label}`);
        setLoading(false);
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success(`Welcome, ${data.user.name || selectedRole.label}!`);
      await new Promise((r) => setTimeout(r, 600));
      navigate(selectedRole.route);
    } catch (err) {
      toast.error("Server error. Is backend running?");
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!form.id || !form.pass || !form.name) return toast.error("Fill in all fields");
    if (form.pass !== form.confirmPass) return toast.error("Passwords do not match");
    if (form.pass.length < 6) return toast.error("Password must be at least 6 characters");
    if (selectedRole.id === "student") {
      toast.error("Students are registered by Admin only");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3001/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.id,
          password: form.pass,
          name: form.name,
          role: selectedRole.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registration failed");
        setLoading(false);
        return;
      }
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success(`Account created! Welcome, ${form.name}!`);
      await new Promise((r) => setTimeout(r, 600));
      navigate(selectedRole.route);
    } catch (err) {
      toast.error("Server error. Is backend running?");
      setLoading(false);
    }
  }

  const role = ROLES.find((r) => r.id === selectedRole?.id);

  return (
    <>
      <div id="cc-cursor" style={{ position: "fixed", width: 12, height: 12, background: "#00d4ff", borderRadius: "50%", pointerEvents: "none", zIndex: 9999, transform: "translate(-50%,-50%)", transition: "width .2s, height .2s", mixBlendMode: "difference" }} />
      <div id="cc-ring" style={{ position: "fixed", width: 36, height: 36, border: "1.5px solid rgba(0,212,255,0.5)", borderRadius: "50%", pointerEvents: "none", zIndex: 9998, transform: "translate(-50%,-50%)", transition: "width .2s, height .2s" }} />

      <Toaster position="top-right" toastOptions={{ style: { background: "#0e1320", color: "#f7f6f2", border: "1px solid rgba(255,255,255,0.1)" } }} />

      <div style={{ background: "#05080f", minHeight: "100vh", position: "relative", overflow: "hidden", cursor: "none" }}>
        <ParticleCanvas />
        <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(5,8,15,0.62)" }} />
        <div style={{ position: "fixed", top: "10%", left: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,212,255,0.07), transparent)", filter: "blur(80px)", zIndex: 1, pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "5%", right: "5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(26,76,255,0.09), transparent)", filter: "blur(70px)", zIndex: 1, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

          <nav style={{ padding: "1.2rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
            <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#0066cc,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>⛓️</div>
              <span style={{ color: "#f7f6f2", fontWeight: 800, fontSize: "1.1rem", letterSpacing: "-0.5px" }}>
                Cert<span style={{ color: "#00d4ff" }}>Chain</span>
              </span>
            </Link>
            <motion.div
              animate={{ boxShadow: ["0 0 10px rgba(0,212,255,0.2)", "0 0 22px rgba(0,212,255,0.45)", "0 0 10px rgba(0,212,255,0.2)"] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)", padding: ".35rem 1rem", borderRadius: 20, fontSize: ".73rem", color: "#00d4ff", letterSpacing: "1px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", display: "inline-block" }} />
              Polygon · Secured
            </motion.div>
          </nav>

          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
            <div style={{ width: "100%", maxWidth: 560 }}>
              <AnimatePresence mode="wait">

                {step === "role" && (
                  <motion.div key="role" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20, scale: 0.97 }} transition={{ duration: 0.4 }}>
                    <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
                      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                        style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", padding: ".38rem 1.1rem", borderRadius: 20, fontSize: ".73rem", color: "#00d4ff", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "1.2rem" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", display: "inline-block" }} />
                        Choose your role to continue
                      </motion.div>
                      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                        style={{ fontSize: "2.6rem", fontWeight: 800, color: "#f7f6f2", letterSpacing: "-2px", lineHeight: 1, marginBottom: ".6rem" }}>
                        Welcome to<br />
                        <span style={{ background: "linear-gradient(90deg,#4d78ff,#00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>CertChain</span>
                      </motion.h1>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.26 }}
                        style={{ color: "#6b7280", fontSize: ".9rem" }}>
                        Blockchain-secured certificate verification
                      </motion.p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {ROLES.map((r, i) => (
                        <motion.button key={r.id}
                          initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.28 + i * 0.1 }}
                          whileHover={{ x: 6 }} whileTap={{ scale: 0.985 }}
                          onHoverStart={() => setHoveredRole(r.id)} onHoverEnd={() => setHoveredRole(null)}
                          onClick={() => selectRole(r)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: "1.2rem",
                            background: hoveredRole === r.id ? r.gradient : "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))",
                            border: `1px solid ${hoveredRole === r.id ? r.border : "rgba(255,255,255,0.07)"}`,
                            borderRadius: 18, padding: "1.3rem 1.5rem", cursor: "none", textAlign: "left",
                            boxShadow: hoveredRole === r.id ? `0 20px 50px ${r.glow}` : "0 8px 30px rgba(0,0,0,0.3)",
                            transition: "all 0.25s", position: "relative", overflow: "hidden",
                          }}>
                          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${r.color}55, transparent)`, opacity: hoveredRole === r.id ? 1 : 0, transition: "opacity 0.25s" }} />
                          <div style={{ position: "absolute", left: 0, top: "18%", bottom: "18%", width: 3, background: r.color, borderRadius: "0 3px 3px 0", opacity: hoveredRole === r.id ? 1 : 0.3, transition: "opacity 0.25s" }} />
                          <div style={{ width: 56, height: 56, borderRadius: 16, flexShrink: 0, background: `linear-gradient(135deg, ${r.color}18, ${r.color}08)`, border: `1px solid ${r.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.7rem", transition: "all 0.25s", boxShadow: hoveredRole === r.id ? `0 0 20px ${r.glow}` : "none" }}>
                            {r.icon}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ color: "#f7f6f2", fontWeight: 800, fontSize: "1.05rem" }}>{r.label}</span>
                              <span style={{ color: r.color, fontSize: ".72rem", fontWeight: 600, background: `${r.color}15`, border: `1px solid ${r.color}30`, padding: "1px 8px", borderRadius: 20 }}>{r.sublabel}</span>
                            </div>
                            <div style={{ color: "#6b7280", fontSize: ".82rem" }}>{r.desc}</div>
                          </div>
                          <motion.div animate={{ x: hoveredRole === r.id ? 4 : 0 }}
                            style={{ color: r.color, fontSize: "1.1rem", opacity: hoveredRole === r.id ? 1 : 0.3, transition: "opacity 0.25s" }}>→</motion.div>
                        </motion.button>
                      ))}
                    </div>

                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                      style={{ textAlign: "center", color: "#6b7280", fontSize: ".76rem", marginTop: "1.8rem" }}>
                      🔒 All sessions are blockchain-authenticated · No personal data stored
                    </motion.p>
                  </motion.div>
                )}

                {step === "login" && role && (
                  <motion.div key="login" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35 }}>
                    <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.97), rgba(10,14,25,0.97))", border: `1px solid ${role.border}`, borderRadius: 24, padding: "2.5rem", boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 60px ${role.glow}`, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${role.color}, transparent)` }} />
                      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${role.glow}, transparent)`, pointerEvents: "none" }} />

                      <motion.button whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}
                        onClick={() => { setStep("role"); setSelectedRole(null); setIsRegister(false); }}
                        style={{ background: "none", border: "none", cursor: "none", color: "#6b7280", fontSize: ".82rem", display: "flex", alignItems: "center", gap: 6, marginBottom: "1.8rem", padding: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#f7f6f2"}
                        onMouseLeave={e => e.currentTarget.style.color = "#6b7280"}>
                        ← Back to role selection
                      </motion.button>

                      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
                        <div style={{ width: 60, height: 60, borderRadius: 18, background: role.gradient, border: `1px solid ${role.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.9rem", boxShadow: `0 0 25px ${role.glow}` }}>
                          {role.icon}
                        </div>
                        <div>
                          <div style={{ color: "#f7f6f2", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.5px" }}>
                            {isRegister ? `Register as ${role.label}` : `Sign in as ${role.label}`}
                          </div>
                          <div style={{ color: role.color, fontSize: ".8rem", marginTop: 2 }}>{role.sublabel}</div>
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {!isRegister ? (
                          <motion.form key="loginForm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleLogin}>
                            <div style={{ marginBottom: "1rem" }}>
                              <label style={{ color: "#6b7280", fontSize: ".73rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                                {role.id === "student" ? "Roll Number" : "Email Address"}
                              </label>
                              <div style={{ position: "relative" }}>
                                <input type="text" value={form.id} onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                                  placeholder={role.id === "student" ? "e.g. RA2111003010234" : `e.g. ${role.id}@example.com`}
                                  style={{ width: "100%", padding: ".85rem 1rem .85rem 2.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
                                  onFocus={(e) => { e.target.style.borderColor = role.border; e.target.style.boxShadow = `0 0 0 3px ${role.glow}`; }}
                                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                                <span style={{ position: "absolute", left: ".9rem", top: "50%", transform: "translateY(-50%)", fontSize: ".9rem", pointerEvents: "none" }}>
                                  {role.id === "student" ? "🎓" : "📧"}
                                </span>
                              </div>
                            </div>

                            <div style={{ marginBottom: "1.5rem" }}>
                              <label style={{ color: "#6b7280", fontSize: ".73rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
                              <div style={{ position: "relative" }}>
                                <input type={showPass ? "text" : "password"} value={form.pass} onChange={(e) => setForm((p) => ({ ...p, pass: e.target.value }))}
                                  placeholder="••••••••"
                                  style={{ width: "100%", padding: ".85rem 3rem .85rem 2.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
                                  onFocus={(e) => { e.target.style.borderColor = role.border; e.target.style.boxShadow = `0 0 0 3px ${role.glow}`; }}
                                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                                <span style={{ position: "absolute", left: ".9rem", top: "50%", transform: "translateY(-50%)", fontSize: ".9rem", pointerEvents: "none" }}>🔒</span>
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                  style={{ position: "absolute", right: ".9rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "none", color: "#6b7280", fontSize: ".85rem", padding: 4 }}>
                                  {showPass ? "🙈" : "👁️"}
                                </button>
                              </div>
                            </div>

                            <motion.button type="submit" whileHover={{ scale: 1.02, boxShadow: `0 0 35px ${role.glow}` }} whileTap={{ scale: 0.97 }}
                              disabled={loading}
                              style={{ width: "100%", padding: "1rem", borderRadius: 14, border: "none", background: loading ? "rgba(255,255,255,0.05)" : role.id === "admin" ? "linear-gradient(135deg,#0066cc,#00d4ff)" : role.id === "student" ? "linear-gradient(135deg,#1a4cff,#7ba8ff)" : "linear-gradient(135deg,#00aa55,#00ff88)", color: loading ? "#6b7280" : role.id === "employer" ? "#05080f" : "#fff", fontWeight: 800, fontSize: "1rem", cursor: loading ? "not-allowed" : "none", letterSpacing: ".5px" }}>
                              {loading ? (
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%" }} />
                                  Authenticating...
                                </span>
                              ) : `Enter as ${role.label} →`}
                            </motion.button>

                            {role.id !== "student" && (
                              <>
                                <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.4rem 0" }}>
                                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                                  <span style={{ color: "#6b7280", fontSize: ".72rem", letterSpacing: 1 }}>OR</span>
                                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                                </div>
                                <motion.button type="button" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                                  onClick={() => { setIsRegister(true); setForm({ id: "", pass: "", name: "", confirmPass: "" }); }}
                                  style={{ width: "100%", padding: ".8rem", borderRadius: 12, border: `1px solid ${role.border}`, background: role.gradient, color: role.color, fontWeight: 700, fontSize: ".85rem", cursor: "none" }}>
                                  ✨ Create New Account
                                </motion.button>
                              </>
                            )}

                            {role.id === "student" && (
                              <p style={{ textAlign: "center", color: "#6b7280", fontSize: ".75rem", marginTop: "1.2rem" }}>
                                🎓 Student accounts are created by your institution admin
                              </p>
                            )}
                          </motion.form>
                        ) : (
                          <motion.form key="registerForm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onSubmit={handleRegister}>
                            <div style={{ marginBottom: "1rem" }}>
                              <label style={{ color: "#6b7280", fontSize: ".73rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Full Name</label>
                              <div style={{ position: "relative" }}>
                                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                  placeholder="Your full name"
                                  style={{ width: "100%", padding: ".85rem 1rem .85rem 2.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
                                  onFocus={(e) => { e.target.style.borderColor = role.border; e.target.style.boxShadow = `0 0 0 3px ${role.glow}`; }}
                                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                                <span style={{ position: "absolute", left: ".9rem", top: "50%", transform: "translateY(-50%)", fontSize: ".9rem", pointerEvents: "none" }}>👤</span>
                              </div>
                            </div>

                            <div style={{ marginBottom: "1rem" }}>
                              <label style={{ color: "#6b7280", fontSize: ".73rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email Address</label>
                              <div style={{ position: "relative" }}>
                                <input type="text" value={form.id} onChange={(e) => setForm((p) => ({ ...p, id: e.target.value }))}
                                  placeholder={`e.g. ${role.id}@example.com`}
                                  style={{ width: "100%", padding: ".85rem 1rem .85rem 2.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
                                  onFocus={(e) => { e.target.style.borderColor = role.border; e.target.style.boxShadow = `0 0 0 3px ${role.glow}`; }}
                                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                                <span style={{ position: "absolute", left: ".9rem", top: "50%", transform: "translateY(-50%)", fontSize: ".9rem", pointerEvents: "none" }}>📧</span>
                              </div>
                            </div>

                            <div style={{ marginBottom: "1rem" }}>
                              <label style={{ color: "#6b7280", fontSize: ".73rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
                              <div style={{ position: "relative" }}>
                                <input type={showPass ? "text" : "password"} value={form.pass} onChange={(e) => setForm((p) => ({ ...p, pass: e.target.value }))}
                                  placeholder="Min 6 characters"
                                  style={{ width: "100%", padding: ".85rem 3rem .85rem 2.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
                                  onFocus={(e) => { e.target.style.borderColor = role.border; e.target.style.boxShadow = `0 0 0 3px ${role.glow}`; }}
                                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                                <span style={{ position: "absolute", left: ".9rem", top: "50%", transform: "translateY(-50%)", fontSize: ".9rem", pointerEvents: "none" }}>🔒</span>
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                  style={{ position: "absolute", right: ".9rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "none", color: "#6b7280", fontSize: ".85rem", padding: 4 }}>
                                  {showPass ? "🙈" : "👁️"}
                                </button>
                              </div>
                            </div>

                            <div style={{ marginBottom: "1.5rem" }}>
                              <label style={{ color: "#6b7280", fontSize: ".73rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Confirm Password</label>
                              <div style={{ position: "relative" }}>
                                <input type={showPass ? "text" : "password"} value={form.confirmPass} onChange={(e) => setForm((p) => ({ ...p, confirmPass: e.target.value }))}
                                  placeholder="••••••••"
                                  style={{ width: "100%", padding: ".85rem 1rem .85rem 2.8rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box", transition: "all 0.2s" }}
                                  onFocus={(e) => { e.target.style.borderColor = role.border; e.target.style.boxShadow = `0 0 0 3px ${role.glow}`; }}
                                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "none"; }} />
                                <span style={{ position: "absolute", left: ".9rem", top: "50%", transform: "translateY(-50%)", fontSize: ".9rem", pointerEvents: "none" }}>🔒</span>
                              </div>
                            </div>

                            <motion.button type="submit" whileHover={{ scale: 1.02, boxShadow: `0 0 35px ${role.glow}` }} whileTap={{ scale: 0.97 }}
                              disabled={loading}
                              style={{ width: "100%", padding: "1rem", borderRadius: 14, border: "none", background: loading ? "rgba(255,255,255,0.05)" : role.id === "admin" ? "linear-gradient(135deg,#0066cc,#00d4ff)" : "linear-gradient(135deg,#00aa55,#00ff88)", color: loading ? "#6b7280" : role.id === "employer" ? "#05080f" : "#fff", fontWeight: 800, fontSize: "1rem", cursor: loading ? "not-allowed" : "none", letterSpacing: ".5px" }}>
                              {loading ? (
                                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                                  <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%" }} />
                                  Creating Account...
                                </span>
                              ) : `Create ${role.label} Account →`}
                            </motion.button>

                            <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "1.4rem 0" }}>
                              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                              <span style={{ color: "#6b7280", fontSize: ".72rem", letterSpacing: 1 }}>OR</span>
                              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
                            </div>

                            <motion.button type="button" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                              onClick={() => { setIsRegister(false); setForm({ id: "", pass: "", name: "", confirmPass: "" }); }}
                              style={{ width: "100%", padding: ".8rem", borderRadius: 12, border: `1px solid ${role.border}`, background: role.gradient, color: role.color, fontWeight: 700, fontSize: ".85rem", cursor: "none" }}>
                              Already have an account? Sign In
                            </motion.button>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div style={{ padding: "1.2rem 3rem", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#6b7280", fontSize: ".75rem" }}>⛓️ CertChain · HackNova 3.0</span>
            <span style={{ color: "#6b7280", fontSize: ".75rem" }}>Built on Polygon · IPFS · Solidity</span>
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { cursor: none !important; background: #05080f; }
        input::placeholder { color: rgba(255,255,255,0.18); }
      `}</style>
    </>
  );
}