import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrustScoreRing, SubScoreBar } from "../components/TrustScoreRing";
import { parseInvoiceFile, createInvoice } from "../lib/api";
import { useWeb3 } from "../context/Web3Context";
import { txUrl } from "../lib/contracts";
import PageBackground from "../components/PageBackground";

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
const WarnIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/* ── Helpers ── */
const CONFIDENCE_THRESHOLD = 0.7;

const emptyFields = () => ({
  invoiceNumber: "",
  invoiceDate: "",
  dueDate: "",
  totalAmount: "",
  clientCompanyName: "",
  clientGSTNumber: "",
  smeName: "",
});

const emptyConfidence = () => ({
  invoiceNumber: 1,
  invoiceDate: 1,
  dueDate: 1,
  totalAmount: 1,
  clientCompanyName: 1,
  clientGSTNumber: 1,
  smeName: 1,
});

const FIELD_META = [
  { key: "invoiceNumber",     label: "Invoice Number",       span: 1 },
  { key: "invoiceDate",       label: "Invoice Date",         span: 1 },
  { key: "dueDate",           label: "Due Date",             span: 1 },
  { key: "totalAmount",       label: "Total Amount",         span: 1 },
  { key: "clientCompanyName", label: "Client Company Name",  span: 2 },
  { key: "clientGSTNumber",   label: "Client GST Number",    span: 1 },
  { key: "smeName",           label: "SME / Vendor Name",    span: 1 },
];

const stepList = ["upload", "parsing", "review", "confirmed"];

/* ── Confidence badge ── */
function ConfidenceBadge({ confidence }) {
  if (confidence >= CONFIDENCE_THRESHOLD) return null;
  const pct = Math.round(confidence * 100);
  return (
    <span
      title={`Low confidence (${pct}%) — please verify`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "1px 6px",
        borderRadius: "4px",
        background: "#FEF3C7",
        border: "1px solid #F59E0B",
        color: "#92400E",
        fontSize: "0.68rem",
        fontWeight: 700,
        fontFamily: "var(--font-body)",
        marginLeft: "0.4rem",
      }}
    >
      <WarnIcon /> {pct}%
    </span>
  );
}

export default function UploadPage() {
  const [step, setStep]               = useState("upload");
  const [dragOver, setDragOver]       = useState(false);
  const [filename, setFilename]       = useState("");
  const [fields, setFields]           = useState(emptyFields());
  const [confidence, setConfidence]       = useState(emptyConfidence());
  const [gstVerification, setGstVerification] = useState(null);
  const [parseError, setParseError]       = useState("");
  const [progress, setProgress]       = useState(0);
  const [created, setCreated]         = useState(null);
  const [riskData, setRiskData]       = useState(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  const fileRef  = useRef(null);
  const navigate = useNavigate();
  const { account, isConnected } = useWeb3();

  /* ── Fake progress ticker while real parse is running ── */
  const startProgressTicker = () => {
    setProgress(0);
    let p = 0;
    // slowly creep to ~85% then stall — real result finishes it
    const iv = setInterval(() => {
      p += Math.random() * 6;
      if (p >= 85) { clearInterval(iv); return; }
      setProgress(Math.round(p));
    }, 200);
    return iv;
  };

  const handleFile = async (file) => {
    if (!file) return;
    // Accept only allowed types
    if (file.name && !file.type) {
      // Called from "Add invoice" demo button — skip real parsing
      setFilename(file.name);
      setStep("parsing");
      let p = 0;
      const iv = setInterval(() => {
        p += Math.random() * 22;
        if (p >= 100) { p = 100; clearInterval(iv); setTimeout(() => setStep("review"), 350); }
        setProgress(Math.min(p, 100));
      }, 200);
      return;
    }

    setFilename(file.name);
    setParseError("");
    setStep("parsing");

    const ticker = startProgressTicker();

    try {
      const result = await parseInvoiceFile(file);
      clearInterval(ticker);
      setProgress(100);

      const newFields = { ...emptyFields() };
      const newConf   = { ...emptyConfidence() };

      for (const [key, data] of Object.entries(result.fields)) {
        if (key in newFields) {
          newFields[key] = data.value ?? "";
          newConf[key]   = typeof data.confidence === "number" ? data.confidence : 1;
        }
      }

      setFields(newFields);
      setConfidence(newConf);
      setGstVerification(result.gstVerification ?? null);

      setTimeout(() => setStep("review"), 350);
    } catch (err) {
      clearInterval(ticker);
      setProgress(0);
      setParseError(err.message || "Failed to parse invoice");
      setStep("upload");
    }
  };

  const handleDraftToken = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await createInvoice({
        businessName: fields.smeName || fields.clientCompanyName || "Unknown",
        clientName:   fields.clientCompanyName || "Unknown",
        amount:       parseFloat(String(fields.totalAmount).replace(/,/g, "")) || 0,
        dueDate:      fields.dueDate,
        smeWallet:    isConnected ? account : undefined,
        invoiceNumber:     fields.invoiceNumber,
        invoiceDate:       fields.invoiceDate,
        clientGST:         fields.clientGSTNumber,
        smeName:           fields.smeName,
      });

      setCreated(res);

      if (res.riskScore != null) {
        setRiskData({
          overall: res.riskScore,
          subScores: {
            "Payment Reliability": res.reliability?.paymentReliability ?? 80,
            "Invoice Legitimacy":  Math.min(100, res.riskScore + 3),
            "Business Profile":    Math.max(0,   res.riskScore - 5),
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

  const lowConfidenceCount = Object.values(confidence).filter((c) => c < CONFIDENCE_THRESHOLD).length;

  return (
    <PageBackground className="page" style={{ background: "var(--bg)" }}>
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
            const idx  = stepList.indexOf(step);
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
                  Supports PDF — max 20 MB
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files[0])}
                />
              </div>

              {parseError && (
                <p style={{ textAlign: "center", color: "#B91C1C", marginTop: "1rem", fontSize: "0.85rem", fontFamily: "var(--font-body)" }}>
                  {parseError}
                </p>
              )}
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
              <p style={{ color: "var(--text-muted)", marginBottom: "0.5rem", fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>
                Extracting fields and verifying document structure
              </p>
              {filename && (
                <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", marginBottom: "1.5rem", fontFamily: "var(--font-body)" }}>
                  {filename}
                </p>
              )}
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

              {/* GST verification banner */}
              {gstVerification && gstVerification.status === "verified" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.75rem 1rem", marginBottom: "1rem",
                  background: "#DCFCE7", border: "1px solid rgba(21,128,61,0.3)",
                  borderRadius: "8px", color: "#166534",
                  fontSize: "0.85rem", fontFamily: "var(--font-body)",
                }}>
                  <span style={{ flexShrink: 0 }}><CheckIcon /></span>
                  <span><strong>GST Verified</strong> — {gstVerification.message}</span>
                </div>
              )}
              {gstVerification && gstVerification.status === "mismatch" && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: "0.6rem",
                  padding: "0.75rem 1rem", marginBottom: "1rem",
                  background: "#FEF2F2", border: "1px solid #FCA5A5",
                  borderRadius: "8px", color: "#991B1B",
                  fontSize: "0.85rem", fontFamily: "var(--font-body)",
                }}>
                  <span style={{ color: "#DC2626", flexShrink: 0, marginTop: "1px" }}><WarnIcon /></span>
                  <span>
                    <strong>GST Mismatch Detected</strong> — {gstVerification.message}
                    {gstVerification.expectedGST  && <><br /><span style={{ fontSize: "0.8rem", opacity: 0.85 }}>Expected GST: <code>{gstVerification.expectedGST}</code></span></>}
                    {gstVerification.expectedName && <><br /><span style={{ fontSize: "0.8rem", opacity: 0.85 }}>Expected company: <strong>{gstVerification.expectedName}</strong></span></>}
                  </span>
                </div>
              )}
              {gstVerification && gstVerification.status === "unknown" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.75rem 1rem", marginBottom: "1rem",
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "8px", color: "var(--text-dim)",
                  fontSize: "0.85rem", fontFamily: "var(--font-body)",
                }}>
                  <span style={{ flexShrink: 0 }}><WarnIcon /></span>
                  <span><strong>GST Unverified</strong> — Company not found in local database. Verify manually before submitting.</span>
                </div>
              )}

              {/* Low-confidence warning banner */}
              {lowConfidenceCount > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.6rem",
                  padding: "0.75rem 1rem",
                  marginBottom: "1.25rem",
                  background: "#FFFBEB",
                  border: "1px solid #F59E0B",
                  borderRadius: "8px",
                  color: "#92400E",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-body)",
                }}>
                  <span style={{ color: "#D97706", flexShrink: 0 }}><WarnIcon /></span>
                  <span>
                    <strong>{lowConfidenceCount} field{lowConfidenceCount > 1 ? "s" : ""}</strong> could not be extracted with high confidence — they are highlighted below. Please review and correct before submitting.
                  </span>
                </div>
              )}

              <div className="review-grid">

                {/* Parsed fields */}
                <div>
                  <div className="card" style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.5rem" }}>
                      <span style={{ color: "#15803D" }}><FileIcon /></span>
                      <span style={{ fontWeight: 700, fontSize: "1rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                        Parsed Invoice Fields
                      </span>
                      {filename && (
                        <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                          {filename}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
                      {FIELD_META.map(({ key, label, span }) => {
                        const conf = confidence[key] ?? 1;
                        const isLow = conf < CONFIDENCE_THRESHOLD;
                        return (
                          <div
                            key={key}
                            className="form-group"
                            style={{ gridColumn: span === 2 ? "span 2" : "auto" }}
                          >
                            <label style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.25rem" }}>
                              {label}
                              <ConfidenceBadge confidence={conf} />
                              {!isLow && (
                                <span style={{ color: "var(--text-dim)", fontWeight: 400, fontSize: "0.72rem", textTransform: "none", letterSpacing: 0, marginLeft: "0.25rem" }}>
                                  — editable
                                </span>
                              )}
                            </label>
                            <div style={{ position: "relative" }}>
                              <input
                                className="input"
                                value={fields[key]}
                                onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                                placeholder={isLow ? "Not detected — enter manually" : ""}
                                style={{
                                  paddingRight: "2.5rem",
                                  borderColor: isLow ? "#F59E0B" : undefined,
                                  background: isLow ? "#FFFBEB" : undefined,
                                  outline: isLow ? "none" : undefined,
                                  boxShadow: isLow ? "0 0 0 2px rgba(245,158,11,0.15)" : undefined,
                                }}
                              />
                              <span style={{
                                position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
                                color: isLow ? "#D97706" : "var(--text-dim)",
                              }}>
                                {isLow ? <WarnIcon /> : <EditIcon />}
                              </span>
                            </div>
                          </div>
                        );
                      })}
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

                  {riskData ? (
                    <>
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
                    </>
                  ) : (
                    <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-dim)", fontSize: "0.85rem", fontFamily: "var(--font-body)" }}>
                      Risk score is calculated after token creation
                    </div>
                  )}

                  <div style={{
                    marginTop: "1.25rem",
                    padding: "0.85rem 1rem",
                    background: lowConfidenceCount > 0 ? "#FFFBEB" : "#DCFCE7",
                    border: `1px solid ${lowConfidenceCount > 0 ? "rgba(245,158,11,0.3)" : "rgba(21,128,61,0.2)"}`,
                    borderRadius: "8px",
                  }}>
                    {lowConfidenceCount > 0 ? (
                      <>
                        <p style={{ fontSize: "0.83rem", color: "#92400E", fontWeight: 700, marginBottom: "0.2rem", fontFamily: "var(--font-body)" }}>
                          {lowConfidenceCount} field{lowConfidenceCount > 1 ? "s" : ""} need review
                        </p>
                        <p style={{ fontSize: "0.78rem", color: "#78350F", fontFamily: "var(--font-body)" }}>
                          Highlighted fields were not extracted with sufficient confidence.
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: "0.83rem", color: "#15803D", fontWeight: 700, marginBottom: "0.2rem", fontFamily: "var(--font-body)" }}>
                          All fields extracted successfully
                        </p>
                        <p style={{ fontSize: "0.78rem", color: "#166534", fontFamily: "var(--font-body)" }}>
                          Review and confirm before tokenizing.
                        </p>
                      </>
                    )}
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
                  ["Invoice ID",    `#${created?.id ?? "—"}`],
                  created?.invoiceNumber && ["Invoice Number", created.invoiceNumber],
                  ["Client",        created?.clientName || "—"],
                  created?.tokenId  && ["Token ID (On-Chain)", `#${created.tokenId}`],
                  ["Risk Score",    `${created?.riskScore ?? "—"} (${created?.riskLevel ?? ""})`],
                  ["Status",        created?.onChainMinted ? "Minted on Base Sepolia" : "Live on Marketplace"],
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
    </PageBackground>
  );
}
