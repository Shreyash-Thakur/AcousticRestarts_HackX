import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { platformStats as fallbackStats } from "../data/mockData";
import { fetchStats } from "../lib/api";
import Footer from "../components/Footer";
import RevealOnScroll from "../components/RevealOnScroll";

/* ── Icons ── */
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const LayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);
const TrendingIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.11 } } };

const steps = [
  {
    num: "01",
    role: "SME",
    title: "Upload & Tokenize",
    desc: "Upload your invoice PDF. Our protocol auto-parses details, scores your risk, and mints an on-chain token representing the invoice.",
    color: "var(--gold)",
    accentRgb: "180, 130, 60",
  },
  {
    num: "02",
    role: "Protocol",
    title: "AI Risk Scoring",
    desc: "The InvoFlow engine assesses payment reliability, invoice legitimacy, and business profile to generate a transparent trust score.",
    color: "#1D4ED8",
    accentRgb: "29, 78, 216",
  },
  {
    num: "03",
    role: "Investor",
    title: "Fund & Earn",
    desc: "Investors browse the marketplace, select invoices by risk and yield, fund any portion, and earn returns when the invoice settles.",
    color: "#B45309",
    accentRgb: "180, 83, 9",
  },
];

const features = [
  { icon: <LayersIcon />, title: "On-Chain Tokenization",   desc: "Every invoice becomes a transparent, auditable ERC-721 token.",           color: "#1D4ED8" },
  { icon: <ShieldIcon />, title: "AI Trust Scoring",        desc: "Multi-dimensional scoring across payment history, legitimacy, and profile.", color: "var(--gold)" },
  { icon: <TrendingIcon />,title:"Yield Optimization",      desc: "Filter by yield, risk, and maturity to build your ideal portfolio.",        color: "#B45309" },
];

/* ── Parse stat string → { prefix, num, suffix, decimals } ── */
function parseStatValue(val) {
  const s = String(val);
  let prefix = "", suffix = "", numStr = s;
  if (s.startsWith("$"))      { prefix = "$"; numStr = s.slice(1); }
  if (numStr.endsWith("M"))   { suffix = "M"; numStr = numStr.slice(0, -1); }
  else if (numStr.endsWith("%")) { suffix = "%"; numStr = numStr.slice(0, -1); }
  const num      = parseFloat(numStr);
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  return { prefix, num, suffix, decimals };
}

/* ── Animated count-up number ── */
function CountUpNumber({ value, triggered }) {
  const { prefix, num, suffix, decimals } = parseStatValue(value);
  const [current, setCurrent] = useState(0);
  const rafRef     = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!triggered || startedRef.current) return;
    startedRef.current = true;
    const DURATION = 1600;
    const t0 = performance.now();

    const tick = (now) => {
      const t = Math.min((now - t0) / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCurrent(num * eased);
      if (t < 1) { rafRef.current = requestAnimationFrame(tick); }
      else        { setCurrent(num); }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [triggered, num]);

  return <span>{prefix}{current.toFixed(decimals)}{suffix}</span>;
}

/* ── Hero dot-grid canvas (more visible settings) ── */
function HeroDotGrid({ mousePosRef }) {
  const canvasRef = useRef(null);
  const dotsRef   = useRef([]);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const SPACING = 22;
    const DOT_R   = 2.4;

    const buildGrid = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const cols = Math.ceil(canvas.width  / SPACING) + 2;
      const rows = Math.ceil(canvas.height / SPACING) + 2;
      dotsRef.current = [];
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          dotsRef.current.push({ bx: c * SPACING, by: r * SPACING, ox: 0, oy: 0 });
    };

    buildGrid();
    const ro = new ResizeObserver(buildGrid);
    ro.observe(canvas);

    const draw = () => {
      const { x: mx, y: my } = mousePosRef.current;
      const rect  = canvas.getBoundingClientRect();
      const cmx   = mx - rect.left;
      const cmy   = my - rect.top;

      const MAX_DRIFT = 6;
      const RADIUS    = 210;

      dotsRef.current.forEach((dot) => {
        const dx   = dot.bx - cmx;
        const dy   = dot.by - cmy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let tx = 0, ty = 0;
        if (dist < RADIUS && dist > 0) {
          const str = (1 - dist / RADIUS) * MAX_DRIFT;
          tx = (dx / dist) * str;
          ty = (dy / dist) * str;
        }
        dot.ox += (tx - dot.ox) * 0.07;
        dot.oy += (ty - dot.oy) * 0.07;
      });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(158, 112, 48, 0.16)";
      dotsRef.current.forEach((dot) => {
        ctx.beginPath();
        ctx.arc(dot.bx + dot.ox, dot.by + dot.oy, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(rafRef.current); ro.disconnect(); };
  }, [mousePosRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", display: "block" }}
    />
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(fallbackStats);

  useEffect(() => {
    fetchStats()
      .then((data) => {
        if (data && data.totalFunded) setStats(data);
      })
      .catch(() => {});
  }, []);

  const statItems = [
    { label: "Total Funded",     value: stats.totalFunded,     note: "Across all invoices" },
    { label: "Active Invoices",  value: stats.activeInvoices,  note: "Currently raising" },
    { label: "Average Yield",    value: stats.avgYield,        note: "Annualized return" },
    { label: "Avg. Trust Score", value: stats.avgTrustScore,   note: "Out of 100" },
  ];

  /* ── Hero mouse tracking ── */
  const heroRef      = useRef(null);
  const gradientRef  = useRef(null);
  const mousePosRef  = useRef({ x: -9999, y: -9999 });

  const handleMouseMove = useCallback((e) => {
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    if (gradientRef.current && heroRef.current) {
      const rect = heroRef.current.getBoundingClientRect();
      gradientRef.current.style.left = (e.clientX - rect.left) + "px";
      gradientRef.current.style.top  = (e.clientY - rect.top)  + "px";
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    mousePosRef.current = { x: -9999, y: -9999 };
  }, []);

  /* ── Stats count-up via IntersectionObserver ── */
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
          paddingTop: "var(--nav-h)",
          background: "linear-gradient(160deg, #FAF8F5 0%, #F5F0E8 50%, #FAF8F5 100%)",
        }}
      >
        {/* Dot grid */}
        <HeroDotGrid mousePosRef={mousePosRef} />

        {/* Mouse-follow warm halo — more visible */}
        <div
          ref={gradientRef}
          style={{
            position: "absolute",
            width: 408,
            height: 408,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(225,200,148,0.46) 0%, rgba(235,218,178,0.22) 42%, transparent 70%)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            left: "50%",
            top: "50%",
            willChange: "left, top",
          }}
        />

        <div className="container" style={{ position: "relative", zIndex: 1, paddingTop: "3rem", paddingBottom: "5rem" }}>
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            style={{ maxWidth: 760, margin: "0 auto", textAlign: "center" }}
          >
            <motion.div variants={fadeUp}>
              <span className="section-tag">Decentralized Invoice Financing</span>
            </motion.div>

            <motion.h1 variants={fadeUp} style={{
              fontSize: "clamp(2.6rem, 6.5vw, 4.5rem)",
              fontWeight: 800,
              color: "var(--text)",
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              marginBottom: "1.5rem",
            }}>
              Tokenize Invoices.<br />
              Unlock Instant{" "}
              <em style={{ fontStyle: "italic", color: "var(--gold)" }}>Liquidity.</em>
            </motion.h1>

            <motion.p variants={fadeUp} style={{
              fontSize: "1.15rem",
              color: "var(--text-muted)",
              maxWidth: 520,
              margin: "0 auto 2.75rem",
              lineHeight: 1.75,
              fontFamily: "var(--font-body)",
            }}>
              Connect your business invoices to a global network of investors.
              Get funded in hours, not months — transparently, on-chain.
            </motion.p>

            <motion.div variants={fadeUp} style={{ display: "flex", gap: "0.85rem", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                className="btn btn-gold btn-lg"
                onClick={() => navigate("/upload")}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
              >
                <UploadIcon />
                Upload Invoice
              </button>
              <button
                onClick={() => navigate("/marketplace")}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.9rem 2rem",
                  borderRadius: "var(--radius)",
                  fontSize: "1rem",
                  fontWeight: 600,
                  background: "transparent",
                  border: "1.5px solid rgba(28,25,23,0.22)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.18s",
                  fontFamily: "var(--font-body)",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.color = "var(--gold)"; e.currentTarget.style.background = "var(--gold-dim)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(28,25,23,0.22)"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
              >
                <SearchIcon />
                Browse Marketplace
                <ArrowRightIcon />
              </button>
            </motion.div>

            <motion.div variants={fadeUp} style={{ marginTop: "2rem", display: "flex", gap: "1.75rem", justifyContent: "center", flexWrap: "wrap" }}>
              {["Non-custodial", "Audited smart contracts", "0% platform fee for SMEs"].map((t) => (
                <span key={t} style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  fontSize: "0.83rem",
                  color: "var(--text-dim)",
                  fontFamily: "var(--font-body)",
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(21,128,61,0.12)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: "var(--gold)",
                  }}><CheckIcon /></span>
                  {t}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section
        ref={statsRef}
        style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}
      >
        <div className="container">
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
            {statItems.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.65rem",
                  padding: "0.65rem 2rem",
                  borderRight: "1px solid var(--border)",
                }}
              >
                <span style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1.55rem",
                  fontWeight: 700,
                  color: "var(--gold)",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  minWidth: "4ch",
                  display: "inline-block",
                }}>
                  <CountUpNumber value={stat.value} triggered={statsVisible} />
                </span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)", lineHeight: 1.3 }}>
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="section" style={{ background: "var(--bg)" }}>
        <div className="container">
          <div className="section-header">
            <RevealOnScroll>
              <h2 className="section-title">Three steps to liquidity</h2>
            </RevealOnScroll>
            <p className="section-desc">From invoice upload to funded in under 24 hours.</p>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
            {steps.map((step, i) => (
              <div key={step.num} style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                <motion.div
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.14, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                  style={{ flex: 1, paddingRight: i < steps.length - 1 ? "2.5rem" : 0, paddingLeft: i > 0 ? "2.5rem" : 0 }}
                >
                  <div style={{
                    fontFamily: "var(--font-head)",
                    fontSize: "4.5rem",
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                    color: step.color,
                    opacity: 0.22,
                    marginBottom: "0.85rem",
                    userSelect: "none",
                  }}>
                    {step.num}
                  </div>
                  <span style={{
                    display: "inline-block",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: step.color,
                    border: `1px solid rgba(${step.accentRgb}, 0.28)`,
                    padding: "0.18rem 0.6rem",
                    borderRadius: "999px",
                    fontFamily: "var(--font-body)",
                    marginBottom: "0.8rem",
                  }}>
                    {step.role}
                  </span>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "var(--font-head)", color: "var(--text)", lineHeight: 1.25 }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.75, fontFamily: "var(--font-body)", margin: 0 }}>
                    {step.desc}
                  </p>
                </motion.div>

                {/* Connector */}
                {i < steps.length - 1 && (
                  <motion.div
                    className="hide-mobile"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.14 + 0.3, duration: 0.4 }}
                    style={{ display: "flex", alignItems: "center", flexShrink: 0, paddingTop: "2.2rem", color: "rgba(28,25,23,0.18)" }}
                  >
                    <div style={{ width: 28, height: 1, background: "rgba(28,25,23,0.14)" }} />
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="section-header">
            <RevealOnScroll>
              <h2 className="section-title">Everything built into one protocol</h2>
            </RevealOnScroll>
            <p className="section-desc">Designed for SMEs that need working capital and investors who want transparent yield.</p>
          </div>

          <div className="grid-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  padding: "2rem 1.75rem",
                  borderTop: `2px solid ${f.color}`,
                  background: "var(--bg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                <span style={{ color: f.color }}>{f.icon}</span>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>{f.title}</h3>
                <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.75, fontFamily: "var(--font-body)" }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ background: "var(--gold)", padding: "5rem 0" }}>
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}
          >
            <h2 style={{
              fontFamily: "var(--font-head)",
              fontSize: "2.4rem",
              fontWeight: 800,
              color: "#fff",
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}>
              Ready to unlock your invoices?
            </h2>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.05rem", marginBottom: "2.25rem", lineHeight: 1.75, fontFamily: "var(--font-body)" }}>
              Join hundreds of SMEs and investors already using InvoFlow to access working capital and earn transparent yield.
            </p>

            {/* Staggered buttons — first after heading settles, second 150ms later */}
            <div style={{ display: "flex", gap: "0.85rem", justifyContent: "center", flexWrap: "wrap" }}>
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.42, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={() => navigate("/upload")}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.9rem 2rem",
                    borderRadius: "var(--radius)",
                    background: "#fff",
                    color: "var(--gold)",
                    border: "none",
                    fontSize: "1rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    transition: "all 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F0FDF4"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <UploadIcon /> Upload Invoice
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.57, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              >
                <button
                  onClick={() => navigate("/marketplace")}
                  style={{
                    display: "flex", alignItems: "center", gap: "0.5rem",
                    padding: "0.9rem 2rem",
                    borderRadius: "var(--radius)",
                    background: "transparent",
                    color: "#fff",
                    border: "1.5px solid rgba(255,255,255,0.4)",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    transition: "all 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.4)"; e.currentTarget.style.background = "transparent"; }}
                >
                  <SearchIcon /> Browse Marketplace
                </button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
