const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundingPool", () => {
  let invoToken, mockUSDC, fundingPool;
  let admin, sme, investor1, investor2, feeWallet;
  const SLOT = 1001n;
  const AMOUNT = 100_000_000n; // 100 USDC
  const IRN = "INV-2024-00001";
  const FEE_BPS = 50n; // 0.5%

  beforeEach(async () => {
    [admin, sme, investor1, investor2, feeWallet] = await ethers.getSigners();

    // Deploy InvoToken
    const InvoToken = await ethers.getContractFactory("InvoToken");
    invoToken = await InvoToken.deploy(admin.address);

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy();

    // Deploy FundingPool
    const FundingPool = await ethers.getContractFactory("FundingPool");
    fundingPool = await FundingPool.deploy(
      await invoToken.getAddress(),
      await mockUSDC.getAddress(),
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

    // Mint USDC to investors
    await mockUSDC.mint(investor1.address, 500_000_000n); // 500 USDC
    await mockUSDC.mint(investor2.address, 500_000_000n);
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

  it("should allow fractional USDC investment", async () => {
    await fundingPool.openFunding(1n);

    const investAmount = 40_000_000n; // 40 USDC
    await mockUSDC.connect(investor1).approve(await fundingPool.getAddress(), investAmount);
    await fundingPool.connect(investor1).invest(1n, investAmount);

    const info = await fundingPool.getFundingInfo(1n);
    expect(info.fundedAmount).to.equal(investAmount);
    expect(info.fullyFunded).to.be.false;

    expect(await fundingPool.getInvestment(investor1.address, 1n)).to.equal(investAmount);
  });

  it("should cap investment at remaining amount", async () => {
    await fundingPool.openFunding(1n);

    // Try to invest more than the target
    await mockUSDC.connect(investor1).approve(await fundingPool.getAddress(), 200_000_000n);
    await fundingPool.connect(investor1).invest(1n, 200_000_000n);

    // Should only take 100 USDC (the target)
    expect(await fundingPool.getInvestment(investor1.address, 1n)).to.equal(AMOUNT);
    const info = await fundingPool.getFundingInfo(1n);
    expect(info.fullyFunded).to.be.true;
  });

  // ─── Full Funding ──────────────────────────────────────────

  it("should disburse principal minus fee to SME on full funding", async () => {
    await fundingPool.openFunding(1n);

    const poolAddr = await fundingPool.getAddress();
    await mockUSDC.connect(investor1).approve(poolAddr, 60_000_000n);
    await mockUSDC.connect(investor2).approve(poolAddr, 40_000_000n);

    await fundingPool.connect(investor1).invest(1n, 60_000_000n);

    const smeBefore = await mockUSDC.balanceOf(sme.address);
    const feeBefore = await mockUSDC.balanceOf(feeWallet.address);

    await fundingPool.connect(investor2).invest(1n, 40_000_000n);

    const expectedFee = (AMOUNT * FEE_BPS) / 10_000n; // 500_000 = 0.5 USDC
    const expectedNet = AMOUNT - expectedFee;

    expect(await mockUSDC.balanceOf(sme.address)).to.equal(smeBefore + expectedNet);
    expect(await mockUSDC.balanceOf(feeWallet.address)).to.equal(feeBefore + expectedFee);

    // Invoice status should now be Funded
    const inv = await invoToken.getInvoice(1n);
    expect(inv.status).to.equal(1); // Funded
  });

  it("should revert investing after fully funded", async () => {
    await fundingPool.openFunding(1n);
    const poolAddr = await fundingPool.getAddress();

    await mockUSDC.connect(investor1).approve(poolAddr, AMOUNT);
    await fundingPool.connect(investor1).invest(1n, AMOUNT);

    await mockUSDC.connect(investor2).approve(poolAddr, 1_000_000n);
    await expect(
      fundingPool.connect(investor2).invest(1n, 1_000_000n)
    ).to.be.revertedWith("FundingPool: already funded");
  });

  // ─── Settlement & Claims ───────────────────────────────────

  it("should settle and allow investors to claim pro-rata returns", async () => {
    await fundingPool.openFunding(1n);
    const poolAddr = await fundingPool.getAddress();

    // Two investors: 60 / 40 split
    await mockUSDC.connect(investor1).approve(poolAddr, 60_000_000n);
    await mockUSDC.connect(investor2).approve(poolAddr, 40_000_000n);
    await fundingPool.connect(investor1).invest(1n, 60_000_000n);
    await fundingPool.connect(investor2).invest(1n, 40_000_000n);

    // Settlement: buyer paid fiat → 100 USDC principal + 5 USDC yield = 105 total
    const totalRepayment = 105_000_000n;
    await mockUSDC.mint(admin.address, totalRepayment);
    await mockUSDC.connect(admin).approve(poolAddr, totalRepayment);
    await fundingPool.settleInvoice(1n, totalRepayment);

    // Invoice should be Settled
    const inv = await invoToken.getInvoice(1n);
    expect(inv.status).to.equal(2); // Settled

    // Investor1 claims: 60 principal + 60% of 5 yield = 60 + 3 = 63 USDC
    const bal1Before = await mockUSDC.balanceOf(investor1.address);
    await fundingPool.connect(investor1).claimReturns(1n);
    const bal1After = await mockUSDC.balanceOf(investor1.address);
    expect(bal1After - bal1Before).to.equal(60_000_000n + 3_000_000n);

    // Investor2 claims: 40 principal + 40% of 5 yield = 40 + 2 = 42 USDC
    const bal2Before = await mockUSDC.balanceOf(investor2.address);
    await fundingPool.connect(investor2).claimReturns(1n);
    const bal2After = await mockUSDC.balanceOf(investor2.address);
    expect(bal2After - bal2Before).to.equal(40_000_000n + 2_000_000n);
  });

  it("should revert double-claim", async () => {
    await fundingPool.openFunding(1n);
    const poolAddr = await fundingPool.getAddress();

    await mockUSDC.connect(investor1).approve(poolAddr, AMOUNT);
    await fundingPool.connect(investor1).invest(1n, AMOUNT);

    await mockUSDC.mint(admin.address, 101_000_000n);
    await mockUSDC.connect(admin).approve(poolAddr, 101_000_000n);
    await fundingPool.settleInvoice(1n, 101_000_000n);

    await fundingPool.connect(investor1).claimReturns(1n);
    await expect(
      fundingPool.connect(investor1).claimReturns(1n)
    ).to.be.revertedWith("FundingPool: already claimed");
  });

  // ─── Default ───────────────────────────────────────────────

  it("should mark invoice as defaulted", async () => {
    await fundingPool.openFunding(1n);
    const poolAddr = await fundingPool.getAddress();

    await mockUSDC.connect(investor1).approve(poolAddr, AMOUNT);
    await fundingPool.connect(investor1).invest(1n, AMOUNT);

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
