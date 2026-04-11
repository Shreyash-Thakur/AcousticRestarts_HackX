import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { invoices } from "../data/mockData";
import { TrustScoreRing, SubScoreBar } from "../components/TrustScoreRing";
import PageBackground from "../components/PageBackground";
import RevealOnScroll from "../components/RevealOnScroll";

/* ── Icons ── */
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const riskClass = (level) => `badge badge-${level.toLowerCase()}`;

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const invoice = invoices.find((inv) => inv.id === id);

  const [investAmount, setInvestAmount] = useState("");
  const [insurance, setInsurance] = useState(false);
  const [funded, setFunded] = useState(false);
  const [listForSale, setListForSale] = useState(false);

  const holdsPosition = ["INV-001", "INV-005"].includes(id);
  const myPosition = holdsPosition ? 15000 : 0;

  if (!invoice) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", marginBottom: "1rem", fontFamily: "var(--font-body)" }}>
            Invoice not found.
          </p>
          <button className="btn btn-outline" onClick={() => navigate("/marketplace")}>Back to Marketplace</button>
        </div>
      </div>
    );
  }

  const { business, invoiceNumber, amount, clientName, dueDate, issuedDate, fundedAmount, fundedPercent,
          trustScore, riskLevel, yield: yld, daysRemaining, status, description, funders, subScores, insuranceAvailable } = invoice;

  const remaining = amount - fundedAmount;
  const parsedAmount = parseFloat(investAmount.replace(/,/g, "")) || 0;
  const projectedReturn = parsedAmount * (yld / 100) * (daysRemaining / 365);
  const insurancePremium = insurance ? parsedAmount * 0.015 : 0;

  const handleFund = () => {
    if (!parsedAmount || parsedAmount > remaining) return;
    setFunded(true);
  };

  return (
    <PageBackground className="page" style={{ background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>

        {/* Back */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/marketplace")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.75rem", padding: "0.4rem 0.5rem", color: "var(--text-muted)" }}
        >
          <ArrowLeftIcon /> Back to Marketplace
        </button>

        <div className="review-grid">

          {/* ── Left ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Invoice header */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.3rem", fontFamily: "var(--font-body)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Business</p>
                  <RevealOnScroll><h1 style={{ fontSize: "1.7rem", fontWeight: 800, marginBottom: "0.2rem", fontFamily: "var(--font-head)", letterSpacing: "-0.02em" }}>{business}</h1></RevealOnScroll>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Client: {clientName}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                  <span className={`badge badge-${status}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                  <span className={riskClass(riskLevel)}>{riskLevel} Risk</span>
                </div>
              </div>

              <div className="divider" />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
                {[
                  ["Invoice ID", invoiceNumber],
                  ["Amount", `$${amount.toLocaleString()}`],
                  ["Annual Yield", `${yld}%`],
                  ["Issued", issuedDate],
                  ["Due Date", dueDate],
                  ["Days Remaining", daysRemaining === 0 ? "Matured" : `${daysRemaining} days`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem", fontFamily: "var(--font-body)" }}>{k}</p>
                    <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.95rem", fontFamily: "var(--font-body)" }}>{v}</p>
                  </div>
                ))}
              </div>

              <div className="divider" />
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "var(--text-dim)", marginTop: "2px" }}><TagIcon /></span>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.7, fontFamily: "var(--font-body)" }}>{description}</p>
              </div>
            </div>

            {/* Trust score */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <span style={{ color: "#1D4ED8" }}><ShieldIcon /></span>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", fontSize: "1rem", color: "var(--text)" }}>Trust Score Breakdown</span>
              </div>
              <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <TrustScoreRing score={trustScore} size={140} />
                  <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>Overall</p>
                </div>
                <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: "1.1rem", justifyContent: "center", paddingTop: "0.5rem" }}>
                  <SubScoreBar label="Payment Reliability" value={subScores.paymentReliability} />
                  <SubScoreBar label="Invoice Legitimacy"  value={subScores.invoiceLegitimacy} />
                  <SubScoreBar label="Business Profile"    value={subScores.businessProfile} />
                </div>
              </div>
            </div>

            {/* Funding progress */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>Funding Progress</span>
                <span style={{ fontFamily: "var(--font-head)", fontSize: "1.2rem", color: "#15803D", fontWeight: 700 }}>{fundedPercent}%</span>
              </div>
              <div className="progress-bar" style={{ height: 10, marginBottom: "1rem" }}>
                <div className="progress-fill" style={{ width: `${fundedPercent}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontFamily: "var(--font-body)" }}>
                <span style={{ color: "var(--text-muted)" }}>Raised: <strong style={{ color: "var(--text)" }}>${fundedAmount.toLocaleString()}</strong></span>
                <span style={{ color: "var(--text-muted)" }}>Remaining: <strong style={{ color: "var(--text)" }}>${remaining.toLocaleString()}</strong></span>
                <span style={{ color: "var(--text-muted)" }}>Target: <strong style={{ color: "var(--text)" }}>${amount.toLocaleString()}</strong></span>
              </div>
            </div>

            {/* Funders */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <span style={{ color: "var(--text-dim)" }}><UsersIcon /></span>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>
                  Current Funders ({funders.length})
                </span>
              </div>
              {funders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1.5rem 0", background: "var(--surface)", borderRadius: "8px" }}>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                    No funders yet — be the first!
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {funders.map((f, i) => (
                    <div key={i} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.65rem 1rem",
                      background: "var(--surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "monospace" }}>{f.address}</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-body)" }}>
                        ${f.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ position: "sticky", top: "calc(var(--nav-h) + 1.5rem)", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* Investment form */}
            {status === "funding" && !funded && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="card">
                <h3 style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1.05rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                  Fund This Invoice
                </h3>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>Investment Amount (USD)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder={`Up to $${remaining.toLocaleString()}`}
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    min={100}
                    max={remaining}
                  />
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
                    {[500, 2000, 5000, 10000].filter(v => v <= remaining).map((v) => (
                      <button
                        key={v}
                        className="chip"
                        style={{ fontSize: "0.74rem", padding: "0.2rem 0.6rem" }}
                        onClick={() => setInvestAmount(String(v))}
                      >
                        ${v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Insurance */}
                {insuranceAvailable && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.85rem 1rem",
                    background: insurance ? "#CCFBF1" : "var(--surface)",
                    border: `1.5px solid ${insurance ? "rgba(13,148,136,0.25)" : "var(--border)"}`,
                    borderRadius: "10px",
                    marginBottom: "1rem",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                      <span style={{ color: "#0D9488", marginTop: "1px" }}><ShieldIcon /></span>
                      <div>
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3, fontFamily: "var(--font-body)" }}>
                          Default Insurance
                        </p>
                        <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                          +1.5% premium — protected against default
                        </p>
                      </div>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} />
                      <div className="toggle-track" />
                    </label>
                  </div>
                )}

                {/* Projected return */}
                {parsedAmount > 0 && (
                  <div style={{
                    padding: "0.9rem 1rem",
                    background: "#DCFCE7",
                    border: "1px solid rgba(21,128,61,0.2)",
                    borderRadius: "10px",
                    marginBottom: "1rem",
                  }}>
                    {[
                      ["You invest", `$${parsedAmount.toLocaleString()}`, "var(--text)"],
                      insurance && ["Insurance premium", `-$${insurancePremium.toFixed(0)}`, "#B45309"],
                    ].filter(Boolean).map(([k, v, c]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{k}</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: c, fontFamily: "var(--font-body)" }}>{v}</span>
                      </div>
                    ))}
                    <div className="divider" style={{ margin: "0.5rem 0", background: "rgba(21,128,61,0.15)" }} />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Projected return</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#15803D", fontFamily: "var(--font-body)" }}>
                        +${(projectedReturn - insurancePremium).toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-gold"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={!parsedAmount || parsedAmount > remaining || parsedAmount < 1}
                  onClick={handleFund}
                >
                  Fund This Invoice
                </button>
                <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", textAlign: "center", marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem", justifyContent: "center", fontFamily: "var(--font-body)" }}>
                  <InfoIcon /> Funds held in escrow until invoice settles
                </p>
              </motion.div>
            )}

            {/* Funded success */}
            {funded && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#DCFCE7", border: "2px solid rgba(21,128,61,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "#15803D" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontWeight: 700, marginBottom: "0.4rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>Investment confirmed!</p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "1rem", fontFamily: "var(--font-body)" }}>
                  Your position has been recorded on-chain.
                </p>
                <button className="btn btn-outline btn-sm" style={{ width: "100%" }} onClick={() => navigate("/dashboard/investor")}>
                  View Portfolio
                </button>
              </motion.div>
            )}

            {/* Holds position — secondary market */}
            {holdsPosition && !funded && (
              <div className="card" style={{ borderColor: "rgba(21,128,61,0.2)", background: "#F0FDF4" }}>
                <p style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#15803D", fontFamily: "var(--font-head)" }}>Your Position</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Invested</span>
                  <span style={{ fontWeight: 700, fontFamily: "var(--font-body)", color: "var(--text)" }}>${myPosition.toLocaleString()}</span>
                </div>
                <div className="divider" />
                <p style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.9rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>Secondary Market</p>
                {listForSale ? (
                  <div style={{ padding: "0.75rem", background: "#DCFCE7", border: "1px solid rgba(21,128,61,0.2)", borderRadius: "8px", textAlign: "center" }}>
                    <p style={{ fontSize: "0.85rem", color: "#15803D", fontWeight: 700, fontFamily: "var(--font-body)" }}>Listed for sale</p>
                    <p style={{ fontSize: "0.78rem", color: "#166534", fontFamily: "var(--font-body)" }}>Other investors can now purchase your position.</p>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem", fontFamily: "var(--font-body)" }}>
                      List your position for sale before maturity.
                    </p>
                    <button className="btn btn-outline btn-sm" style={{ width: "100%" }} onClick={() => setListForSale(true)}>
                      List Position for Sale
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Quick stats */}
            <div className="card" style={{ background: "var(--surface)", boxShadow: "none" }}>
              <p style={{ fontSize: "0.73rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.85rem", fontFamily: "var(--font-body)" }}>
                Quick Stats
              </p>
              {[
                ["Risk Level",   <span className={riskClass(riskLevel)}>{riskLevel}</span>],
                ["Annual Yield", <span style={{ color: "#15803D", fontWeight: 700, fontFamily: "var(--font-body)" }}>{yld}%</span>],
                ["Trust Score",  <span style={{ color: "#15803D", fontWeight: 700, fontFamily: "var(--font-body)" }}>{trustScore}/100</span>],
                ["Funders",      <span style={{ fontFamily: "var(--font-body)" }}>{funders.length}</span>],
                ["Days to Due",  <span style={{ fontFamily: "var(--font-body)" }}>{daysRemaining === 0 ? "Matured" : `${daysRemaining}d`}</span>],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{k}</span>
                  <span style={{ fontSize: "0.88rem" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
