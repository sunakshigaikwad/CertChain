import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate } from "react-router-dom";

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
      r: 1.5 + Math.random() * 1.5, op: 0.2 + Math.random() * 0.4
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
            ctx.strokeStyle = `rgba(0,212,255,${(1 - dist / 120) * 0.25})`;
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

const API = "http://localhost:3001";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [activeTab, setActiveTab] = useState("issue");
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ rollNumber: "", student: "", degree: "", university: "" });
  const [issuing, setIssuing] = useState(false);
  const [issuedHash, setIssuedHash] = useState(null);
  const [certs, setCerts] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const fileInputRef = useRef(null);

  // Student creation state
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentForm, setStudentForm] = useState({ name: "", rollNumber: "", password: "", degree: "", organization: "" });
  const [creatingStudent, setCreatingStudent] = useState(false);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    if (user.role !== "admin") { navigate("/login"); return; }
  }, []);

  useEffect(() => {
    if (activeTab === "list") loadCerts();
    if (activeTab === "students") loadStudents();
  }, [activeTab]);

  async function handleIssue() {
    if (!form.rollNumber || !form.student || !form.degree || !form.university) return toast.error("Fill in all fields");
    if (!file) return toast.error("Upload a certificate PDF");
    setIssuing(true);
    try {
      const formData = new FormData();
      formData.append("certificate", file);
      formData.append("rollNumber", form.rollNumber);
      formData.append("studentName", form.student);
      formData.append("degree", form.degree);
      formData.append("university", form.university);

      const res = await fetch(`${API}/api/admin/issue-to-student`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to issue"); setIssuing(false); return; }
      setIssuedHash(data.certHash);
      toast.success("✅ Certificate issued on blockchain!");
    } catch (err) {
      toast.error("Server error: " + err.message);
    } finally {
      setIssuing(false);
    }
  }

  async function loadCerts() {
    setLoadingCerts(true);
    try {
      const res = await fetch(`${API}/api/certificates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setCerts(data.certificates || []);
      else toast.error(data.error || "Failed to load");
    } catch {
      toast.error("Could not load certificates");
    } finally {
      setLoadingCerts(false);
    }
  }

  async function loadStudents() {
    setLoadingStudents(true);
    try {
      const res = await fetch(`${API}/api/admin/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setStudents(data.students || []);
      else toast.error(data.error || "Failed to load students");
    } catch {
      toast.error("Could not load students");
    } finally {
      setLoadingStudents(false);
    }
  }

  async function handleCreateStudent(e) {
    e.preventDefault();
    if (!studentForm.name || !studentForm.rollNumber || !studentForm.password) return toast.error("Name, Roll Number and Password are required");
    setCreatingStudent(true);
    try {
      const res = await fetch(`${API}/api/admin/create-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(studentForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed to create student"); setCreatingStudent(false); return; }
      toast.success(`✅ Student ${studentForm.name} created!`);
      setStudentForm({ name: "", rollNumber: "", password: "", degree: "", organization: "" });
      loadStudents();
    } catch {
      toast.error("Server error");
    } finally {
      setCreatingStudent(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  const filteredCerts = certs.filter(c => {
    const matchSearch = c.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) || c.degree?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const stats = [
    { label: "Total Issued", value: certs.length, icon: "🎓", color: "#00d4ff" },
    { label: "Active", value: certs.filter(c => c.status === "active").length, icon: "✅", color: "#00ff88" },
    { label: "Revoked", value: certs.filter(c => c.status === "revoked").length, icon: "🚫", color: "#ff4444" },
    { label: "Students", value: students.length, icon: "👥", color: "#ffaa00" },
  ];

  return (
    <div style={{ background: "#05080f", minHeight: "100vh", fontFamily: "sans-serif", position: "relative" }}>
      <ParticleCanvas />
      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", background: "rgba(5,8,15,0.75)" }} />
      <Toaster position="top-right" toastOptions={{ style: { background: "#0e1320", color: "#f7f6f2", border: "1px solid rgba(255,255,255,0.1)" } }} />

      {/* Sidebar */}
      <div style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: "240px", zIndex: 10, background: "rgba(10,14,25,0.95)", borderRight: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "1.5rem 1.5rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#0066cc,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>⛓️</div>
            <div>
              <div style={{ color: "#f7f6f2", fontWeight: 800, fontSize: ".95rem" }}>CertifyPro</div>
              <div style={{ color: "#00d4ff", fontSize: ".65rem", letterSpacing: "1.5px", textTransform: "uppercase" }}>Admin Portal</div>
            </div>
          </div>
        </div>
        <nav style={{ padding: "1rem .75rem", flex: 1 }}>
          {[
            { id: "issue", icon: "📤", label: "Issue Certificate" },
            { id: "students", icon: "👥", label: "Manage Students" },
            { id: "list", icon: "📋", label: "Certificates" },
            { id: "stats", icon: "📊", label: "Analytics" },
          ].map(item => (
            <motion.button key={item.id} whileHover={{ x: 4 }} whileTap={{ scale: 0.97 }}
              onClick={() => setActiveTab(item.id)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: ".7rem 1rem", borderRadius: "10px", border: "none", cursor: "pointer", background: activeTab === item.id ? "rgba(0,212,255,0.1)" : "transparent", borderLeft: activeTab === item.id ? "2px solid #00d4ff" : "2px solid transparent", color: activeTab === item.id ? "#00d4ff" : "#6b7280", fontSize: ".875rem", fontWeight: activeTab === item.id ? 700 : 500, marginBottom: "4px", textAlign: "left", transition: "all 0.2s" }}>
              <span>{item.icon}</span> {item.label}
            </motion.button>
          ))}
        </nav>
        <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0066cc,#00d4ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".8rem", fontWeight: 700, color: "#fff" }}>
              {user.name ? user.name[0].toUpperCase() : "AD"}
            </div>
            <div>
              <div style={{ color: "#f7f6f2", fontSize: ".8rem", fontWeight: 600 }}>{user.name || "Admin"}</div>
              <div style={{ color: "#6b7280", fontSize: ".7rem" }}>{user.email || "admin@certchain.io"}</div>
            </div>
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            style={{ width: "100%", padding: ".5rem", borderRadius: "8px", border: "1px solid rgba(255,68,68,0.3)", background: "rgba(255,68,68,0.08)", color: "#ff4444", fontSize: ".78rem", fontWeight: 600, cursor: "pointer" }}>
            🚪 Logout
          </motion.button>
        </div>
      </div>

      {/* Main */}
      <div style={{ marginLeft: "240px", padding: "2rem", position: "relative", zIndex: 2 }}>
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ color: "#f7f6f2", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-1px", margin: 0 }}>
              {activeTab === "issue" ? "Issue Certificate" : activeTab === "list" ? "Certificate Registry" : activeTab === "students" ? "Manage Students" : "Analytics"}
            </h1>
            <p style={{ color: "#6b7280", fontSize: ".85rem", marginTop: "4px" }}>
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <motion.div animate={{ boxShadow: ["0 0 10px rgba(0,212,255,0.2)", "0 0 20px rgba(0,212,255,0.4)", "0 0 10px rgba(0,212,255,0.2)"] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", padding: ".4rem 1rem", borderRadius: "20px", fontSize: ".75rem", color: "#00d4ff" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00d4ff", display: "inline-block" }} />
            Blockchain Connected
          </motion.div>
        </motion.div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
          {stats.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              whileHover={{ y: -3 }}
              style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "1.2rem 1.4rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: `linear-gradient(90deg, transparent, ${s.color}44, transparent)` }} />
              <div style={{ fontSize: "1.5rem", marginBottom: ".5rem" }}>{s.icon}</div>
              <div style={{ color: s.color, fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-1px" }}>{s.value}</div>
              <div style={{ color: "#6b7280", fontSize: ".75rem", marginTop: "2px" }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ISSUE TAB */}
          {activeTab === "issue" && (
            <motion.div key="issue" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "1.8rem", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)" }} />
                <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem", marginBottom: "1.5rem" }}>📝 Certificate Details</div>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ color: "#6b7280", fontSize: ".75rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Roll Number</label>
                  <input value={form.rollNumber} onChange={e => setForm(p => ({ ...p, rollNumber: e.target.value }))}
                    placeholder="e.g. RA2111003010234"
                    style={{ width: "100%", padding: ".75rem 1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "rgba(0,212,255,0.4)"}
                    onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
                </div>

                {[{ key: "student", label: "Student Name", ph: "e.g. Arjun Sharma" }, { key: "degree", label: "Degree / Course", ph: "e.g. B.Tech Computer Science" }, { key: "university", label: "University", ph: "e.g. SRM Institute of Science and Technology" }].map(f => (
                  <div key={f.key} style={{ marginBottom: "1rem" }}>
                    <label style={{ color: "#6b7280", fontSize: ".75rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>{f.label}</label>
                    <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      style={{ width: "100%", padding: ".75rem 1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(0,212,255,0.4)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                ))}

                <div onClick={() => fileInputRef.current?.click()}
                  style={{ border: `2px dashed ${file ? "rgba(0,212,255,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: "12px", padding: "1.5rem", textAlign: "center", cursor: "pointer", background: file ? "rgba(0,212,255,0.04)" : "rgba(255,255,255,0.02)", marginBottom: "1.2rem", transition: "all 0.2s" }}>
                  <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }}
                    onChange={e => { setFile(e.target.files[0]); toast.success("PDF loaded!"); }} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>📄</div>
                      <div style={{ color: "#00d4ff", fontWeight: 600, fontSize: ".85rem" }}>{file.name}</div>
                      <div style={{ color: "#6b7280", fontSize: ".75rem" }}>{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "1.5rem", marginBottom: "4px" }}>☁️</div>
                      <div style={{ color: "#f7f6f2", fontSize: ".85rem", fontWeight: 600 }}>Upload Certificate PDF</div>
                      <div style={{ color: "#6b7280", fontSize: ".75rem" }}>Click to browse</div>
                    </div>
                  )}
                </div>

                <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0,212,255,0.3)" }} whileTap={{ scale: 0.98 }}
                  onClick={handleIssue} disabled={issuing}
                  style={{ width: "100%", padding: ".9rem", borderRadius: "12px", border: "none", background: issuing ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#0066cc,#00d4ff)", color: issuing ? "#6b7280" : "#fff", fontWeight: 700, fontSize: ".9rem", cursor: issuing ? "not-allowed" : "pointer" }}>
                  {issuing ? "⏳ Issuing on Blockchain..." : "⛓️ Issue Certificate"}
                </motion.button>
              </div>

              {/* Right panel */}
              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "1.8rem", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", minHeight: "400px" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(26,76,255,0.4), transparent)" }} />
                <AnimatePresence mode="wait">
                  {issuedHash ? (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center" }}>
                      <div style={{ color: "#00ff88", fontWeight: 700, fontSize: "1rem", marginBottom: "1rem" }}>✅ Certificate Issued on Blockchain!</div>
                      <div style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", borderRadius: "12px", padding: "1.2rem", marginBottom: "1rem" }}>
                        <div style={{ color: "#6b7280", fontSize: ".72rem", marginBottom: "6px" }}>Certificate Hash:</div>
                        <div style={{ color: "#00d4ff", fontSize: ".7rem", fontFamily: "monospace", wordBreak: "break-all" }}>{issuedHash}</div>
                      </div>
                      <div style={{ display: "flex", gap: ".8rem", justifyContent: "center" }}>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          onClick={() => { navigator.clipboard.writeText(issuedHash); toast.success("Hash copied!"); }}
                          style={{ padding: ".6rem 1.2rem", borderRadius: "8px", border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.08)", color: "#00d4ff", cursor: "pointer", fontSize: ".82rem", fontWeight: 600 }}>
                          📋 Copy Hash
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          onClick={() => { setIssuedHash(null); setFile(null); setForm({ rollNumber: "", student: "", degree: "", university: "" }); }}
                          style={{ padding: ".6rem 1.2rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#6b7280", cursor: "pointer", fontSize: ".82rem", fontWeight: 600 }}>
                          Issue Another
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: "center" }}>
                      <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 1rem" }}>📲</div>
                      <div style={{ color: "#6b7280", fontSize: ".875rem" }}>Certificate hash will appear here</div>
                      <div style={{ color: "#6b7280", fontSize: ".75rem", marginTop: "4px" }}>after issuing on blockchain</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {/* STUDENTS TAB */}
          {activeTab === "students" && (
            <motion.div key="students" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "1.5rem" }}>

              {/* Create student form */}
              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "1.8rem", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)" }} />
                <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: "1rem", marginBottom: "1.5rem" }}>➕ Create Student Account</div>

                {[
                  { key: "name", label: "Full Name", ph: "e.g. Arjun Sharma" },
                  { key: "rollNumber", label: "Roll Number", ph: "e.g. RA2111003010234" },
                  { key: "password", label: "Password", ph: "Set student password" },
                  { key: "degree", label: "Degree (optional)", ph: "e.g. B.Tech CSE" },
                  { key: "organization", label: "Organization (optional)", ph: "e.g. SRMIST" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: "1rem" }}>
                    <label style={{ color: "#6b7280", fontSize: ".75rem", letterSpacing: "1px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>{f.label}</label>
                    <input
                      type={f.key === "password" ? "password" : "text"}
                      value={studentForm[f.key]}
                      onChange={e => setStudentForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      style={{ width: "100%", padding: ".75rem 1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#f7f6f2", fontSize: ".875rem", outline: "none", boxSizing: "border-box" }}
                      onFocus={e => e.target.style.borderColor = "rgba(0,212,255,0.4)"}
                      onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
                  </div>
                ))}

                <motion.button whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(0,212,255,0.3)" }} whileTap={{ scale: 0.98 }}
                  onClick={handleCreateStudent} disabled={creatingStudent}
                  style={{ width: "100%", padding: ".9rem", borderRadius: "12px", border: "none", background: creatingStudent ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg,#0066cc,#00d4ff)", color: creatingStudent ? "#6b7280" : "#fff", fontWeight: 700, fontSize: ".9rem", cursor: creatingStudent ? "not-allowed" : "pointer" }}>
                  {creatingStudent ? "⏳ Creating..." : "👥 Create Student Account"}
                </motion.button>
              </div>

              {/* Students list */}
              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", overflow: "hidden" }}>
                <div style={{ padding: "1.2rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: ".9rem" }}>👥 Registered Students ({students.length})</div>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={loadStudents} disabled={loadingStudents}
                    style={{ padding: ".4rem .9rem", borderRadius: "8px", border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.08)", color: "#00d4ff", cursor: "pointer", fontSize: ".78rem", fontWeight: 600 }}>
                    {loadingStudents ? "⏳" : "🔄 Refresh"}
                  </motion.button>
                </div>
                <div style={{ maxHeight: "460px", overflowY: "auto" }}>
                  {loadingStudents && <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>⏳ Loading...</div>}
                  {!loadingStudents && students.length === 0 && (
                    <div style={{ textAlign: "center", padding: "2rem", color: "#6b7280" }}>No students yet. Create one!</div>
                  )}
                  {students.map((s, i) => (
                    <motion.div key={s._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#1a4cff,#7ba8ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: ".85rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {s.name ? s.name[0].toUpperCase() : "S"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#f7f6f2", fontWeight: 600, fontSize: ".875rem" }}>{s.name}</div>
                        <div style={{ color: "#7ba8ff", fontSize: ".75rem", fontFamily: "monospace" }}>{s.rollNumber}</div>
                        {s.degree && <div style={{ color: "#6b7280", fontSize: ".72rem" }}>{s.degree}</div>}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: ".7rem" }}>
                        {new Date(s.createdAt).toLocaleDateString("en-IN")}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* LIST TAB */}
          {activeTab === "list" && (
            <motion.div key="list" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1.2rem", alignItems: "center" }}>
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="🔍  Search by name or degree..."
                  style={{ flex: 1, padding: ".7rem 1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "#f7f6f2", fontSize: ".875rem", outline: "none" }}
                  onFocus={e => e.target.style.borderColor = "rgba(0,212,255,0.4)"}
                  onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
                {["all", "active", "revoked"].map(f => (
                  <button key={f} onClick={() => setFilterStatus(f)}
                    style={{ padding: ".5rem 1rem", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: ".8rem", fontWeight: 600, background: filterStatus === f ? "rgba(0,212,255,0.15)" : "rgba(255,255,255,0.04)", color: filterStatus === f ? "#00d4ff" : "#6b7280", textTransform: "capitalize" }}>
                    {f}
                  </button>
                ))}
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={loadCerts} disabled={loadingCerts}
                  style={{ padding: ".5rem 1rem", borderRadius: "8px", border: "1px solid rgba(0,212,255,0.3)", background: "rgba(0,212,255,0.08)", color: "#00d4ff", cursor: "pointer", fontSize: ".8rem", fontWeight: 600 }}>
                  {loadingCerts ? "⏳" : "🔄 Refresh"}
                </motion.button>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 3fr 1.2fr 1fr", padding: ".8rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Student", "Degree", "Roll No", "Hash", "Issued", "Status"].map(h => (
                    <div key={h} style={{ color: "#6b7280", fontSize: ".72rem", letterSpacing: "1px", textTransform: "uppercase" }}>{h}</div>
                  ))}
                </div>
                {loadingCerts && <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>⏳ Loading...</div>}
                {!loadingCerts && filteredCerts.length === 0 && (
                  <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>
                    No certificates found.
                    <div style={{ fontSize: ".78rem", marginTop: "8px" }}>Issue a certificate first or click Refresh.</div>
                  </div>
                )}
                {filteredCerts.map((cert, i) => (
                  <motion.div key={cert._id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    whileHover={{ background: "rgba(255,255,255,0.02)" }}
                    style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1.5fr 3fr 1.2fr 1fr", padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
                    <div style={{ color: "#f7f6f2", fontWeight: 600, fontSize: ".875rem" }}>{cert.studentName}</div>
                    <div style={{ color: "#a0aec0", fontSize: ".8rem" }}>{cert.degree}</div>
                    <div style={{ color: "#7ba8ff", fontSize: ".75rem", fontFamily: "monospace" }}>{cert.rollNumber || "—"}</div>
                    <div style={{ color: "#6b7280", fontSize: ".7rem", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cert.certHash}</div>
                    <div style={{ color: "#6b7280", fontSize: ".78rem" }}>{cert.issuedDate ? new Date(cert.issuedDate).toLocaleDateString("en-IN") : "—"}</div>
                    <div>
                      <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: ".72rem", fontWeight: 700, background: cert.status === "active" ? "rgba(0,255,136,0.12)" : "rgba(255,68,68,0.12)", color: cert.status === "active" ? "#00ff88" : "#ff4444", border: `1px solid ${cert.status === "active" ? "rgba(0,255,136,0.2)" : "rgba(255,68,68,0.2)"}`, textTransform: "capitalize" }}>
                        {cert.status}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STATS TAB */}
          {activeTab === "stats" && (
            <motion.div key="stats" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              {[
                { title: "Certificates Issued", data: [certs.length, 0, 0, 0], labels: ["Issued", "Pending", "Failed", "Revoked"] },
                { title: "Certificate Status", data: [certs.filter(c => c.status === "active").length || 1, certs.filter(c => c.status === "revoked").length || 0, 0, 0], labels: ["Active", "Revoked", "", ""] },
              ].map((chart, ci) => (
                <div key={ci} style={{ background: "linear-gradient(135deg, rgba(14,19,32,0.95), rgba(10,14,25,0.95))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "20px", padding: "1.8rem", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)" }} />
                  <div style={{ color: "#f7f6f2", fontWeight: 700, fontSize: ".9rem", marginBottom: "1.5rem" }}>{chart.title}</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "120px" }}>
                    {chart.data.map((val, i) => (
                      <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${(val / (Math.max(...chart.data) || 1)) * 100}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        style={{ flex: 1, borderRadius: "4px 4px 0 0", background: `rgba(0,212,255,${0.3 + (val / (Math.max(...chart.data) || 1)) * 0.5})`, minWidth: 0, minHeight: val > 0 ? "4px" : 0 }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                    {chart.labels.map((l, i) => (
                      <div key={i} style={{ flex: 1, textAlign: "center", color: "#6b7280", fontSize: ".6rem", minWidth: 0 }}>{l}</div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: rgba(255,255,255,0.2); }`}</style>
    </div>
  );
}