import { computeRiskProof, submitProofOnChain } from "../services/riskEngine.service.js";

/**
 * POST /api/risk-proof
 * Body: { clientName, threshold? }
 * Computes ZK risk proof for an SME.
 */
export async function getRiskProof(req, res) {
  try {
    const { clientName, threshold } = req.body;

    if (!clientName || typeof clientName !== "string") {
      return res.status(400).json({ message: "clientName is required" });
    }

    const result = await computeRiskProof(clientName, {
      threshold: threshold != null ? Number(threshold) : 60,
    });

    return res.json({
      clientName,
      rawScore: result.rawScore,
      riskLevel: result.riskLevel,
      subScores: result.subScores,
      zkAvailable: result.zkAvailable,
      scoreCommitment: result.scoreCommitment,
      proof: result.proof,
      publicSignals: result.publicSignals,
    });
  } catch (error) {
    console.error("getRiskProof error:", error);
    return res.status(500).json({ message: "Failed to compute risk proof" });
  }
}

/**
 * POST /api/submit-risk-proof
 * Body: { smeWallet, proof, publicSignals }
 * Submits an existing ZK proof to the on-chain RiskScoreRegistry.
 */
export async function submitRiskProof(req, res) {
  try {
    const { smeWallet, proof, publicSignals } = req.body;

    if (!smeWallet || !proof || !publicSignals) {
      return res.status(400).json({
        message: "smeWallet, proof, and publicSignals are required",
      });
    }

    const result = await submitProofOnChain(smeWallet, proof, publicSignals);

    return res.json({
      success: true,
      txHash: result.txHash,
      smeWallet,
    });
  } catch (error) {
    console.error("submitRiskProof error:", error);
    return res.status(500).json({ message: error.message || "Failed to submit proof on-chain" });
  }
}

/**
 * GET /api/risk-score/:clientName
 * Quick endpoint — returns risk score without full ZK proof generation.
 */
export async function getRiskScore(req, res) {
  try {
    const { clientName } = req.params;

    if (!clientName) {
      return res.status(400).json({ message: "clientName param is required" });
    }

    const result = await computeRiskProof(clientName, { threshold: 0 });

    return res.json({
      clientName,
      rawScore: result.rawScore,
      riskLevel: result.riskLevel,
      subScores: result.subScores,
      zkAvailable: result.zkAvailable,
    });
  } catch (error) {
    console.error("getRiskScore error:", error);
    return res.status(500).json({ message: "Failed to get risk score" });
  }
}
