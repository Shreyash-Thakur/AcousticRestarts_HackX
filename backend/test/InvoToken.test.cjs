const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InvoToken", () => {
  let invoToken, admin, sme, investor, other;
  const SLOT = 1001n;
  const AMOUNT = 100_000_000n; // 100 USDC (6 dec)
  const IRN = "INV-2024-00001";

  beforeEach(async () => {
    [admin, sme, investor, other] = await ethers.getSigners();
    const InvoToken = await ethers.getContractFactory("InvoToken");
    invoToken = await InvoToken.deploy(admin.address);
  });

  // ─── Minting ───────────────────────────────────────────────

  it("should mint an invoice token with correct <ID, SLOT, VALUE>", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    const tx = await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);
    const receipt = await tx.wait();

    expect(await invoToken.totalSupply()).to.equal(1n);
    expect(await invoToken.ownerOf(1n)).to.equal(sme.address);
    expect(await invoToken.slotOf(1n)).to.equal(SLOT);
    // Must use explicit signature — JS Object.valueOf() shadows Solidity's
    expect(await invoToken["valueOf(uint256)"](1n)).to.equal(AMOUNT);
    expect(await invoToken.valueDecimals()).to.equal(6);
  });

  it("should store invoice metadata correctly", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);

    const inv = await invoToken.getInvoice(1n);
    expect(inv.irn).to.equal(IRN);
    expect(inv.smeWallet).to.equal(sme.address);
    expect(inv.fiatAmount).to.equal(AMOUNT);
    expect(inv.status).to.equal(0); // Verified
  });

  it("should revert minting if IRN is already tokenized", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);

    await expect(
      invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate)
    ).to.be.revertedWith("InvoToken: IRN already tokenized");
  });

  it("should revert minting with zero amount", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await expect(
      invoToken.mintInvoice(sme.address, SLOT, IRN, 0n, dueDate)
    ).to.be.revertedWith("InvoToken: zero amount");
  });

  it("should revert minting with past due date", async () => {
    const pastDate = BigInt(Math.floor(Date.now() / 1000) - 86400);
    await expect(
      invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, pastDate)
    ).to.be.revertedWith("InvoToken: past due date");
  });

  it("should revert if non-MINTER tries to mint", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await expect(
      invoToken.connect(other).mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate)
    ).to.be.reverted;
  });

  // ─── Value Transfers ───────────────────────────────────────

  it("should transfer value between tokens in the same slot", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);
    await invoToken.mintInvoice(sme.address, SLOT, "INV-2024-00002", AMOUNT, dueDate);

    // SME transfers value from token 1 to token 2
    const transferAmount = 40_000_000n;
    await invoToken.connect(sme)["transferFrom(uint256,uint256,uint256)"](1n, 2n, transferAmount);

    expect(await invoToken["valueOf(uint256)"](1n)).to.equal(AMOUNT - transferAmount);
    expect(await invoToken["valueOf(uint256)"](2n)).to.equal(AMOUNT + transferAmount);
  });

  it("should split value to a new token for recipient", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);

    const splitAmount = 30_000_000n;
    await invoToken.connect(sme)["transferFrom(uint256,address,uint256)"](1n, investor.address, splitAmount);

    expect(await invoToken["valueOf(uint256)"](1n)).to.equal(AMOUNT - splitAmount);
    // New token ID = 2
    expect(await invoToken.ownerOf(2n)).to.equal(investor.address);
    expect(await invoToken["valueOf(uint256)"](2n)).to.equal(splitAmount);
    expect(await invoToken.slotOf(2n)).to.equal(SLOT); // same slot
  });

  it("should revert transfer across different slots", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);
    await invoToken.mintInvoice(sme.address, 9999n, "INV-2024-00002", AMOUNT, dueDate);

    await expect(
      invoToken.connect(sme)["transferFrom(uint256,uint256,uint256)"](1n, 2n, 1_000_000n)
    ).to.be.revertedWith("InvoToken: slot mismatch");
  });

  // ─── IRN Check ─────────────────────────────────────────────

  it("should report IRN as tokenized after minting", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    expect(await invoToken.isIrnTokenized(IRN)).to.be.false;
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);
    expect(await invoToken.isIrnTokenized(IRN)).to.be.true;
  });

  // ─── Status Updates ────────────────────────────────────────

  it("should update invoice status", async () => {
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400);
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);

    await invoToken.setInvoiceStatus(1n, 1); // Funded
    const inv = await invoToken.getInvoice(1n);
    expect(inv.status).to.equal(1);
  });
});
