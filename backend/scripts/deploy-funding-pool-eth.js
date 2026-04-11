import hre from "hardhat";
import dotenv from "dotenv";

dotenv.config();

/**
 * Deploy only the new ETH-based FundingPool,
 * wiring it to the existing InvoToken.
 */
async function main() {
  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();

  const invoTokenAddr = process.env.CONTRACT_ADDRESS;
  if (!invoTokenAddr) throw new Error("Set CONTRACT_ADDRESS in .env");

  console.log("Deployer    :", deployer.address);
  console.log("InvoToken   :", invoTokenAddr);

  const FundingPool = await ethers.getContractFactory("FundingPool");
  const fundingPool = await FundingPool.deploy(
    invoTokenAddr,
    deployer.address, // admin
    deployer.address, // feeRecipient
    50                // 0.5% fee
  );
  await fundingPool.waitForDeployment();
  const addr = await fundingPool.getAddress();
  console.log("FundingPool :", addr);

  // Grant FundingPool DEFAULT_ADMIN_ROLE on InvoToken (needed for setInvoiceStatus)
  const invoToken = await ethers.getContractAt("InvoToken", invoTokenAddr);
  const DEFAULT_ADMIN_ROLE = await invoToken.DEFAULT_ADMIN_ROLE();
  const tx = await invoToken.grantRole(DEFAULT_ADMIN_ROLE, addr);
  await tx.wait();
  console.log("DEFAULT_ADMIN_ROLE → FundingPool ✓");

  console.log(`\nUpdate .env:\n  FUNDING_POOL_ADDRESS=${addr}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
