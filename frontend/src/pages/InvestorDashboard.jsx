import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { investorPortfolio } from "../data/mockData";
import { TrustScoreRing } from "../components/TrustScoreRing";
import PageBackground from "../components/PageBackground";
import RevealOnScroll from "../components/RevealOnScroll";

/* ── Icons ── */
const TrendUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
);
const WalletIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
  </svg>
);
const LayersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
  </svg>
);
const PercentIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
  </svg>
);
const TagIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const totalInvested = investorPortfolio.reduce((s, p) => s + p.investedAmount, 0);
const totalExpected = investorPortfolio.reduce((s, p) => s + p.investedAmount + p.expectedReturn, 0);
const avgYield = (investorPortfolio.reduce((s, p) => s + p.yield, 0) / investorPortfolio.length).toFixed(1);

const metrics = [
  { label: "Total Invested",   value: `$${totalInvested.toLocaleString()}`, icon: <WalletIcon />,  color: "#15803D", bg: "#DCFCE7", desc: "Across all positions" },
  { label: "Portfolio Value",  value: `$${totalExpected.toLocaleString()}`, icon: <TrendUpIcon />, color: "#1D4ED8", bg: "#DBEAFE", desc: "Including expected returns" },
  { label: "Average Yield",   value: `${avgYield}%`,                        icon: <PercentIcon />, color: "#B45309", bg: "#FEF3C7", desc: "Annualized" },
  { label: "Active Positions", value: String(investorPortfolio.length),      icon: <LayersIcon />,  color: "#0D9488", bg: "#CCFBF1", desc: "Funded invoices" },
];

const riskColor = { Low: "#15803D", Medium: "#B45309", High: "#B91C1C" };

/* ── Custom SVG scatter chart ── */
function YieldRiskChart({ positions }) {
  const W = 400, H = 220;
  const pad = { top: 20, right: 24, bottom: 40, left: 48 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;

  const maxY = 20;
  const cx = (pos) => pad.left + ((100 - pos.trustScore) / 100) * cW;
  const cy = (pos) => pad.top + cH - (pos.yield / maxY) * cH;
  const r  = (pos) => Math.max(8, Math.min(20, Math.sqrt(pos.investedAmount / 220)));

  const xTicks = [0, 25, 50, 75, 100];
  const yTicks = [0, 5, 10, 15, 20];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W, height: "auto" }}>
      {/* Grid */}
      {yTicks.map((t) => {
        const y = pad.top + cH - (t / maxY) * cH;
        return (
          <g key={t}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(28,25,23,0.07)" strokeWidth={1}/>
            <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#A8A29E" fontSize={9}>{t}%</text>
          </g>
        );
      })}
      {xTicks.map((t) => {
        const x = pad.left + (t / 100) * cW;
        return (
          <g key={t}>
            <line x1={x} y1={pad.top} x2={x} y2={pad.top + cH} stroke="rgba(28,25,23,0.06)" strokeWidth={1}/>
            <text x={x} y={H - 8} textAnchor="middle" fill="#A8A29E" fontSize={9}>{t}</text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={W / 2} y={H - 1} textAnchor="middle" fill="#78716C" fontSize={10}>Risk Score →</text>
      <text x={8} y={H / 2} textAnchor="middle" fill="#78716C" fontSize={10} transform={`rotate(-90, 8, ${H / 2})`}>Yield →</text>

      {/* Quadrant shading */}
      <rect x={pad.left} y={pad.top} width={cW / 2} height={cH / 2} fill="rgba(21,128,61,0.04)" rx={2}/>
      <rect x={pad.left + cW / 2} y={pad.top + cH / 2} width={cW / 2} height={cH / 2} fill="rgba(185,28,28,0.03)" rx={2}/>

      {/* Data points */}
      {positions.map((pos) => {
        const x = cx(pos), y = cy(pos), radius = r(pos);
        const color = riskColor[pos.riskLevel];
        return (
          <g key={pos.id}>
            <circle cx={x} cy={y} r={radius + 5} fill={`${color}10`}/>
            <circle cx={x} cy={y} r={radius} fill={`${color}CC`} stroke={color} strokeWidth={1.5}/>
            <title>{pos.business} · {pos.yield}% yield · ${pos.investedAmount.toLocaleString()}</title>
          </g>
        );
      })}

      {/* Legend */}
      {[["Low", "#15803D"], ["Medium", "#B45309"], ["High", "#B91C1C"]].map(([label, color], i) => (
        <g key={label} transform={`translate(${W - 92}, ${pad.top + i * 17})`}>
          <circle cx={6} cy={6} r={5} fill={`${color}CC`} stroke={color} strokeWidth={1}/>
          <text x={14} y={10} fill="#78716C" fontSize={9.5}>{label} Risk</text>
        </g>
      ))}
    </svg>
  );
}

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const [listed, setListed] = useState({});
  const handleList = (id) => setListed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <PageBackground className="page" style={{ background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <RevealOnScroll>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.25rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                Investor Portfolio
              </h1>
            </RevealOnScroll>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>
              Track your active positions and manage returns
            </p>
          </div>
          <button
            className="btn btn-gold"
            onClick={() => navigate("/marketplace")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <SearchIcon /> Browse Marketplace
          </button>
        </div>

        {/* Metrics */}
        <div className="grid-4" style={{ marginBottom: "2.5rem" }}>
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className="metric-card"
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="metric-label">{m.label}</span>
                <div style={{ width: 38, height: 38, borderRadius: "10px", background: m.bg, display: "flex", alignItems: "center", justifyContent: "center", color: m.color }}>
                  {m.icon}
                </div>
              </div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-sub">{m.desc}</div>
            </motion.div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "1.75rem", alignItems: "start" }}>

          {/* ── Positions ── */}
          <div>
            <RevealOnScroll>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1.25rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                Active Positions
              </h2>
            </RevealOnScroll>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {investorPortfolio.map((pos, i) => (
                <motion.div
                  key={pos.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.09, duration: 0.4 }}
                  className="card"
                  style={{ position: "relative", overflow: "hidden" }}
                >
                  {/* Left accent */}
                  <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3px", background: riskColor[pos.riskLevel], opacity: 0.8 }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", paddingLeft: "0.25rem" }}>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.3rem" }}>
                        <span className={`badge badge-${pos.riskLevel.toLowerCase()}`}>{pos.riskLevel}</span>
                        <span className={`badge badge-${pos.status}`}>{pos.status}</span>
                      </div>
                      <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-head)", marginBottom: "0.15rem" }}>
                        {pos.business}
                      </p>
                      <p style={{ fontSize: "0.76rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>{pos.invoiceNumber}</p>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: "1.75rem", flexWrap: "wrap" }}>
                      {[
                        ["Invested",         `$${pos.investedAmount.toLocaleString()}`, "var(--text)"],
                        ["Expected Return",  `+$${pos.expectedReturn.toLocaleString()}`, "#15803D"],
                        ["Yield",            `${pos.yield}%`,                            "#15803D"],
                        ["Matures in",       pos.daysToMaturity === 0 ? "Today" : `${pos.daysToMaturity}d`, "var(--text-muted)"],
                      ].map(([k, v, c]) => (
                        <div key={k} style={{ textAlign: "center" }}>
                          <p style={{ fontSize: "0.67rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.2rem", fontFamily: "var(--font-body)" }}>{k}</p>
                          <p style={{ fontWeight: 700, color: c, fontSize: "0.92rem", fontFamily: "var(--font-body)" }}>{v}</p>
                        </div>
                      ))}
                    </div>

                    {/* Trust + actions */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.65rem" }}>
                      <TrustScoreRing score={pos.trustScore} size={52} strokeWidth={5} />
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: "0.74rem", display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--text-muted)" }}
                          onClick={() => navigate(`/invoice/${pos.id}`)}
                        >
                          View <ExternalIcon />
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleList(pos.id)}
                          style={{
                            fontSize: "0.74rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            background: listed[pos.id] ? "#DCFCE7" : "var(--surface)",
                            border: `1.5px solid ${listed[pos.id] ? "rgba(21,128,61,0.3)" : "var(--border)"}`,
                            color: listed[pos.id] ? "#15803D" : "var(--text-muted)",
                            borderRadius: "var(--radius)",
                          }}
                        >
                          <TagIcon /> {listed[pos.id] ? "Listed" : "List for Sale"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Maturity bar */}
                  <div style={{ marginTop: "0.85rem", paddingLeft: "0.25rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>Maturity</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                        {pos.daysToMaturity === 0 ? "Ready to settle" : `${pos.daysToMaturity} days remaining`}
                      </span>
                    </div>
                    <div style={{ background: "rgba(28,25,23,0.07)", borderRadius: "999px", height: 4, overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        background: pos.daysToMaturity <= 7 ? "#15803D" : "linear-gradient(90deg, #15803D, #22C55E)",
                        width: `${Math.max(5, 100 - (pos.daysToMaturity / 60) * 100)}%`,
                        borderRadius: "999px",
                        transition: "width 1s ease",
                      }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Right panel ── */}
          <div style={{ position: "sticky", top: "calc(var(--nav-h) + 1.5rem)", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Chart */}
            <div className="card">
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.2rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                Yield vs. Risk
              </h3>
              <p style={{ fontSize: "0.76rem", color: "var(--text-dim)", marginBottom: "1.25rem", fontFamily: "var(--font-body)" }}>
                Bubble size = amount invested
              </p>
              <YieldRiskChart positions={investorPortfolio} />
            </div>

            {/* Portfolio breakdown */}
            <div className="card" style={{ background: "var(--surface)", boxShadow: "none" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1.25rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                Portfolio Breakdown
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {investorPortfolio.map((pos) => {
                  const pct = (pos.investedAmount / totalInvested) * 100;
                  const color = riskColor[pos.riskLevel];
                  return (
                    <div key={pos.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{pos.business}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color, fontFamily: "var(--font-body)" }}>
                          ${pos.investedAmount.toLocaleString()} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div style={{ background: "rgba(28,25,23,0.08)", borderRadius: "999px", height: 5, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: color, width: `${pct}%`, borderRadius: "999px", transition: "width 1s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick actions */}
            <div className="card">
              <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "1rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                Quick Actions
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <button className="btn btn-gold" style={{ justifyContent: "center" }} onClick={() => navigate("/marketplace")}>
                  Find New Invoices
                </button>
                <button className="btn btn-outline" style={{ justifyContent: "center" }}>
                  Export Portfolio CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
