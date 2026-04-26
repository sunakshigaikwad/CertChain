import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  const canvasRef = useRef(null);
  const [dark, setDark] = useState(true);

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

    document.querySelectorAll("a, button, .sc-node, .tech-chip-lp").forEach(el => {
      el.addEventListener("mouseenter", () => {
        if (cursor) { cursor.style.width = "20px"; cursor.style.height = "20px"; }
        if (ring) { ring.style.width = "54px"; ring.style.height = "54px"; }
      });
      el.addEventListener("mouseleave", () => {
        if (cursor) { cursor.style.width = "12px"; cursor.style.height = "12px"; }
        if (ring) { ring.style.width = "36px"; ring.style.height = "36px"; }
      });
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let W = canvas.width;
    let H = canvas.height;
    let mouseX = W / 2, mouseY = H / 2;

    const nodes = Array.from({ length: 70 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 1.5 + Math.random() * 2.5,
      op: 0.4 + Math.random() * 0.6
    }));

    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    const onMouse = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    window.addEventListener("resize", onResize);
    document.addEventListener("mousemove", onMouse);

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
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.5;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        const mdx = nodes[i].x - mouseX;
        const mdy = nodes[i].y - mouseY;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        const glow = md < 150 ? (1 - md / 150) * 1.0 : 0;

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

    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("lp-visible"); });
    }, { threshold: 0.15 });
    document.querySelectorAll(".lp-reveal, .t-step, .stat-card, .scenario-card, .tech-chip-lp").forEach(el => observer.observe(el));

    const chars = "0123456789ABCDEF";
    const intervals = [];
    document.querySelectorAll(".hash-span").forEach(sp => {
      const orig = sp.textContent;
      let frame = 0;
      const iv = setInterval(() => {
        frame++;
        if (frame % 40 === 0) {
          let s = "";
          for (let k = 0; k < orig.length; k++) s += chars[Math.floor(Math.random() * chars.length)];
          sp.textContent = s;
          setTimeout(() => { sp.textContent = orig; }, 120);
        }
      }, 200);
      intervals.push(iv);
    });

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousemove", onMouse);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animId);
      cancelAnimationFrame(rafId);
      observer.disconnect();
      intervals.forEach(clearInterval);
    };
  }, []);

  const text = dark ? "#f7f6f2" : "#05080f";
  const muted = dark ? "#6b7280" : "#4b5563";
  const cardBg = dark ? "rgba(14,19,32,0.9)" : "rgba(255,255,255,0.9)";
  const border = dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)";
  const navBg = dark ? "rgba(5,8,15,0.7)" : "rgba(240,244,255,0.7)";

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { background: #05080f; }
        body { cursor: none !important; }
        #cc-cursor { position: fixed; width: 12px; height: 12px; background: #00d4ff; border-radius: 50%; pointer-events: none; z-index: 9999; transform: translate(-50%,-50%); transition: width .2s, height .2s; mix-blend-mode: difference; }
        #cc-ring { position: fixed; width: 36px; height: 36px; border: 1.5px solid rgba(0,212,255,0.5); border-radius: 50%; pointer-events: none; z-index: 9998; transform: translate(-50%,-50%); transition: width .2s, height .2s; }
        .lp-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 500; padding: 1.2rem 3rem; display: flex; align-items: center; justify-content: space-between; backdrop-filter: blur(20px); border-bottom: 1px solid ${border}; animation: lpSlideDown .8s ease both; }
        @keyframes lpSlideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .lp-logo { font-size: 1.4rem; font-weight: 700; text-decoration: none; color: ${text}; }
        .lp-logo span { color: #00d4ff; }
        .lp-nav-links { display: flex; gap: 2rem; align-items: center; }
        .lp-nav-links a { font-size: .85rem; color: ${muted}; text-decoration: none; transition: color .2s; cursor: none; }
        .lp-nav-links a:hover { color: ${text}; }
        .lp-nav-cta { background: #1a4cff !important; color: #fff !important; padding: .45rem 1.2rem; border-radius: 6px; font-weight: 500; transition: background .2s !important; }
        .lp-nav-cta:hover { background: #4d78ff !important; }
        .lp-theme-btn { background: rgba(255,255,255,0.08); border: 1px solid ${border}; border-radius: 8px; padding: .4rem .9rem; color: ${text}; cursor: none; font-size: .85rem; }
        .lp-hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8rem 2rem 4rem; position: relative; }
        .lp-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(26,76,255,0.15); border: 1px solid rgba(26,76,255,0.4); padding: .4rem 1rem; border-radius: 20px; font-size: .78rem; color: #7ba8ff; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2rem; opacity: 0; animation: lpFadeUp .7s .3s ease both; }
        .lp-badge-dot { width: 6px; height: 6px; background: #00d4ff; border-radius: 50%; animation: lpPulse 1.5s infinite; display: inline-block; }
        @keyframes lpPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(0,212,255,.6); } 50% { box-shadow: 0 0 0 6px rgba(0,212,255,0); } }
        .lp-title { font-size: clamp(3.2rem,8vw,6.5rem); font-weight: 700; line-height: .95; letter-spacing: -3px; margin-bottom: 1.5rem; color: ${text}; opacity: 0; animation: lpFadeUp .8s .5s ease both; }
        .lp-title-grad { display: block; background: linear-gradient(90deg,#4d78ff,#00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .lp-sub { font-size: 1.1rem; color: ${muted}; max-width: 500px; line-height: 1.7; margin-bottom: 2.5rem; opacity: 0; animation: lpFadeUp .8s .7s ease both; }
        .lp-ctas { display: flex; gap: 1rem; align-items: center; opacity: 0; animation: lpFadeUp .8s .9s ease both; }
        .lp-btn-primary { background: #1a4cff; color: #f7f6f2; padding: .85rem 2rem; border-radius: 8px; font-size: .95rem; font-weight: 500; text-decoration: none; cursor: none; transition: transform .2s, box-shadow .2s; display: inline-block; }
        .lp-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(26,76,255,.5); }
        .lp-btn-ghost { color: ${muted}; font-size: .9rem; text-decoration: none; cursor: none; display: flex; align-items: center; gap: 6px; transition: color .2s, gap .2s; }
        .lp-btn-ghost:hover { color: ${text}; gap: 10px; }
        @keyframes lpFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .lp-hash { margin-top: 3.5rem; font-family: 'Courier New',monospace; font-size: .78rem; color: rgba(0,212,255,0.5); letter-spacing: 2px; opacity: 0; animation: lpFadeUp .8s 1.1s ease both; user-select: none; }
        .hash-span { animation: hashFlicker 3s infinite; }
        @keyframes hashFlicker { 0%,100% { opacity: .5; } 50% { opacity: 1; color: #00d4ff; } }
        .lp-scroll-hint { position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 0; animation: lpFadeUp .8s 1.4s ease both; }
        .lp-scroll-hint span { font-size: .7rem; color: ${muted}; letter-spacing: 2px; text-transform: uppercase; }
        .lp-scroll-line { width: 1px; height: 40px; background: linear-gradient(#00d4ff,transparent); animation: scrollDrop 1.5s ease-in-out infinite; }
        @keyframes scrollDrop { 0% { transform: scaleY(0); transform-origin: top; } 50% { transform: scaleY(1); transform-origin: top; } 51% { transform: scaleY(1); transform-origin: bottom; } 100% { transform: scaleY(0); transform-origin: bottom; } }
        .lp-section { padding: 7rem 3rem; max-width: 1100px; margin: 0 auto; }
        .lp-section-label { font-size: .75rem; letter-spacing: 3px; text-transform: uppercase; color: #00d4ff; margin-bottom: 1rem; }
        .lp-section-title { font-size: clamp(2rem,4vw,3.2rem); font-weight: 700; letter-spacing: -1.5px; line-height: 1.05; margin-bottom: 1rem; color: ${text}; }
        .lp-section-sub { color: ${muted}; font-size: 1rem; max-width: 500px; line-height: 1.7; margin-bottom: 4rem; }
        .lp-timeline { position: relative; display: flex; flex-direction: column; }
        .lp-timeline::before { content: ''; position: absolute; left: 28px; top: 0; bottom: 0; width: 1px; background: linear-gradient(#1a4cff,#00d4ff,#00ff9d); opacity: .4; }
        .t-step { display: flex; gap: 2rem; align-items: flex-start; padding: 2.5rem 0; border-bottom: 1px solid ${border}; opacity: 0; transform: translateX(-30px); transition: opacity .6s ease,transform .6s ease; }
        .t-step.lp-visible { opacity: 1; transform: translateX(0); }
        .t-step:last-child { border-bottom: none; }
        .t-num { width: 56px; height: 56px; border-radius: 50%; border: 1px solid ${border}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 700; flex-shrink: 0; background: ${cardBg}; color: ${text}; transition: border-color .3s,box-shadow .3s; }
        .t-step:hover .t-num { border-color: #00d4ff; box-shadow: 0 0 20px rgba(0,212,255,0.4); }
        .t-content h3 { font-size: 1.35rem; font-weight: 600; letter-spacing: -.5px; margin-bottom: .5rem; color: ${text}; }
        .t-content p { color: ${muted}; font-size: .9rem; line-height: 1.7; max-width: 500px; }
        .t-tag { display: inline-block; margin-top: .8rem; font-size: .72rem; font-family: 'Courier New',monospace; color: #00d4ff; background: rgba(0,212,255,.08); border: 1px solid rgba(0,212,255,.25); padding: 3px 10px; border-radius: 4px; letter-spacing: 1px; }
        .lp-stats-section { background: ${cardBg}; border-top: 1px solid ${border}; border-bottom: 1px solid ${border}; padding: 5rem 3rem; backdrop-filter: blur(10px); }
        .lp-stats-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(3,1fr); gap: 2px; background: ${border}; }
        .stat-card { background: ${cardBg}; padding: 3rem 2.5rem; opacity: 0; transform: translateY(20px); transition: opacity .5s ease,transform .5s ease; backdrop-filter: blur(10px); }
        .stat-card.lp-visible { opacity: 1; transform: translateY(0); }
        .stat-n { font-size: 4rem; font-weight: 700; letter-spacing: -2px; background: linear-gradient(135deg,${text},#00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; display: block; }
        .stat-l { font-size: .85rem; color: ${muted}; margin-top: .4rem; }
        .scenario-card { background: ${cardBg}; border: 1px solid ${border}; border-radius: 16px; overflow: hidden; opacity: 0; transform: translateY(30px); transition: opacity .7s ease,transform .7s ease; backdrop-filter: blur(10px); }
        .scenario-card.lp-visible { opacity: 1; transform: translateY(0); }
        .sc-header { background: linear-gradient(135deg,rgba(26,76,255,.15),rgba(0,212,255,.1)); padding: 2rem 2.5rem; border-bottom: 1px solid ${border}; display: flex; align-items: center; gap: 1rem; }
        .sc-header h3 { font-size: 1.3rem; font-weight: 600; color: ${text}; }
        .sc-body { padding: 2.5rem; }
        .sc-flow { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
        .sc-node { background: rgba(255,255,255,0.04); border: 1px solid ${border}; border-radius: 10px; padding: .8rem 1.2rem; text-align: center; min-width: 100px; transition: border-color .3s,background .3s; }
        .sc-node:hover { border-color: rgba(0,212,255,.4); background: rgba(0,212,255,.07); }
        .sc-n-label { font-size: .72rem; color: ${muted}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .sc-n-val { font-size: .88rem; font-weight: 500; color: ${text}; }
        .sc-arrow { color: rgba(0,212,255,.6); font-size: 1.2rem; padding: 0 4px; }
        .sc-outcome { margin-top: 2rem; padding: 1.2rem 1.5rem; background: rgba(0,255,157,.07); border: 1px solid rgba(0,255,157,.25); border-radius: 10px; font-size: .95rem; color: #00ff9d; display: flex; align-items: center; gap: .8rem; }
        .tech-grid-lp { display: grid; grid-template-columns: repeat(auto-fill,minmax(150px,1fr)); gap: 12px; margin-top: 3rem; }
        .tech-chip-lp { background: ${cardBg}; border: 1px solid ${border}; border-radius: 10px; padding: 1rem; font-size: .82rem; color: ${muted}; opacity: 0; transform: translateY(16px); backdrop-filter: blur(10px); }
        .tech-chip-lp.lp-visible { opacity: 1; transform: translateY(0); transition: opacity .5s ease,transform .5s ease,border-color .25s,color .25s; }
        .tech-chip-lp:hover { border-color: rgba(0,212,255,.5); color: ${text}; transform: translateY(-3px) !important; }
        .tech-chip-icon { font-size: 1.2rem; margin-bottom: .5rem; display: block; }
        .tech-chip-name { font-weight: 500; display: block; margin-bottom: 2px; color: ${text}; }
        .lp-cta-section { padding: 8rem 3rem; text-align: center; position: relative; }
        .lp-cta-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 600px; height: 400px; background: radial-gradient(ellipse,rgba(26,76,255,.15) 0%,transparent 70%); pointer-events: none; }
        .lp-cta-section h2 { font-size: clamp(2.5rem,5vw,4rem); font-weight: 700; letter-spacing: -2px; margin-bottom: 1.5rem; color: ${text}; position: relative; z-index: 1; }
        .lp-cta-section p { color: ${muted}; font-size: 1rem; max-width: 400px; margin: 0 auto 2.5rem; position: relative; z-index: 1; }
        .lp-cta-buttons { display: flex; gap: 1rem; justify-content: center; position: relative; z-index: 1; }
        .lp-btn-outline { border: 1px solid ${border}; color: ${muted}; background: transparent; padding: .85rem 2rem; border-radius: 8px; font-size: .95rem; text-decoration: none; cursor: none; transition: border-color .2s,color .2s; display: inline-block; }
        .lp-btn-outline:hover { border-color: ${text}; color: ${text}; }
        .lp-footer { border-top: 1px solid ${border}; padding: 2rem 3rem; display: flex; align-items: center; justify-content: space-between; color: ${muted}; font-size: .8rem; }
        .lp-footer-logo { font-weight: 700; font-size: 1rem; color: ${text}; }
        .lp-footer-logo span { color: #00d4ff; }
        .lp-reveal { opacity: 0; transform: translateY(30px); transition: opacity .7s ease,transform .7s ease; }
        .lp-reveal.lp-visible { opacity: 1; transform: translateY(0); }
      `}</style>

      <div id="cc-cursor" />
      <div id="cc-ring" />

      <canvas ref={canvasRef} style={{
        position: "fixed", top: 0, left: 0,
        width: "100vw", height: "100vh",
        zIndex: 0, pointerEvents: "none", display: "block"
      }} />

      <div style={{
        position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none",
        background: dark ? "rgba(5,8,15,0.6)" : "rgba(220,235,255,0.6)"
      }} />

      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh" }}>

        <nav className="lp-nav" style={{ background: navBg }}>
          <Link to="/" className="lp-logo">Cert<span>Chain</span></Link>
          <div className="lp-nav-links">
            <a href="#how">How it works</a>
            <a href="#scenario">Use case</a>
            <a href="#tech">Tech</a>
            <Link to="/login" className="lp-nav-cta">Get started</Link>
          </div>
          <button className="lp-theme-btn" onClick={() => setDark(!dark)}>
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </nav>

        <section className="lp-hero">
          <div className="lp-badge">
            <div className="lp-badge-dot" />
            Blockchain-Secured · Polygon · Free Forever
          </div>
          <h1 className="lp-title">
            Chain of Trust
            <span className="lp-title-grad">Secure and Transparent <br />Digital Certificate Verification using Blockchain</span>
          </h1>
          <p className="lp-sub">
            Universities hash degrees on-chain. Employers verify in 3 seconds, for free.
            Zero fake hires. Zero phone calls.
          </p>
          <div className="lp-ctas">
            <Link to="/login" className="lp-btn-primary">Issue a certificate →</Link>
            <a href="#how" className="lp-btn-ghost">See how it works ↓</a>
          </div>
          <div className="lp-hash">
            SHA-256 &nbsp;·&nbsp;
            <span className="hash-span">0x3F8A</span>
            <span className="hash-span">C21D</span>
            <span className="hash-span">7B04</span>
            <span className="hash-span">E9F2</span>
            <span className="hash-span">A831</span>
            <span className="hash-span">D50C</span>
            &nbsp;·&nbsp; POLYGON AMOY
          </div>
          <div className="lp-scroll-hint">
            <span>Scroll</span>
            <div className="lp-scroll-line" />
          </div>
        </section>

        <section id="how" style={{ padding: "7rem 0" }}>
          <div className="lp-section" style={{ paddingTop: 0, paddingBottom: 0 }}>
            <div className="lp-section-label lp-reveal">Process</div>
            <h2 className="lp-section-title lp-reveal" style={{ transitionDelay: ".1s" }}>Three steps.<br />Zero friction.</h2>
            <p className="lp-section-sub lp-reveal" style={{ transitionDelay: ".2s" }}>From graduation to verified hire — all on-chain, all automated.</p>
            <div className="lp-timeline">
              {[
                { n: "01", title: "🔐 Issue — University hashes the degree", desc: "Admin generates a SHA-256 hash of the certificate and stores it on Polygon blockchain via MetaMask. No paper, no middleman.", tag: "SHA-256 · MetaMask · Polygon Amoy" },
                { n: "02", title: "📄 Embed — QR baked into the PDF", desc: "An auto-generated QR code is embedded into the certificate PDF, stored on IPFS and delivered to the graduate.", tag: "QR Code · IPFS · Web3.storage", delay: ".15s" },
                { n: "03", title: "⚡ Verify — Employer scans, result instant", desc: "HR scans the QR. CertifyPro queries the smart contract and returns a tamper-detection result in under 3 seconds. Free forever.", tag: "Solidity · ethers.js · 3-second result", delay: ".3s" },
              ].map((s, i) => (
                <div className="t-step" key={i} style={{ transitionDelay: s.delay || "0s" }}>
                  <div className="t-num">{s.n}</div>
                  <div className="t-content">
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                    <span className="t-tag">{s.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-stats-section">
          <div className="lp-stats-grid">
            {[
              { n: "3s", l: "Average verification time" },
              { n: "Free", l: "Near-zero gas on Polygon" },
              { n: "0%", l: "False verification rate" },
            ].map((s, i) => (
              <div className="stat-card" key={i} style={{ transitionDelay: `${i * 0.15}s` }}>
                <span className="stat-n">{s.n}</span>
                <div className="stat-l">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="scenario" style={{ padding: "7rem 3rem", maxWidth: "1100px", margin: "0 auto" }}>
          <div className="lp-section-label lp-reveal">Real scenario</div>
          <h2 className="lp-section-title lp-reveal" style={{ transitionDelay: ".1s" }}>From graduation<br />to hired — on-chain.</h2>
          <p className="lp-section-sub lp-reveal" style={{ transitionDelay: ".2s" }}>Rahul's journey from IIT Bombay to Google, powered by CertifyPro.</p>
          <div className="scenario-card lp-reveal" style={{ transitionDelay: ".3s" }}>
            <div className="sc-header">
              <span style={{ fontSize: "1.5rem" }}>🎓</span>
              <h3>Rahul Sharma · B.Tech · IIT Bombay · 2024</h3>
            </div>
            <div className="sc-body">
              <div className="sc-flow">
                {[
                  { label: "Graduate", val: "Rahul" },
                  null,
                  { label: "Issuer", val: "IIT Bombay" },
                  null,
                  { label: "On-chain", val: "0x3f8a…c91d", mono: true },
                  null,
                  { label: "Employer", val: "Google HR" },
                  null,
                  { label: "Result", val: "✓ 2.1s", green: true },
                ].map((item, i) => item === null ? (
                  <div className="sc-arrow" key={i}>→</div>
                ) : (
                  <div className="sc-node" key={i} style={item.green ? { borderColor: "rgba(0,255,157,.3)", background: "rgba(0,255,157,.06)" } : {}}>
                    <div className="sc-n-label">{item.label}</div>
                    <div className="sc-n-val" style={
                      item.mono ? { fontFamily: "monospace", fontSize: ".78rem", color: "#00d4ff" }
                        : item.green ? { color: "#00ff9d" } : {}
                    }>{item.val}</div>
                  </div>
                ))}
              </div>
              <div className="sc-outcome">
                <span style={{ fontSize: "1.3rem" }}>🎯</span>
                <span>Zero fake hires. Zero waiting. Zero phone calls to universities.</span>
              </div>
            </div>
          </div>
        </section>

        <section id="tech" style={{ padding: "5rem 3rem", maxWidth: "1100px", margin: "0 auto" }}>
          <div className="lp-section-label lp-reveal">Technical approach</div>
          <h2 className="lp-section-title lp-reveal" style={{ transitionDelay: ".1s" }}>Built on a<br />solid foundation.</h2>
          <p className="lp-section-sub lp-reveal" style={{ transitionDelay: ".2s" }}>MVP-first: smart contract → issuer UI → verifier UI → QR embed.</p>
          <div className="tech-grid-lp">
            {[
              { icon: "⚛️", name: "React + Vite", desc: "Frontend" },
              { icon: "📜", name: "Solidity", desc: "Smart contracts" },
              { icon: "🔨", name: "Hardhat", desc: "Dev tooling" },
              { icon: "🦊", name: "MetaMask", desc: "Wallet API" },
              { icon: "🌐", name: "Polygon", desc: "Amoy testnet" },
              { icon: "📦", name: "IPFS", desc: "Storage" },
              { icon: "🔗", name: "ethers.js v6", desc: "Web3 library" },
              { icon: "🔐", name: "SHA-256", desc: "Hash algorithm" },
            ].map((t, i) => (
              <div className="tech-chip-lp" key={i} style={{ transitionDelay: `${i * 0.05}s` }}>
                <span className="tech-chip-icon">{t.icon}</span>
                <span className="tech-chip-name">{t.name}</span>
                {t.desc}
              </div>
            ))}
          </div>
        </section>

        <section className="lp-cta-section">
          <div className="lp-cta-glow" />
          <h2 className="lp-reveal">Ready to issue<br />tamper-proof certs?</h2>
          <p className="lp-reveal" style={{ transitionDelay: ".1s" }}>Free to verify. Forever on-chain.</p>
          <div className="lp-cta-buttons lp-reveal" style={{ transitionDelay: ".2s" }}>
            <Link to="/login" className="lp-btn-primary">Start issuing →</Link>
            <Link to="/verify" className="lp-btn-outline">Verify a certificate</Link>
          </div>
        </section>

        <footer className="lp-footer">
          <div className="lp-footer-logo">Cert<span>Chain</span></div>
          <div>Built on Polygon · IPFS · Solidity</div>
          <div>© 2026 CertifyPro</div>
        </footer>

      </div>
    </>
  );
}