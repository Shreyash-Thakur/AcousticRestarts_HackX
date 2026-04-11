#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
#  Compiles riskScore.circom, runs Groth16 trusted setup, and
#  exports a Solidity verifier contract.
#
#  Prerequisites:
#    npm i -D circomlib
#    brew install circom   (or cargo install circom)
#    snarkjs is already in package.json
# ────────────────────────────────────────────────────────────────
set -euo pipefail

CIRCUIT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="$CIRCUIT_DIR/build"
KEYS_DIR="$CIRCUIT_DIR/keys"
CIRCUIT_NAME="riskScore"

mkdir -p "$BUILD_DIR" "$KEYS_DIR"

echo "──── 1. Compiling circuit ────"
circom "$CIRCUIT_DIR/circuits/$CIRCUIT_NAME.circom" \
  --r1cs --wasm --sym \
  -l "$CIRCUIT_DIR/.." \
  -o "$BUILD_DIR"

echo "──── 2. Powers of Tau (phase 1) ────"
npx snarkjs powersoftau new bn128 14 "$KEYS_DIR/pot14_0.ptau" -v
npx snarkjs powersoftau contribute "$KEYS_DIR/pot14_0.ptau" "$KEYS_DIR/pot14_1.ptau" \
  --name="InvoFlow Phase 1" -v -e="$(head -c 64 /dev/urandom | xxd -p)"
npx snarkjs powersoftau prepare phase2 "$KEYS_DIR/pot14_1.ptau" "$KEYS_DIR/pot14_final.ptau" -v

echo "──── 3. Groth16 setup (phase 2) ────"
npx snarkjs groth16 setup "$BUILD_DIR/$CIRCUIT_NAME.r1cs" "$KEYS_DIR/pot14_final.ptau" \
  "$KEYS_DIR/${CIRCUIT_NAME}_0.zkey"
npx snarkjs zkey contribute "$KEYS_DIR/${CIRCUIT_NAME}_0.zkey" "$KEYS_DIR/${CIRCUIT_NAME}_final.zkey" \
  --name="InvoFlow Phase 2" -v -e="$(head -c 64 /dev/urandom | xxd -p)"

echo "──── 4. Export verification key ────"
npx snarkjs zkey export verificationkey "$KEYS_DIR/${CIRCUIT_NAME}_final.zkey" \
  "$KEYS_DIR/verification_key.json"

echo "──── 5. Export Solidity verifier ────"
npx snarkjs zkey export solidityverifier "$KEYS_DIR/${CIRCUIT_NAME}_final.zkey" \
  "$CIRCUIT_DIR/../contracts/core/RiskScoreVerifier.sol"

echo ""
echo "✅  Done!"
echo "   WASM  : $BUILD_DIR/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm"
echo "   zKey  : $KEYS_DIR/${CIRCUIT_NAME}_final.zkey"
echo "   Verifier : contracts/core/RiskScoreVerifier.sol"
