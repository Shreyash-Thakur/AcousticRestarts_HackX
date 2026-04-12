import { Link } from "react-router-dom";
import logoSrc from "../assets/logo.png";

const LogoMark = () => (
  <img src={logoSrc} alt="InvoFlow" style={{ height: 30, width: "auto", objectFit: "contain", display: "block" }} />
);

const GitHubIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
);
const TwitterIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const footerLinks = {
  Protocol: [
    { label: "Marketplace", to: "/marketplace" },
    { label: "Upload Invoice", to: "/upload" },
    { label: "SME Dashboard", to: "/dashboard/sme" },
    { label: "Investor Portfolio", to: "/dashboard/investor" },
  ],
  Resources: [
    { label: "Documentation", to: "#" },
    { label: "Whitepaper", to: "#" },
    { label: "Risk Framework", to: "#" },
    { label: "Smart Contracts", to: "#" },
  ],
  Company: [
    { label: "About", to: "#" },
    { label: "Blog", to: "#" },
    { label: "Careers", to: "#" },
    { label: "Contact", to: "#" },
  ],
};

export default function Footer() {
  return (
    <footer style={{ background: "#1C1917", marginTop: "auto" }}>
      <div className="container" style={{ padding: "3.5rem 1.5rem 2rem" }}>
        {/* Top row */}
        <div className="footer-grid">
          {/* Brand */}
          <div>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <LogoMark />
              <span style={{
                fontFamily: "var(--font-head)",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: "#FAF8F5",
                letterSpacing: "-0.01em",
              }}>InvoFlow</span>
            </Link>
            <p style={{ fontSize: "0.875rem", color: "rgba(250,248,245,0.45)", lineHeight: 1.75, maxWidth: "220px" }}>
              Decentralized invoice financing — connecting SMEs with global liquidity.
            </p>
            <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.5rem" }}>
              {[GitHubIcon, TwitterIcon].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  style={{
                    width: 34, height: 34,
                    borderRadius: "8px",
                    background: "rgba(250,248,245,0.07)",
                    border: "1px solid rgba(250,248,245,0.10)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "rgba(250,248,245,0.4)",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = "#4ADE80"; e.currentTarget.style.background = "rgba(74,222,128,0.08)"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.2)"; }}
                  onMouseLeave={e => { e.currentTarget.style.color = "rgba(250,248,245,0.4)"; e.currentTarget.style.background = "rgba(250,248,245,0.07)"; e.currentTarget.style.borderColor = "rgba(250,248,245,0.10)"; }}
                >
                  <Icon />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([col, links]) => (
            <div key={col}>
              <p style={{
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(250,248,245,0.35)",
                marginBottom: "1.1rem",
                fontFamily: "var(--font-body)",
              }}>
                {col}
              </p>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      style={{ fontSize: "0.875rem", color: "rgba(250,248,245,0.5)", transition: "color 0.15s" }}
                      onMouseEnter={e => e.target.style.color = "rgba(250,248,245,0.9)"}
                      onMouseLeave={e => e.target.style.color = "rgba(250,248,245,0.5)"}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: "1px solid rgba(250,248,245,0.08)",
          paddingTop: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}>
          <p style={{ fontSize: "0.8rem", color: "rgba(250,248,245,0.3)", fontFamily: "var(--font-body)" }}>
            &copy; 2026 InvoFlow Protocol. All rights reserved.
          </p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {["Privacy Policy", "Terms of Service", "Audit Reports"].map((item) => (
              <a
                key={item}
                href="#"
                style={{ fontSize: "0.8rem", color: "rgba(250,248,245,0.3)", transition: "color 0.15s", fontFamily: "var(--font-body)" }}
                onMouseEnter={e => e.target.style.color = "rgba(250,248,245,0.6)"}
                onMouseLeave={e => e.target.style.color = "rgba(250,248,245,0.3)"}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>

    </footer>
  );
}
