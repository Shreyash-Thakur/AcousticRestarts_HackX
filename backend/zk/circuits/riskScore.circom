pragma circom 2.0.0;

/*
 * RiskScore — Zero-Knowledge Trust Score Proof
 *
 * Proves that an SME's computed trust score meets a minimum threshold
 * WITHOUT revealing the raw score, payment reliability, invoice
 * legitimacy, or business profile sub-scores to the public ledger.
 *
 * Public inputs (visible on-chain):
 *   - threshold        : minimum acceptable score (e.g. 60)
 *   - scoreCommitment  : Poseidon hash of (rawScore, salt) — binds the score
 *
 * Private inputs (never revealed):
 *   - rawScore               : overall trust score 0–100
 *   - salt                   : random blinding factor
 *   - paymentReliability     : sub-score 0–100
 *   - invoiceLegitimacy      : sub-score 0–100
 *   - businessProfile        : sub-score 0–100
 *
 * Constraints:
 *   1. rawScore == (paymentReliability + invoiceLegitimacy + businessProfile) / 3
 *   2. rawScore >= threshold  (proved via range check)
 *   3. scoreCommitment == Poseidon(rawScore, salt)
 */

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";

template RiskScore() {
    // ── Public inputs ──
    signal input threshold;
    signal input scoreCommitment;

    // ── Private inputs ──
    signal input rawScore;
    signal input salt;
    signal input paymentReliability;
    signal input invoiceLegitimacy;
    signal input businessProfile;

    // ── Public output ──
    signal output valid;

    // ── 1. Verify rawScore is the average of sub-scores ──
    //    rawScore * 3 == sum  (avoids integer division issues)
    signal sum;
    sum <== paymentReliability + invoiceLegitimacy + businessProfile;
    rawScore * 3 === sum;

    // ── 2. Range check: rawScore >= threshold ──
    component gte = GreaterEqThan(8); // 8-bit values (0–255, covers 0–100)
    gte.in[0] <== rawScore;
    gte.in[1] <== threshold;
    valid <== gte.out; // 1 if rawScore >= threshold, else 0

    // Enforce that the proof is only valid when score meets threshold
    valid === 1;

    // ── 3. Verify commitment: Poseidon(rawScore, salt) == scoreCommitment ──
    component hasher = Poseidon(2);
    hasher.inputs[0] <== rawScore;
    hasher.inputs[1] <== salt;
    scoreCommitment === hasher.out;
}

component main {public [threshold, scoreCommitment]} = RiskScore();
