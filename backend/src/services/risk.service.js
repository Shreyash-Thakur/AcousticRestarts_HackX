import { getAllInvoices } from "../../data/invoices.js";
import { getCachedRiskScore, setCachedRiskScore } from "../../data/risk_scores.js";

// Clients with this many invoices or fewer get a default "no-history" score of 100
const HISTORY_THRESHOLD = 3;

// ── Pure scoring function (no I/O — easy to unit-test) ───────────────────────

/**
 * Compute risk sub-scores from a list of invoices for a single client.
 *
 * Rules:
 *   • ≤ HISTORY_THRESHOLD invoices → score 100 (insufficient data, safe default)
 *   • > HISTORY_THRESHOLD invoices → compute from three signals:
 *       1. paymentReliability  (40%) — tokenisation rate (investor endorsement proxy)
 *       2. invoiceLegitimacy   (35%) — amount consistency (low CV = more stable)
 *       3. businessProfile     (25%) — engagement depth (invoice count on platform)
 *
 * @param {Array} invoices  Raw invoice objects for one client from invoices.json
 * @returns {{ rawScore, riskLevel, subScores, invoiceCount, insufficientHistory }}
 */
export const computeClientRiskScore = (invoices) => {
  const count = invoices.length;

  if (count <= HISTORY_THRESHOLD) {
    return {
      rawScore: 50,
      riskLevel: "Medium",
      subScores: { paymentReliability: 50, invoiceLegitimacy: 50, businessProfile: 50 },
      invoiceCount: count,
      insufficientHistory: true,
    };
  }

  // Sub-score 1: Payment Reliability (40%)
  // Tokenised invoices = investors found them trustworthy enough to fund
  const tokenizedCount = invoices.filter((inv) => inv.tokenId != null).length;
  const paymentReliability = Math.min(
    100,
    Math.round(30 + (tokenizedCount / count) * 70)
  );

  // Sub-score 2: Invoice Legitimacy (35%)
  // Low coefficient of variation in amounts → more consistent/predictable client
  const amounts = invoices.map((inv) => Number(inv.amount)).filter((a) => a > 0);
  const mean = amounts.length > 0
    ? amounts.reduce((s, a) => s + a, 0) / amounts.length
    : 0;
  const variance = mean > 0
    ? amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length
    : 0;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const invoiceLegitimacy = Math.max(0, Math.min(100, Math.round(100 - cv * 80)));

  // Sub-score 3: Business Profile (25%)
  // More invoices on the platform = deeper, more established relationship
  // 4 invoices → 40, 10 invoices → ~61, 20+ invoices → ~96
  const businessProfile = Math.min(
    100,
    Math.round(40 + Math.max(0, count - (HISTORY_THRESHOLD + 1)) * 3.5)
  );

  const rawScore = Math.round(
    0.40 * paymentReliability +
    0.35 * invoiceLegitimacy +
    0.25 * businessProfile
  );

  const riskLevel = rawScore >= 80 ? "Low" : rawScore >= 60 ? "Medium" : "High";

  return {
    rawScore,
    riskLevel,
    subScores: { paymentReliability, invoiceLegitimacy, businessProfile },
    invoiceCount: count,
    insufficientHistory: false,
  };
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get enriched risk insights for a client.
 * Reads from the risk_scores.json cache; falls back to recomputing.
 *
 * Returns the same shape consumed by invoice-orchestration.service.js and
 * riskEngine.service.js so nothing else needs changing.
 */
export const getRiskInsights = (clientName) => {
  try {
    const key = normalise(clientName);
    const cached = getCachedRiskScore(key);
    if (cached) return buildInsightsFromScore(cached);
    return recomputeAndCache(key);
  } catch (_err) {
    return defaultInsights();
  }
};

/**
 * Force-recompute the risk score for a client and persist it.
 * Call this after a new invoice is added for that client.
 *
 * @param {string} clientName
 * @returns {object}  Full insights object
 */
export const recomputeRiskForClient = (clientName) => {
  try {
    return recomputeAndCache(normalise(clientName));
  } catch (_err) {
    return defaultInsights();
  }
};

// ── Private helpers ───────────────────────────────────────────────────────────

const normalise = (name) => String(name || "unknown").trim();

const recomputeAndCache = (clientName) => {
  const allInvoices = getAllInvoices();
  const clientInvoices = allInvoices.filter(
    (inv) => normalise(inv.clientName).toLowerCase() === clientName.toLowerCase()
  );
  const computed = computeClientRiskScore(clientInvoices);
  setCachedRiskScore(clientName, computed);
  return buildInsightsFromScore(computed);
};

const buildInsightsFromScore = (scored) => {
  const { rawScore, riskLevel, subScores, invoiceCount, insufficientHistory } = scored;

  // Return rate: lower-risk clients → lower yield (investors accept less premium)
  // score 100 → 7.0%,  score 60 → 11.4%,  score 30 → 14.7%
  const returnRate = parseFloat((18 - rawScore * 0.11).toFixed(1));

  const paymentReliability = subScores?.paymentReliability ?? 100;
  const avgDelayDays = Math.max(1, Math.round((100 - rawScore) * 0.3));
  const reliabilityLevel =
    paymentReliability >= 80 ? "High" : paymentReliability >= 60 ? "Medium" : "Low";

  return {
    riskScore: rawScore,
    riskLevel,
    returnRate,
    subScores,
    invoiceCount: invoiceCount ?? 0,
    insufficientHistory: insufficientHistory ?? true,
    reliability: {
      paymentReliability,
      avgDelayDays,
      reliabilityLevel,
    },
  };
};

const defaultInsights = () => ({
  riskScore: 50,
  riskLevel: "Medium",
  returnRate: parseFloat((18 - 50 * 0.11).toFixed(1)),
  subScores: { paymentReliability: 50, invoiceLegitimacy: 50, businessProfile: 50 },
  invoiceCount: 0,
  insufficientHistory: true,
  reliability: { paymentReliability: 50, avgDelayDays: 15, reliabilityLevel: "Medium" },
});
