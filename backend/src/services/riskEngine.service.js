// Runs the off-chain ZK risk scoring pipeline:
//   1. Compute trust score from sub-scores (simulated ML)
//   2. Generate zk-SNARK proof via snarkjs
//   3. Optionally submit proof on-chain to RiskScoreRegistry
//   4. Return { rawScore, riskLevel, proof, publicSignals, scoreCommitment }

import { getRiskInsights } from "./risk.service.js";
import {
  generateRiskProof,
  verifyRiskProof,
  formatProofForChain,
} from "../../zk/scripts/generateProof.js";
import { ethers } from "ethers";

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const RISK_REGISTRY_ADDRESS = process.env.RISK_REGISTRY_ADDRESS || "";

const registryAbi = [
  "function submitScoreProof(address sme, uint256[2] pA, uint256[2][2] pB, uint256[2] pC, uint256[3] pubSignals) external",
  "function isScoreVerified(address, uint256) view returns (bool)",
  "function attestations(address) view returns (uint256 scoreCommitment, uint256 threshold, uint256 timestamp, bool verified)",
];

/**
 * Compute risk score + generate ZK proof for an SME.
 *
 * @param {string} clientName — used to seed the deterministic risk model
 * @param {Object} [opts]
 * @param {number} [opts.threshold=60] — minimum score to prove
 * @returns {{ rawScore, riskLevel, proof, publicSignals, scoreCommitment, zkAvailable }}
 */
export const computeRiskProof = async (clientName, opts = {}) => {
  const threshold = opts.threshold ?? 60;

  // Step 1: Get sub-scores from risk model (history-based)
  const insights = getRiskInsights(clientName);

  // Use real sub-scores from history-based model
  let paymentReliability = insights.subScores?.paymentReliability ?? insights.reliability.paymentReliability;
  let invoiceLegitimacy  = insights.subScores?.invoiceLegitimacy  ?? insights.riskScore;
  let businessProfile    = insights.subScores?.businessProfile    ?? Math.min(100, Math.max(0, 100 - insights.reliability.avgDelayDays * 2));

  // Ensure sub-scores average to an integer (circuit constraint: rawScore * 3 === sum)
  const sum = paymentReliability + invoiceLegitimacy + businessProfile;
  const remainder = sum % 3;
  if (remainder !== 0) {
    businessProfile -= remainder;
  }

  try {
    // Step 2: Generate ZK proof
    const result = await generateRiskProof({
      paymentReliability,
      invoiceLegitimacy,
      businessProfile,
      threshold,
    });

    // Step 3: Verify proof locally before returning
    const valid = await verifyRiskProof(result.proof, result.publicSignals);
    if (!valid) {
      throw new Error("Local proof verification failed");
    }

    return {
      rawScore: result.rawScore,
      riskLevel: result.riskLevel,
      proof: result.proof,
      publicSignals: result.publicSignals,
      scoreCommitment: result.scoreCommitment,
      subScores: { paymentReliability, invoiceLegitimacy, businessProfile },
      zkAvailable: true,
    };
  } catch (err) {
    // ZK circuit not compiled yet — fall back to plain score
    console.warn("ZK proof generation unavailable:", err.message);
    const rawScore = Math.floor(
      (paymentReliability + invoiceLegitimacy + businessProfile) / 3
    );
    const riskLevel =
      rawScore >= 80 ? "Low" : rawScore >= 60 ? "Medium" : "High";

    return {
      rawScore,
      riskLevel,
      proof: null,
      publicSignals: null,
      scoreCommitment: null,
      subScores: { paymentReliability, invoiceLegitimacy, businessProfile },
      zkAvailable: false,
    };
  }
};

/**
 * Submit an existing ZK proof to the on-chain RiskScoreRegistry.
 *
 * @param {string} smeWallet — SME's wallet address
 * @param {Object} proof — Groth16 proof object from generateRiskProof
 * @param {string[]} publicSignals — public signals array
 * @returns {{ txHash: string }}
 */
export const submitProofOnChain = async (smeWallet, proof, publicSignals) => {
  if (!RPC_URL || !DEPLOYER_KEY || !RISK_REGISTRY_ADDRESS) {
    throw new Error("Blockchain config missing for ZK submission");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
  const registry = new ethers.Contract(RISK_REGISTRY_ADDRESS, registryAbi, wallet);

  const { pA, pB, pC, pubSignals } = await formatProofForChain(proof, publicSignals);

  const tx = await registry.submitScoreProof(smeWallet, pA, pB, pC, pubSignals);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
};
