import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { invoices } from "../data/mockData";
import InvoiceCard from "../components/InvoiceCard";

/* ── Icons ── */
const FilterIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const SortIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);
const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const RISK_OPTIONS = ["All", "Low", "Medium", "High"];
const STATUS_OPTIONS = ["All", "funding", "funded"];
const SORT_OPTIONS = [
  { value: "yield-desc",  label: "Highest Yield" },
  { value: "yield-asc",   label: "Lowest Yield" },
  { value: "trust-desc",  label: "Highest Trust" },
  { value: "amount-desc", label: "Largest Amount" },
  { value: "days-asc",    label: "Soonest Due" },
];

export default function MarketplacePage() {
  const [riskFilter, setRiskFilter]     = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy]             = useState("yield-desc");
  const [minYield, setMinYield]         = useState("");
  const [maxAmount, setMaxAmount]       = useState("");
  const [showFilters, setShowFilters]   = useState(false);

  const filtered = useMemo(() => {
    let list = invoices.filter((inv) => {
      if (inv.status === "draft") return false;
      if (riskFilter !== "All" && inv.riskLevel !== riskFilter) return false;
      if (statusFilter !== "All" && inv.status !== statusFilter) return false;
      if (minYield && inv.yield < parseFloat(minYield)) return false;
      if (maxAmount && inv.amount > parseFloat(maxAmount.replace(/,/g, ""))) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "yield-desc":   return b.yield - a.yield;
        case "yield-asc":    return a.yield - b.yield;
        case "trust-desc":   return b.trustScore - a.trustScore;
        case "amount-desc":  return b.amount - a.amount;
        case "days-asc":     return a.daysRemaining - b.daysRemaining;
        default: return 0;
      }
    });
  }, [riskFilter, statusFilter, sortBy, minYield, maxAmount]);

  const activeFilters = [
    riskFilter !== "All" && { label: `Risk: ${riskFilter}`, clear: () => setRiskFilter("All") },
    statusFilter !== "All" && { label: `Status: ${statusFilter}`, clear: () => setStatusFilter("All") },
    minYield && { label: `Min yield: ${minYield}%`, clear: () => setMinYield("") },
    maxAmount && { label: `Max: $${maxAmount}`, clear: () => setMaxAmount("") },
  ].filter(Boolean);

  return (
    <div className="page" style={{ background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.25rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                Invoice Marketplace
              </h1>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>
                {filtered.length} invoice{filtered.length !== 1 ? "s" : ""} available
              </p>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setShowFilters(!showFilters)}
              style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}
            >
              <FilterIcon />
              Filters
              {activeFilters.length > 0 && (
                <span style={{
                  background: "#15803D",
                  color: "#fff",
                  borderRadius: "999px",
                  padding: "0 6px",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  minWidth: 18,
                  textAlign: "center",
                }}>
                  {activeFilters.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
            style={{ marginBottom: "1.5rem", background: "var(--surface)", boxShadow: "none" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1.5rem" }}>
              <div className="form-group">
                <label>Risk Level</label>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {RISK_OPTIONS.map((r) => (
                    <button key={r} className={`chip ${riskFilter === r ? "active" : ""}`} onClick={() => setRiskFilter(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Funding Status</label>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s} className={`chip ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
                      {s === "All" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Minimum Yield (%)</label>
                <input className="input" type="number" placeholder="e.g. 8" value={minYield} onChange={(e) => setMinYield(e.target.value)} min={0} />
              </div>
              <div className="form-group">
                <label>Max Amount ($)</label>
                <input className="input" type="number" placeholder="e.g. 100000" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} min={0} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            {activeFilters.map((f) => (
              <button
                key={f.label}
                onClick={f.clear}
                style={{
                  display: "flex", alignItems: "center", gap: "0.35rem",
                  padding: "0.28rem 0.7rem",
                  background: "#DCFCE7",
                  border: "1px solid rgba(21,128,61,0.25)",
                  borderRadius: "999px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "#15803D",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                {f.label} <XIcon />
              </button>
            ))}
            <button
              onClick={() => { setRiskFilter("All"); setStatusFilter("All"); setMinYield(""); setMaxAmount(""); }}
              style={{
                padding: "0.28rem 0.7rem",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "999px",
                fontSize: "0.78rem",
                color: "var(--text-dim)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Sort bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
            <SortIcon /> Sort by:
          </span>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {SORT_OPTIONS.map((opt) => (
              <button key={opt.value} className={`chip ${sortBy === opt.value ? "active" : ""}`} onClick={() => setSortBy(opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "5rem 0", background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: "1rem", color: "var(--text-muted)", fontFamily: "var(--font-body)", marginBottom: "1rem" }}>
              No invoices match your filters.
            </p>
            <button className="btn btn-outline btn-sm" onClick={() => { setRiskFilter("All"); setStatusFilter("All"); setMinYield(""); setMaxAmount(""); }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.25rem" }}>
            {filtered.map((inv, i) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.35 }}
              >
                <InvoiceCard invoice={inv} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
