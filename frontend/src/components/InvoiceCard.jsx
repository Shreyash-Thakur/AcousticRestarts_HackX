import { useNavigate } from "react-router-dom";
import { TrustScoreRing } from "./TrustScoreRing";

const riskClass = (level) => `badge badge-${level.toLowerCase()}`;

const CalendarIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

export default function InvoiceCard({ invoice }) {
  const navigate = useNavigate();
  const { id, business, amount, fundedPercent, trustScore, riskLevel, yield: yld, daysRemaining, clientName } = invoice;
  const numericFundedPercent = Number(fundedPercent) || 0;
  const fundedLabel =
    numericFundedPercent > 0 && numericFundedPercent < 1
      ? `${numericFundedPercent.toFixed(2)}% funded`
      : `${Math.round(numericFundedPercent)}% funded`;
  const progressWidth = Math.max(0, Math.min(100, numericFundedPercent > 0 && numericFundedPercent < 1 ? 1 : numericFundedPercent));

  return (
    <div
      className="card card-hover"
      onClick={() => navigate(`/invoice/${id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/invoice/${id}`); }}
      role="button"
      tabIndex={0}
      aria-label={`View invoice for ${business} — ${riskLevel} risk, ${yld}% yield`}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-head)", marginBottom: "0.15rem" }}>
            {business}
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>{clientName}</p>
        </div>
        <span className={riskClass(riskLevel)}>{riskLevel} Risk</span>
      </div>

      {/* Amount + Trust ring */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem", fontFamily: "var(--font-body)" }}>
            Invoice Amount
          </p>
          <p style={{ fontFamily: "var(--font-head)", fontSize: "1.45rem", fontWeight: 700, color: "var(--text)" }}>
            ${amount.toLocaleString()}
          </p>
        </div>
        <TrustScoreRing score={trustScore} size={60} strokeWidth={6} />
      </div>

      {/* Funding progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
          <span style={{ fontSize: "0.76rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
            {fundedLabel}
          </span>
          <span style={{ fontSize: "0.76rem", color: "var(--gold)", fontWeight: 600, fontFamily: "var(--font-body)" }}>
            {yld}% yield
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressWidth}%` }} />
        </div>
      </div>

      {/* Footer row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.79rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
          <CalendarIcon />
          {daysRemaining === 0 ? "Due today" : `${daysRemaining}d remaining`}
        </span>
        <span style={{
          display: "flex", alignItems: "center", gap: "0.3rem",
          fontSize: "0.82rem", fontWeight: 600, color: "var(--gold)", fontFamily: "var(--font-body)",
        }}>
          View details <ArrowRightIcon />
        </span>
      </div>
    </div>
  );
}
