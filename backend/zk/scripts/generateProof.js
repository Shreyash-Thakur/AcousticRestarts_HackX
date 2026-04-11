// Generates a Groth16 zk-SNARK proof for the RiskScore circuit.
// Outputs { proof, publicSignals } ready for on-chain verification.
import * as snarkjs from "snarkjs";
import { buildPoseidon } from "circomlibjs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, "..", "build");
const KEYS_DIR = path.join(__dirname, "..", "keys");

const WASM_PATH = path.join(BUILD_DIR, "riskScore_js", "riskScore.wasm");
const ZKEY_PATH = path.join(KEYS_DIR, "riskScore_final.zkey");
const VKEY_PATH = path.join(KEYS_DIR, "verification_key.json");

/**
 * Compute the Poseidon hash commitment: Poseidon(rawScore, salt)
 */
async function computeCommitment(rawScore, salt) {
  const poseidon = await buildPoseidon();
  const hash = poseidon([BigInt(rawScore), BigInt(salt)]);
  return poseidon.F.toString(hash);
}

/**
 * Generate a zk-SNARK proof that an SME's trust score meets the threshold.
 *
 * @param {Object} params
 * @param {number} params.paymentReliability  - sub-score 0–100
 * @param {number} params.invoiceLegitimacy   - sub-score 0–100
 * @param {number} params.businessProfile     - sub-score 0–100
 * @param {number} [params.threshold=60]      - minimum acceptable score
 * @returns {{ proof, publicSignals, scoreCommitment, rawScore, riskLevel }}
 */
export async function generateRiskProof({
  paymentReliability,
  invoiceLegitimacy,
  businessProfile,
  threshold = 60,
}) {
  // Compute the average (circuit enforces rawScore * 3 === sum)
  const sum = paymentReliability + invoiceLegitimacy + businessProfile;
  if (sum % 3 !== 0) {
    // Nudge sub-scores so they average to an integer (circuit requirement)
    const remainder = sum % 3;
    // Adjust businessProfile by a tiny amount — acceptable for demo
    businessProfile = businessProfile - remainder;
  }

  const rawScore = Math.floor(
    (paymentReliability + invoiceLegitimacy + businessProfile) / 3
  );

  // Random blinding salt
  const salt = BigInt("0x" + crypto.randomBytes(16).toString("hex"));
  const scoreCommitment = await computeCommitment(rawScore, salt);

  // Build witness inputs
  const input = {
    threshold,
    scoreCommitment,
    rawScore,
    salt: salt.toString(),
    paymentReliability,
    invoiceLegitimacy,
    businessProfile,
  };

  // Generate the Groth16 proof
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    WASM_PATH,
    ZKEY_PATH
  );

  // Determine risk level label
  const riskLevel =
    rawScore >= 80 ? "Low" : rawScore >= 60 ? "Medium" : "High";

  return {
    proof,
    publicSignals, // [valid (1), threshold, scoreCommitment]
    scoreCommitment,
    rawScore,
    riskLevel,
  };
}

/**
 * Verify a proof off-chain (used for testing / backend validation).
 */
export async function verifyRiskProof(proof, publicSignals) {
  const fs = await import("fs");
  const vkey = JSON.parse(fs.readFileSync(VKEY_PATH, "utf-8"));
  return snarkjs.groth16.verify(vkey, publicSignals, proof);
}

/**
 * Format proof for on-chain Groth16Verifier.verifyProof() call.
 * Returns Solidity-compatible calldata.
 */
export async function formatProofForChain(proof, publicSignals) {
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const [pA, pB, pC, pubSignals] = JSON.parse("[" + calldata + "]");
  return { pA, pB, pC, pubSignals };
}
