import {
  getExpiredUnfundedTokens,
  callPlatformBackstop,
  getEarlyBackstopCandidates,
  earlyBackstopInvest,
} from "./blockchain.service.js";

const INTERVAL_MS = 10 * 60 * 1000; // check every 10 minutes
let timer = null;

async function runBackstopCheck() {
  try {
    // ── 1. Early backstop: 20% of period elapsed + >40% funded → platform fills gap ──
    const earlyCandidates = await getEarlyBackstopCandidates();
    if (earlyCandidates.length > 0) {
      console.log(`[Backstop] Found ${earlyCandidates.length} early backstop candidate(s) (>40% funded, >20% period elapsed)`);
      for (const { tokenId, fundedPercent } of earlyCandidates) {
        console.log(`[Backstop] Early fill tokenId=${tokenId} (${fundedPercent.toFixed(1)}% funded) ...`);
        const result = await earlyBackstopInvest(tokenId);
        if (result.success) {
          console.log(`[Backstop] ✓ tokenId=${tokenId} early backstopped, tx=${result.txHash}`);
        } else {
          console.warn(`[Backstop] ✗ tokenId=${tokenId} early backstop failed: ${result.reason}`);
        }
      }
    }

    // ── 2. Full deadline backstop: deadline passed → platform fills via platformBackstop() ──
    const expired = await getExpiredUnfundedTokens();
    if (expired.length === 0) return;

    console.log(`[Backstop] Found ${expired.length} expired unfunded invoice(s)`);

    for (const { tokenId, remaining } of expired) {
      console.log(`[Backstop] Filling tokenId=${tokenId} ...`);
      const result = await callPlatformBackstop(tokenId);
      if (result.success) {
        console.log(`[Backstop] ✓ tokenId=${tokenId} backstopped, tx=${result.txHash}`);
      } else {
        console.warn(`[Backstop] ✗ tokenId=${tokenId} failed: ${result.reason}`);
      }
    }
  } catch (err) {
    console.error("[Backstop] cron error:", err.message);
  }
}

export function startBackstopCron() {
  if (timer) return;
  console.log(`[Backstop] Cron started — checking every ${INTERVAL_MS / 60000} min`);
  // Run once on startup, then on interval
  runBackstopCheck();
  timer = setInterval(runBackstopCheck, INTERVAL_MS);
}

export function stopBackstopCron() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
