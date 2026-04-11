import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { smeInvoices } from "../data/mockData";

/* ── Icons ── */
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const InvoiceIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
);
const DollarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);
const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const metrics = [
  { label: "Total Invoices",          value: "4",        icon: <InvoiceIcon />, color: "#1D4ED8", bg: "#DBEAFE", desc: "All time" },
  { label: "Total Liquidity Received",value: "$199,760", icon: <DollarIcon />,  color: "#15803D", bg: "#DCFCE7", desc: "Across all invoices" },
  { label: "Outstanding Invoices",    value: "3",        icon: <ClockIcon />,   color: "#B45309", bg: "#FEF3C7", desc: "Actively funding" },
  { label: "Settled Invoices",        value: "1",        icon: <CheckCircleIcon />, color: "#0D9488", bg: "#CCFBF1", desc: "Fully settled" },
];

const statusBadge = {
  draft:   <span className="badge badge-draft">Draft</span>,
  funding: <span className="badge badge-funding">Funding</span>,
  funded:  <span className="badge badge-funded">Funded</span>,
  settled: <span className="badge badge-settled">Settled</span>,
};

const scoreColor = (s) => s >= 80 ? "#15803D" : s >= 60 ? "#B45309" : "#B91C1C";

export default function SMEDashboard() {
  const navigate = useNavigate();

  return (
    <div className="page" style={{ background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "2.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.25rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
              SME Dashboard
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>
              Manage your invoices and track liquidity
            </p>
          </div>
          <button
            className="btn btn-gold"
            onClick={() => navigate("/upload")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <PlusIcon /> Upload New Invoice
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
                <div style={{
                  width: 38, height: 38,
                  borderRadius: "10px",
                  background: m.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: m.color,
                }}>
                  {m.icon}
                </div>
              </div>
              <div className="metric-value">{m.value}</div>
              <div className="metric-sub">{m.desc}</div>
            </motion.div>
          ))}
        </div>

        {/* Invoice table */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.1rem" }}>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>Your Invoices</h2>
          <span style={{ fontSize: "0.82rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>{smeInvoices.length} invoices</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Funded</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Trust Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {smeInvoices.map((inv, i) => (
                <motion.tr
                  key={inv.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  onClick={() => navigate(`/invoice/${inv.id}`)}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate(`/invoice/${inv.id}`); }}
                  tabIndex={0}
                  aria-label={`Invoice ${inv.invoiceNumber} for ${inv.clientName}`}
                >
                  <td>
                    <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.88rem", fontFamily: "var(--font-body)" }}>{inv.invoiceNumber}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>{inv.id}</div>
                  </td>
                  <td style={{ fontFamily: "var(--font-body)" }}>{inv.clientName}</td>
                  <td className="td-primary">${inv.amount.toLocaleString()}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 72, background: "rgba(28,25,23,0.08)", borderRadius: "999px", height: 5 }}>
                        <div style={{ height: "100%", background: "linear-gradient(90deg, #15803D, #22C55E)", borderRadius: "999px", width: `${inv.fundedPercent}%` }} />
                      </div>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", minWidth: 32, fontFamily: "var(--font-body)" }}>{inv.fundedPercent}%</span>
                    </div>
                  </td>
                  <td>{statusBadge[inv.status]}</td>
                  <td style={{ fontFamily: "var(--font-body)" }}>{inv.dueDate}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: scoreColor(inv.trustScore), fontFamily: "var(--font-body)" }}>
                      {inv.trustScore}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.78rem", color: "var(--text-muted)" }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/invoice/${inv.id}`); }}
                    >
                      View <ExternalIcon />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
