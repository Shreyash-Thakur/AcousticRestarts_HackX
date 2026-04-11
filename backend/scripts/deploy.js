import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

// ── Well-known Base Sepolia addresses ─────────────────────────────────────────
const BASE_SEPOLIA = {
  // Circle native USDC on Base Sepolia
  USDC: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  // ERC-4337 EntryPoint v0.7 (canonical singleton)
  ENTRY_POINT: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
  // Chainlink Functions Router
  CL_ROUTER: "0xf9B8fc078197181C841c296C876945aaa425B278",
};

async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  console.log("Deployer :", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance  :", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error(
      "Deployer wallet has no ETH on Base Sepolia.\n" +
        "Fund it at https://faucet.quicknode.com/base/sepolia"
    );
  }

  const subscriptionId = BigInt(
    process.env.CHAINLINK_SUBSCRIPTION_ID || "0"
  );
  const donId = ethers.encodeBytes32String(
    process.env.CHAINLINK_DON_ID || "fun-base-sepolia-1"
  );

  // ── 1. InvoToken (ERC-3525) ──────────────────────────────────────────────
  console.log("\n[1/4] Deploying InvoToken...");
  const InvoToken = await ethers.getContractFactory("InvoToken");
  const invoToken = await InvoToken.deploy(deployer.address);
  await invoToken.waitForDeployment();
  const invoTokenAddr = await invoToken.getAddress();
  console.log("    InvoToken :", invoTokenAddr);

  // ── 2. FundingPool ───────────────────────────────────────────────────────
  console.log("\n[2/4] Deploying FundingPool...");
  const FundingPool = await ethers.getContractFactory("FundingPool");
  const fundingPool = await FundingPool.deploy(
    invoTokenAddr,
    BASE_SEPOLIA.USDC,
    deployer.address, // admin
    deployer.address, // feeRecipient
    50                // 0.5 % origination fee
  );
  await fundingPool.waitForDeployment();
  const fundingPoolAddr = await fundingPool.getAddress();
  console.log("    FundingPool :", fundingPoolAddr);

  // ── 3. InvoPaymaster (ERC-4337) ──────────────────────────────────────────
  console.log("\n[3/4] Deploying InvoPaymaster...");
  const InvoPaymaster = await ethers.getContractFactory("InvoPaymaster");
  const invoPaymaster = await InvoPaymaster.deploy(
    BASE_SEPOLIA.ENTRY_POINT,
    deployer.address, // owner
    deployer.address  // verifyingSigner (backend wallet — update after deploy if needed)
  );
  await invoPaymaster.waitForDeployment();
  const invoPaymasterAddr = await invoPaymaster.getAddress();
  console.log("    InvoPaymaster :", invoPaymasterAddr);

  // ── 4. ChainlinkGSTVerifier ──────────────────────────────────────────────
  console.log("\n[4/4] Deploying ChainlinkGSTVerifier...");
  const ChainlinkGSTVerifier = await ethers.getContractFactory("ChainlinkGSTVerifier");
  const gstVerifier = await ChainlinkGSTVerifier.deploy(
    BASE_SEPOLIA.CL_ROUTER,
    invoTokenAddr,
    deployer.address, // admin
    subscriptionId,
    donId
  );
  await gstVerifier.waitForDeployment();
  const gstVerifierAddr = await gstVerifier.getAddress();
  console.log("    ChainlinkGSTVerifier :", gstVerifierAddr);

  // ── Wire roles ───────────────────────────────────────────────────────────
  console.log("\n── Wiring roles...");

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

  // ChainlinkGSTVerifier → MINTER_ROLE on InvoToken (mint after verification)
  let tx = await invoToken.grantRole(MINTER_ROLE, gstVerifierAddr);
  await tx.wait();
  console.log("    MINTER_ROLE        → ChainlinkGSTVerifier ✓");

  // FundingPool → DEFAULT_ADMIN_ROLE on InvoToken (update invoice status)
  tx = await invoToken.grantRole(DEFAULT_ADMIN_ROLE, fundingPoolAddr);
  await tx.wait();
  console.log("    DEFAULT_ADMIN_ROLE → FundingPool ✓");

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`
══════════════════════════ DEPLOYMENT SUMMARY ══════════════════════════
  InvoToken            : ${invoTokenAddr}
  FundingPool          : ${fundingPoolAddr}
  InvoPaymaster        : ${invoPaymasterAddr}
  ChainlinkGSTVerifier : ${gstVerifierAddr}
═══════════════════════════════════════════════════════════════════════

Add to your .env:
  CONTRACT_ADDRESS=${invoTokenAddr}
  INVOICE_CONTRACT_ADDRESS=${invoTokenAddr}

Next steps:
  1. Add ${gstVerifierAddr} as a consumer on Chainlink sub #${subscriptionId}
     at https://functions.chain.link/base-sepolia/${subscriptionId}
  2. Deposit ETH into InvoPaymaster EntryPoint stake (optional for demo).
`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

