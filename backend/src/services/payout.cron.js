import { getAllInvoices } from "../../data/invoices.js";
import { claimReturnsWithBackendWallet, getClaimsStatusOnChain } from "./blockchain.service.js";

const AUTO_CLAIMS_ENABLED = process.env.AUTO_CLAIMS_ENABLED !== "false";
const AUTO_CLAIMS_INTERVAL_MS = Number(process.env.AUTO_CLAIMS_INTERVAL_MS) || 2 * 60 * 1000;

let running = false;

const runAutoClaims = async () => {
  if (!AUTO_CLAIMS_ENABLED || running) return;
  running = true;

  try {
    const invoices = getAllInvoices();
    const tokenIds = [...new Set(
      invoices
        .map((r) => Number(r.tokenId))
        .filter((id) => Number.isFinite(id) && id > 0)
    )];

    for (const tokenId of tokenIds) {
      try {
        const status = await getClaimsStatusOnChain(tokenId);
        if (!status.success || !status.settled) continue;

        const backendRow = (status.investors || []).find((r) => r.isBackendWallet);
        if (!backendRow || !backendRow.claimable) continue;

        const result = await claimReturnsWithBackendWallet(tokenId);
        if (result.success && !result.alreadyClaimed) {
          console.log(`[PayoutCron] Backend auto-claimed returns for token ${tokenId}: ${result.txHash}`);
        }
      } catch (err) {
        console.warn(`[PayoutCron] Failed token ${tokenId}:`, err?.message || err);
      }
    }
  } finally {
    running = false;
  }
};

export const startPayoutCron = () => {
  if (!AUTO_CLAIMS_ENABLED) {
    console.log("[PayoutCron] disabled (AUTO_CLAIMS_ENABLED=false)");
    return;
  }

  console.log(`[PayoutCron] started — checking every ${Math.round(AUTO_CLAIMS_INTERVAL_MS / 1000)}s`);
  runAutoClaims().catch(() => {});
  setInterval(() => {
    runAutoClaims().catch(() => {});
  }, AUTO_CLAIMS_INTERVAL_MS);
};
