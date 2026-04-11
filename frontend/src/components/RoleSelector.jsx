import { motion } from "framer-motion";
import { useWeb3 } from "../context/Web3Context";

const BuildingIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/>
    <line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/>
    <line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/>
    <path d="M9 18h6"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
  </svg>
);

export default function RoleSelector() {
  const { selectRole, privyUser, account } = useWeb3();

  const displayName = privyUser?.email?.address
    || privyUser?.google?.email
    || (account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "");

  const roles = [
    {
      id: "sme",
      title: "SME / Business",
      desc: "Upload invoices, get funded, track settlements",
      icon: <BuildingIcon />,
      color: "#15803D",
      bg: "#DCFCE7",
    },
    {
      id: "investor",
      title: "Investor",
      desc: "Fund invoices, earn yield, manage portfolio",
      icon: <ChartIcon />,
      color: "#1D4ED8",
      bg: "#DBEAFE",
    },
  ];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 100,
      background: "rgba(250, 248, 245, 0.98)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{
          maxWidth: 480,
          width: "100%",
          padding: "2.5rem 2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{
          fontSize: "1.75rem",
          fontWeight: 800,
          fontFamily: "var(--font-head)",
          color: "var(--text)",
          marginBottom: "0.4rem",
        }}>
          Welcome to InvoFlow
        </h1>

        {displayName && (
          <p style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            fontFamily: "var(--font-body)",
            marginBottom: "0.5rem",
          }}>
            Logged in as <strong>{displayName}</strong>
          </p>
        )}

        <p style={{
          fontSize: "0.95rem",
          color: "var(--text-muted)",
          fontFamily: "var(--font-body)",
          marginBottom: "2rem",
        }}>
          How would you like to use InvoFlow?
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          {roles.map((role) => (
            <motion.button
              key={role.id}
              whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => selectRole(role.id)}
              style={{
                flex: "1 1 200px",
                maxWidth: 220,
                padding: "1.75rem 1.25rem",
                borderRadius: "14px",
                border: "1.5px solid rgba(28,25,23,0.1)",
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{
                width: 56,
                height: 56,
                borderRadius: "14px",
                background: role.bg,
                color: role.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {role.icon}
              </div>
              <span style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                fontFamily: "var(--font-head)",
                color: "var(--text)",
              }}>
                {role.title}
              </span>
              <span style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                lineHeight: 1.4,
              }}>
                {role.desc}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
