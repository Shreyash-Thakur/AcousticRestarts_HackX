const { ethers } = require("hardhat");

async function main() {
  // Deploy InvoToken (ERC-3525), FundingPool, Paymaster, ChainlinkGSTVerifier
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
