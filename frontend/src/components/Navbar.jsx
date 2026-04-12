import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useWeb3 } from "../context/Web3Context";
import logoSrc from "../assets/logo.png";

const LogoMark = () => (
  <img src={logoSrc} alt="InvoFlow" style={{ height: 32, width: "auto", objectFit: "contain", display: "block" }} />
);

const WalletIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z"/>
  </svg>
);

const UserIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);
const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const allNavLinks = [
  { to: "/marketplace", label: "Marketplace", roles: ["sme", "investor", null] },
  { to: "/secondary-market", label: "Secondary Market", roles: ["investor", null] },
  { to: "/upload", label: "Upload Invoice", roles: ["sme", null] },
  { to: "/dashboard/sme", label: "SME Dashboard", roles: ["sme", null] },
  { to: "/dashboard/investor", label: "Portfolio", roles: ["investor", null] },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { account, isConnected, isCorrectChain, connecting, connectWallet, disconnectWallet, walletSource, privyUser, privyAuthenticated, userRole, selectRole } = useWeb3();
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path) => location.pathname === path;

  const handleSwitchRole = () => {
    selectRole(null);
    navigate("/");
  };

  // Filter nav links by current role
  const navLinks = allNavLinks.filter((link) => link.roles.includes(userRole));

  const truncatedAddress = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : "";

  // Show email or address badge
  const displayLabel = (() => {
    if (connecting) return "Creating Wallet…";
    if (!isConnected && !privyAuthenticated) return "Login";
    if (!isConnected && privyAuthenticated) return "Creating Wallet…";
    if (!isCorrectChain) return "Wrong Network";
    if (privyAuthenticated && privyUser?.email?.address) {
      return privyUser.email.address.split("@")[0];
    }
    if (privyAuthenticated && privyUser?.google?.email) {
      return privyUser.google.email.split("@")[0];
    }
    return truncatedAddress;
  })();

  return (
    <>
      <nav style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 50,
        height: "var(--nav-h)",
        background: "rgba(250, 248, 245, 0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(28,25,23,0.08)",
      }}>
        <div className="container" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Logo */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <LogoMark />
            <span style={{
              fontFamily: "var(--font-head)",
              fontSize: "1.15rem",
              fontWeight: 700,
              color: "var(--text)",
              letterSpacing: "-0.01em",
            }}>InvoFlow</span>
          </Link>

          {/* Desktop nav */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.1rem" }} className="hide-mobile">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  color: isActive(link.to) ? "var(--gold)" : "var(--text-muted)",
                  background: isActive(link.to) ? "rgba(21,128,61,0.08)" : "transparent",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { if (!isActive(link.to)) { e.target.style.color = "var(--text)"; e.target.style.background = "rgba(28,25,23,0.05)"; }}}
                onMouseLeave={e => { if (!isActive(link.to)) { e.target.style.color = "var(--text-muted)"; e.target.style.background = "transparent"; }}}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Role badge + Wallet + hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {isConnected && userRole && (
              <button
                onClick={handleSwitchRole}
                title="Switch role"
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "999px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  border: "1.5px solid",
                  borderColor: userRole === "sme" ? "rgba(21,128,61,0.3)" : "rgba(29,78,216,0.3)",
                  background: userRole === "sme" ? "#DCFCE7" : "#DBEAFE",
                  color: userRole === "sme" ? "#15803D" : "#1D4ED8",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {userRole === "sme" ? "SME" : "Investor"} ✕
              </button>
            )}
            <button
              onClick={isConnected ? disconnectWallet : connectWallet}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.5rem 1.1rem",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                border: isConnected
                  ? "1.5px solid var(--gold-glow)"
                  : "1.5px solid rgba(28,25,23,0.18)",
                background: isConnected ? "var(--gold-dim)" : "var(--gold)",
                color: isConnected ? "var(--gold)" : "#fff",
                cursor: "pointer",
                transition: "all 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {isConnected ? <UserIcon /> : <WalletIcon />}
              {displayLabel}
            </button>

            <button
              onClick={() => setOpen(!open)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", padding: "0.3rem", cursor: "pointer", display: "none" }}
              className="hamburger-btn"
              aria-label="Toggle menu"
            >
              {open ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed",
              top: "var(--nav-h)",
              left: 0, right: 0,
              zIndex: 49,
              background: "rgba(250,248,245,0.97)",
              backdropFilter: "blur(14px)",
              borderBottom: "1px solid rgba(28,25,23,0.08)",
              padding: "0.75rem 1.5rem 1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.15rem",
            }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  color: isActive(link.to) ? "var(--gold)" : "var(--text-muted)",
                  background: isActive(link.to) ? "rgba(21,128,61,0.08)" : "transparent",
                }}
              >
                {link.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) { .hamburger-btn { display: flex !important; } }
      `}</style>
    </>
  );
}
