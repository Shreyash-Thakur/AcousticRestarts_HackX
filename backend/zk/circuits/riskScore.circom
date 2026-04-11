pragma circom 2.0.0;

// Off-chain risk scoring circuit
// Proves that an SME's Trust Score is within an acceptable band
// without revealing raw banking / GST data on-chain.
template RiskScore() {
    // private inputs
    signal input rawScore;        // ML-computed score (0–100)
    signal input threshold;       // minimum acceptable score

    // public output
    signal output valid;          // 1 if rawScore >= threshold, else 0

    // TODO: implement comparison constraints
}

component main = RiskScore();
