import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { platformStats } from "../data/mockData";
import Footer from "../components/Footer";

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
const ZapIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
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
const RepeatIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
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
    bg: "#DCFCE7",
  },
  {
    num: "02",
    role: "Protocol",
    title: "AI Risk Scoring",
    desc: "The InvoFlow engine assesses payment reliability, invoice legitimacy, and business profile to generate a transparent trust score.",
    color: "#1D4ED8",
    bg: "#DBEAFE",
  },
  {
    num: "03",
    role: "Investor",
    title: "Fund & Earn",
    desc: "Investors browse the marketplace, select invoices by risk and yield, fund any portion, and earn returns when the invoice settles.",
    color: "#B45309",
    bg: "#FEF3C7",
  },
];

const features = [
  { icon: <LayersIcon />, title: "On-Chain Tokenization",   desc: "Every invoice becomes a transparent, auditable ERC-721 token.",           color: "#1D4ED8", bg: "#DBEAFE" },
  { icon: <ShieldIcon />, title: "AI Trust Scoring",        desc: "Multi-dimensional scoring across payment history, legitimacy, and profile.", color: "var(--gold)", bg: "#DCFCE7" },
  { icon: <TrendingIcon />,title:"Yield Optimization",      desc: "Filter by yield, risk, and maturity to build your ideal portfolio.",        color: "#B45309", bg: "#FEF3C7" },
];

const statItems = [
  { label: "Total Funded",     value: platformStats.totalFunded,     note: "Across all invoices" },
  { label: "Active Invoices",  value: platformStats.activeInvoices,  note: "Currently raising" },
  { label: "Average Yield",    value: platformStats.avgYield,        note: "Annualized return" },
  { label: "Avg. Trust Score", value: platformStats.avgTrustScore,   note: "Out of 100" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Hero ── */}
      <section style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        paddingTop: "var(--nav-h)",
        background: "linear-gradient(160deg, #FAF8F5 0%, #F5F0E8 50%, #FAF8F5 100%)",
      }}>
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
      <section style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "2rem 0" }}>
        <div className="container">
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
            {statItems.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07, duration: 0.35 }}
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
                }}>
                  {stat.value}
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
            <h2 className="section-title">Three steps to liquidity</h2>
            <p className="section-desc">From invoice upload to funded in under 24 hours.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem" }}>
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                style={{
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "2rem",
                  boxShadow: "var(--shadow-card)",
                  position: "relative",
                }}
              >
                {/* Number */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  marginBottom: "1.25rem",
                }}>
                  <div style={{
                    width: 44, height: 44,
                    borderRadius: "12px",
                    background: step.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-head)",
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: step.color,
                    flexShrink: 0,
                  }}>
                    {step.num}
                  </div>
                  <span style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: step.color,
                    background: step.bg,
                    padding: "0.2rem 0.6rem",
                    borderRadius: "999px",
                    fontFamily: "var(--font-body)",
                  }}>
                    {step.role}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.6rem", fontFamily: "var(--font-head)" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.7, fontFamily: "var(--font-body)" }}>
                  {step.desc}
                </p>

                {/* Connector arrow */}
                {i < steps.length - 1 && (
                  <div className="hide-mobile" style={{
                    position: "absolute",
                    right: "-1.2rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    zIndex: 2,
                    color: "var(--text-dim)",
                  }}>
                    <ArrowRightIcon />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Everything built into one protocol</h2>
            <p className="section-desc">Designed for SMEs that need working capital and investors who want transparent yield.</p>
          </div>

          <div className="grid-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, duration: 0.45 }}
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
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
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
            <div style={{ display: "flex", gap: "0.85rem", justifyContent: "center", flexWrap: "wrap" }}>
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
            </div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
