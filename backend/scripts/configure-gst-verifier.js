import hre from "hardhat";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  const GST_VERIFIER_ADDRESS = process.env.GST_VERIFIER_ADDRESS;
  if (!GST_VERIFIER_ADDRESS) {
    throw new Error("GST_VERIFIER_ADDRESS not set in .env");
  }

  // Read the Chainlink Functions JS source
  const sourcePath = path.join(__dirname, "..", "chainlink", "gstVerificationSource.js");
  const jsSource = fs.readFileSync(sourcePath, "utf-8");

  console.log("Setting Chainlink Functions JS source on ChainlinkGSTVerifier...");
  console.log("  Contract:", GST_VERIFIER_ADDRESS);
  console.log("  Source length:", jsSource.length, "bytes");

  const gstVerifier = await ethers.getContractAt(
    "ChainlinkGSTVerifier",
    GST_VERIFIER_ADDRESS
  );

  // Set the JS source
  const tx1 = await gstVerifier.setSource(jsSource);
  await tx1.wait();
  console.log("  ✓ JS source set (tx:", tx1.hash, ")");

  // Update subscription ID if changed
  const subId = process.env.CHAINLINK_SUBSCRIPTION_ID;
  if (subId) {
    const currentSubId = await gstVerifier.subscriptionId();
    if (currentSubId.toString() !== subId) {
      const tx2 = await gstVerifier.setSubscriptionId(BigInt(subId));
      await tx2.wait();
      console.log("  ✓ Subscription ID updated to", subId);
    } else {
      console.log("  ✓ Subscription ID already", subId);
    }
  }

  // Update DON ID if needed
  const donIdStr = process.env.CHAINLINK_DON_ID || "fun-base-sepolia-1";
  const donIdBytes32 = ethers.encodeBytes32String(donIdStr);
  const currentDonId = await gstVerifier.donId();
  if (currentDonId !== donIdBytes32) {
    const tx3 = await gstVerifier.setDonId(donIdBytes32);
    await tx3.wait();
    console.log("  ✓ DON ID updated to", donIdStr);
  } else {
    console.log("  ✓ DON ID already", donIdStr);
  }

  console.log(`
══════════════════════════════════════════════════════════════
  ChainlinkGSTVerifier is now configured for live GSTIN
  verification via Chainlink Functions + Decentro API.

  Next steps:
  1. Upload encrypted secrets (DECENTRO_CLIENT_ID, DECENTRO_CLIENT_SECRET)
     to the Chainlink DON via the Functions UI or CLI
  2. Set the encrypted secrets reference:
     gstVerifier.setEncryptedSecretsRef(encryptedRef)
  3. Add this contract as a consumer on subscription #${subId}
     at https://functions.chain.link/base-sepolia/${subId}
══════════════════════════════════════════════════════════════
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
