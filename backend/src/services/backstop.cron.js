import { getExpiredUnfundedTokens, callPlatformBackstop } from "./blockchain.service.js";

const INTERVAL_MS = 10 * 60 * 1000; // check every 10 minutes
let timer = null;

async function runBackstopCheck() {
  try {
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
