// ─────────────────────────────────────────────────────────────
// Chainlink Functions JavaScript Source for GST IRN Verification
// This script is executed by the Chainlink DON (off-chain oracle)
// ─────────────────────────────────────────────────────────────
// args[0] = GSTIN (or first 15 chars of IRN) to verify
// secrets.DECENTRO_CLIENT_ID     = Decentro client_id
// secrets.DECENTRO_CLIENT_SECRET = Decentro client_secret
//
// Returns: "VALID" (UTF-8 bytes) if GSTIN is valid & active, else throws
// ─────────────────────────────────────────────────────────────

const gstin = args[0];

if (!gstin || gstin.length === 0) {
  throw Error("GSTIN argument is required");
}

// Decentro Business Verification API — no separate auth step needed
// Headers: client_id + client_secret
const response = await Functions.makeHttpRequest({
  url: "https://in.staging.decentro.tech/kyc/public_registry/validate",
  method: "POST",
  headers: {
    "client_id": secrets.DECENTRO_CLIENT_ID,
    "client_secret": secrets.DECENTRO_CLIENT_SECRET,
    "Content-Type": "application/json",
  },
  data: {
    reference_id: `chainlink-gst-${Date.now()}`,
    document_type: "GSTIN",
    id_number: gstin,
    consent: "Y",
    consent_purpose: "Verify GSTIN for on-chain invoice tokenization via Chainlink Functions",
  },
  timeout: 9000, // 9s — Chainlink Functions has a 10s limit
});

if (response.error) {
  throw Error(`Decentro API request failed: ${response.message || "Unknown error"}`);
}

const data = response.data;

// Decentro returns { kycStatus: "SUCCESS", status: "SUCCESS", kycResult: { ... } }
if (
  data &&
  data.kycStatus === "SUCCESS" &&
  data.status === "SUCCESS" &&
  data.kycResult
) {
  return Functions.encodeString("VALID");
}

const reason = data?.message || "GSTIN not found or invalid";
throw Error(`GSTIN verification failed: ${reason}`);
