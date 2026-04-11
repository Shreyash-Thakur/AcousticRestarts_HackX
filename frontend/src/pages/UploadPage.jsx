import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrustScoreRing, SubScoreBar } from "../components/TrustScoreRing";
import { createInvoice } from "../lib/api";
import { useWeb3 } from "../context/Web3Context";
import { txUrl } from "../lib/contracts";

/* ── Icons ── */
const UploadCloudIcon = () => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
);
const FileIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const SpinnerIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const CubeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  </svg>
);

const mockParsed = {
  invoiceNumber: "TCE-2026-0042",
  amount: "45,000",
  clientName: "Global Enterprises Inc.",
  dueDate: "2026-05-15",
  issuedDate: "2026-04-01",
  description: "Enterprise software development services Q1 2026",
};
const mockRisk = {
  overall: 87,
  subScores: {
    "Payment Reliability": 91,
    "Invoice Legitimacy": 88,
    "Business Profile": 82,
  },
};

const stepList = ["upload", "parsing", "review", "confirmed"];

export default function UploadPage() {
  const [step, setStep] = useState("upload");
  const [dragOver, setDragOver] = useState(false);
  const [filename, setFilename] = useState("");
  const [fields, setFields] = useState(mockParsed);
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState(null);
  const [riskData, setRiskData] = useState(mockRisk);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();
  const { account, isConnected } = useWeb3();

  const handleFile = (file) => {
    if (!file) return;
    setFilename(file.name);
    setStep("parsing");
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 22;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setTimeout(() => setStep("review"), 350);
      }
      setProgress(Math.min(p, 100));
    }, 200);
  };

  const handleDraftToken = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await createInvoice({
        businessName: fields.clientName,
        clientName: fields.clientName,
        amount: parseFloat(String(fields.amount).replace(/,/g, "")),
        dueDate: fields.dueDate,
        smeWallet: isConnected ? account : undefined,
      });
      setCreated(res);
      if (res.riskScore != null) {
        setRiskData({
          overall: res.riskScore,
          subScores: {
            "Payment Reliability": res.reliability?.paymentReliability ?? 80,
            "Invoice Legitimacy": Math.min(100, res.riskScore + 3),
            "Business Profile": Math.max(0, res.riskScore - 5),
          },
        });
      }
      setStep("confirmed");
    } catch (err) {
      setSubmitError(err.message || "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page" style={{ background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "2.25rem" }}>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.5rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
            Upload &amp; Tokenize Invoice
          </h1>
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            Upload your invoice — we'll parse the details, score the risk, and create an on-chain token.
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "2.5rem", flexWrap: "wrap" }}>
          {stepList.map((s, i) => {
            const idx = stepList.indexOf(step);
            const done = i < idx;
            const active = i === idx;
            const label = s.charAt(0).toUpperCase() + s.slice(1);
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.4rem",
                  padding: "0.28rem 0.8rem",
                  borderRadius: "999px",
                  background: done ? "#DCFCE7" : active ? "#F0FDF4" : "var(--surface)",
                  border: `1.5px solid ${done ? "rgba(21,128,61,0.3)" : active ? "#15803D" : "var(--border)"}`,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: done ? "#15803D" : active ? "#15803D" : "var(--text-dim)",
                  fontFamily: "var(--font-body)",
                }}>
                  {done
                    ? <span style={{ display: "flex", alignItems: "center" }}><CheckIcon /></span>
                    : <span style={{ width: 18, height: 18, borderRadius: "50%", background: active ? "#15803D" : "rgba(28,25,23,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: active ? "#fff" : "var(--text-dim)" }}>{i + 1}</span>
                  }
                  {label}
                </div>
                {i < stepList.length - 1 && <div style={{ width: 20, height: 1, background: "var(--border)" }} />}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ── UPLOAD ── */}
          {step === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
              <div
                className={`upload-zone ${dragOver ? "drag-over" : ""}`}
                onClick={() => fileRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                style={{ maxWidth: 580, margin: "0 auto" }}
              >
                <div style={{ color: "#15803D", marginBottom: "1rem", display: "flex", justifyContent: "center" }}><UploadCloudIcon /></div>
                <p style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--text)", marginBottom: "0.35rem", fontFamily: "var(--font-body)" }}>
                  Drop your invoice here, or <span style={{ color: "#15803D" }}>browse</span>
                </p>
                <p style={{ fontSize: "0.84rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                  Supports PDF, PNG, JPG — max 20 MB
                </p>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
              </div>
              <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleFile({ name: "invoice_sample.pdf" })}
                >
                  Use sample invoice
                </button>
              </div>
            </motion.div>
          )}

          {/* ── PARSING ── */}
          {step === "parsing" && (
            <motion.div key="parsing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", padding: "3.5rem 0" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "#DCFCE7",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 1.5rem",
                color: "#15803D",
                animation: "spin 1.2s linear infinite",
              }}>
                <SpinnerIcon />
              </div>
              <h2 style={{ fontSize: "1.4rem", marginBottom: "0.5rem", fontFamily: "var(--font-head)" }}>Parsing invoice…</h2>
              <p style={{ color: "var(--text-muted)", marginBottom: "2rem", fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>
                AI is extracting fields and verifying document authenticity
              </p>
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "0.75rem",
                height: 6,
              }}>
                <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #15803D, #22C55E)",
                  width: `${progress}%`,
                  transition: "width 0.2s ease",
                  borderRadius: "8px",
                }} />
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                {Math.round(progress)}% complete
              </p>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </motion.div>
          )}

          {/* ── REVIEW ── */}
          {step === "review" && (
            <motion.div key="review" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="review-grid">

                {/* Parsed fields */}
                <div>
                  <div className="card" style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.5rem" }}>
                      <span style={{ color: "#15803D" }}><FileIcon /></span>
                      <span style={{ fontWeight: 700, fontSize: "1rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                        Parsed Invoice Summary
                      </span>
                      <span className="badge badge-low" style={{ marginLeft: "auto" }}>
                        <CheckIcon /> Verified
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                      {Object.entries({
                        "Invoice Number":     "invoiceNumber",
                        "Invoice Amount ($)": "amount",
                        "Client Name":        "clientName",
                        "Due Date":           "dueDate",
                        "Issued Date":        "issuedDate",
                        "Description":        "description",
                      }).map(([label, key]) => (
                        <div key={key} className="form-group" style={{ gridColumn: key === "description" ? "span 2" : "auto" }}>
                          <label>
                            {label}{" "}
                            <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: "0.72rem", textTransform: "none", letterSpacing: 0 }}>
                              — editable
                            </span>
                          </label>
                          <div style={{ position: "relative" }}>
                            <input
                              className="input"
                              value={fields[key]}
                              onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                              style={{ paddingRight: "2.5rem" }}
                            />
                            <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }}>
                              <EditIcon />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className="btn btn-gold"
                    style={{ width: "100%", justifyContent: "center", gap: "0.5rem" }}
                    onClick={handleDraftToken}
                    disabled={submitting}
                  >
                    {submitting ? <><SpinnerIcon /> Submitting…</> : <><CubeIcon /> Draft Token on Chain</>}
                  </button>
                  {submitError && (
                    <p style={{ color: "#B91C1C", fontSize: "0.85rem", marginTop: "0.75rem", fontFamily: "var(--font-body)" }}>
                      {submitError}
                    </p>
                  )}
                </div>

                {/* Risk panel */}
                <div className="card" style={{ position: "sticky", top: "calc(var(--nav-h) + 1.5rem)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                    <span style={{ color: "#1D4ED8" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </span>
                    <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>Risk Score Panel</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
                    <div style={{ textAlign: "center" }}>
                      <TrustScoreRing score={riskData.overall} size={130} />
                      <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                        Overall Trust Score
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {Object.entries(riskData.subScores).map(([label, val]) => (
                      <SubScoreBar key={label} label={label} value={val} />
                    ))}
                  </div>

                  <div style={{
                    marginTop: "1.25rem",
                    padding: "0.85rem 1rem",
                    background: "#DCFCE7",
                    border: "1px solid rgba(21,128,61,0.2)",
                    borderRadius: "8px",
                  }}>
                    <p style={{ fontSize: "0.83rem", color: "#15803D", fontWeight: 700, marginBottom: "0.2rem", fontFamily: "var(--font-body)" }}>
                      Low Risk — Eligible for marketplace
                    </p>
                    <p style={{ fontSize: "0.78rem", color: "#166534", fontFamily: "var(--font-body)" }}>
                      This invoice meets all listing requirements.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── CONFIRMED ── */}
          {step === "confirmed" && (
            <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", padding: "3.5rem 0" }}>
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                style={{
                  width: 84, height: 84, borderRadius: "50%",
                  background: "#DCFCE7",
                  border: "2px solid rgba(21,128,61,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 1.5rem",
                  color: "#15803D",
                }}
              >
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </motion.div>

              <h2 style={{ fontSize: "1.7rem", fontWeight: 800, marginBottom: "0.75rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                Token Drafted Successfully
              </h2>
              <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem", fontFamily: "var(--font-body)" }}>
                {created?.onChainMinted
                  ? "Your invoice has been tokenized on-chain and is now live on the marketplace."
                  : "Your invoice has been created and is now live on the marketplace."}
              </p>

              <div style={{
                margin: "1.75rem 0",
                padding: "1.25rem 1.5rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                display: "flex", flexDirection: "column", gap: "0.65rem",
              }}>
                {[
                  ["Invoice", created?.businessName || "—"],
                  ["Invoice ID", `#${created?.id ?? "—"}`],
                  created?.tokenId && ["Token ID (On-Chain)", `#${created.tokenId}`],
                  ["Risk Score", `${created?.riskScore ?? "—"} (${created?.riskLevel ?? ""})`],
                  ["Status", created?.onChainMinted ? "Minted on Base Sepolia" : "Live on Marketplace"],
                ].filter(Boolean).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                    <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>{k}</span>
                    <span style={{ color: "var(--text)", fontWeight: 600, fontFamily: "var(--font-body)" }}>{v}</span>
                  </div>
                ))}
                {created?.mintTxHash && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                    <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>Transaction</span>
                    <a
                      href={txUrl(created.mintTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#15803D", fontWeight: 600, fontSize: "0.85rem", fontFamily: "var(--font-body)" }}
                    >
                      View on BaseScan ↗
                    </a>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
                <button className="btn btn-gold" onClick={() => navigate("/marketplace")}>
                  View in Marketplace
                </button>
                <button className="btn btn-outline" onClick={() => navigate("/dashboard/sme")}>
                  Go to Dashboard
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
