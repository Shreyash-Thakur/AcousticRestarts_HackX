const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundingPool", () => {
  let invoToken, fundingPool;
  let admin, sme, investor1, investor2, feeWallet;
  const SLOT = 1001n;
  const AMOUNT = ethers.parseUnits("1", 6); // 1_000_000 (6 decimals in InvoToken VALUE)
  const IRN = "INV-2024-00001";
  const FEE_BPS = 50n; // 0.5%

  beforeEach(async () => {
    [admin, sme, investor1, investor2, feeWallet] = await ethers.getSigners();

    // Deploy InvoToken
    const InvoToken = await ethers.getContractFactory("InvoToken");
    invoToken = await InvoToken.deploy(admin.address);

    // Deploy FundingPool (no USDC — uses native ETH)
    const FundingPool = await ethers.getContractFactory("FundingPool");
    fundingPool = await FundingPool.deploy(
      await invoToken.getAddress(),
      admin.address,
      feeWallet.address,
      FEE_BPS
    );

    // Grant FundingPool the DEFAULT_ADMIN_ROLE on InvoToken so it can setInvoiceStatus
    const DEFAULT_ADMIN_ROLE = await invoToken.DEFAULT_ADMIN_ROLE();
    await invoToken.grantRole(DEFAULT_ADMIN_ROLE, await fundingPool.getAddress());

    // Mint a verified invoice
    const dueDate = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30);
    await invoToken.mintInvoice(sme.address, SLOT, IRN, AMOUNT, dueDate);
  });

  // ─── Open Funding ──────────────────────────────────────────

  it("should open funding for a verified invoice", async () => {
    await fundingPool.openFunding(1n);
    const info = await fundingPool.getFundingInfo(1n);
    expect(info.targetAmount).to.equal(AMOUNT);
    expect(info.fundedAmount).to.equal(0n);
    expect(info.fullyFunded).to.be.false;
  });

  it("should revert opening funding twice", async () => {
    await fundingPool.openFunding(1n);
    await expect(fundingPool.openFunding(1n))
      .to.be.revertedWith("FundingPool: already opened");
  });

  // ─── Investing ─────────────────────────────────────────────

  it("should allow fractional ETH investment", async () => {
    await fundingPool.openFunding(1n);

    const investAmount = 400_000n; // 0.4 of target
    await fundingPool.connect(investor1).invest(1n, { value: investAmount });

    const info = await fundingPool.getFundingInfo(1n);
    expect(info.fundedAmount).to.equal(investAmount);
    expect(info.fullyFunded).to.be.false;

    expect(await fundingPool.getInvestment(investor1.address, 1n)).to.equal(investAmount);
  });

  it("should cap investment at remaining amount and refund excess", async () => {
    await fundingPool.openFunding(1n);

    // Try to invest more than the target
    const overAmount = 2_000_000n;
    const balBefore = await ethers.provider.getBalance(investor1.address);
    const tx = await fundingPool.connect(investor1).invest(1n, { value: overAmount });
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balAfter = await ethers.provider.getBalance(investor1.address);

    // Should only take AMOUNT (the target), excess refunded
    expect(await fundingPool.getInvestment(investor1.address, 1n)).to.equal(AMOUNT);
    const info = await fundingPool.getFundingInfo(1n);
    expect(info.fullyFunded).to.be.true;

    // Balance should decrease by exactly AMOUNT + gas, not overAmount
    expect(balBefore - balAfter).to.equal(AMOUNT + gasUsed);
  });

  // ─── Full Funding ──────────────────────────────────────────

  it("should disburse principal minus fee to SME on full funding", async () => {
    await fundingPool.openFunding(1n);

    await fundingPool.connect(investor1).invest(1n, { value: 600_000n });

    const smeBefore = await ethers.provider.getBalance(sme.address);
    const feeBefore = await ethers.provider.getBalance(feeWallet.address);

    await fundingPool.connect(investor2).invest(1n, { value: 400_000n });

    const expectedFee = (AMOUNT * FEE_BPS) / 10_000n; // 50 = 0.005%
    const expectedNet = AMOUNT - expectedFee;

    expect(await ethers.provider.getBalance(sme.address)).to.equal(smeBefore + expectedNet);
    expect(await ethers.provider.getBalance(feeWallet.address)).to.equal(feeBefore + expectedFee);

    // Invoice status should now be Funded
    const inv = await invoToken.getInvoice(1n);
    expect(inv.status).to.equal(1); // Funded
  });

  it("should revert investing after fully funded", async () => {
    await fundingPool.openFunding(1n);

    await fundingPool.connect(investor1).invest(1n, { value: AMOUNT });

    await expect(
      fundingPool.connect(investor2).invest(1n, { value: 100_000n })
    ).to.be.revertedWith("FundingPool: already funded");
  });

  // ─── Settlement & Claims ───────────────────────────────────

  it("should settle and allow investors to claim pro-rata returns", async () => {
    await fundingPool.openFunding(1n);

    // Two investors: 60 / 40 split
    await fundingPool.connect(investor1).invest(1n, { value: 600_000n });
    await fundingPool.connect(investor2).invest(1n, { value: 400_000n });

    // Settlement: principal + 5% yield = 1_050_000
    const totalRepayment = 1_050_000n;
    await fundingPool.settleInvoice(1n, { value: totalRepayment });

    // Invoice should be Settled
    const inv = await invoToken.getInvoice(1n);
    expect(inv.status).to.equal(2); // Settled

    // Investor1 claims: 60% of 1_050_000 = 630_000
    const bal1Before = await ethers.provider.getBalance(investor1.address);
    const tx1 = await fundingPool.connect(investor1).claimReturns(1n);
    const r1 = await tx1.wait();
    const gas1 = r1.gasUsed * r1.gasPrice;
    const bal1After = await ethers.provider.getBalance(investor1.address);
    expect(bal1After - bal1Before + gas1).to.equal(630_000n);

    // Investor2 claims: 40% of 1_050_000 = 420_000
    const bal2Before = await ethers.provider.getBalance(investor2.address);
    const tx2 = await fundingPool.connect(investor2).claimReturns(1n);
    const r2 = await tx2.wait();
    const gas2 = r2.gasUsed * r2.gasPrice;
    const bal2After = await ethers.provider.getBalance(investor2.address);
    expect(bal2After - bal2Before + gas2).to.equal(420_000n);
  });

  it("should revert double-claim", async () => {
    await fundingPool.openFunding(1n);

    await fundingPool.connect(investor1).invest(1n, { value: AMOUNT });

    await fundingPool.settleInvoice(1n, { value: 1_010_000n });

    await fundingPool.connect(investor1).claimReturns(1n);
    await expect(
      fundingPool.connect(investor1).claimReturns(1n)
    ).to.be.revertedWith("FundingPool: already claimed");
  });

  // ─── Default ───────────────────────────────────────────────

  it("should mark invoice as defaulted", async () => {
    await fundingPool.openFunding(1n);

    await fundingPool.connect(investor1).invest(1n, { value: AMOUNT });

    await fundingPool.markDefaulted(1n);

    const inv = await invoToken.getInvoice(1n);
    expect(inv.status).to.equal(3); // Defaulted

    const info = await fundingPool.getFundingInfo(1n);
    expect(info.defaulted).to.be.true;
  });

  // ─── Fee Config ────────────────────────────────────────────

  it("should reject fee above 1%", async () => {
    await expect(
      fundingPool.setFeeBps(101n)
    ).to.be.revertedWith("FundingPool: fee too high");
  });
});
