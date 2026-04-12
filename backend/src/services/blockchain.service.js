import { ethers } from "ethers";
import { getAllInvoices } from "../../data/invoices.js";
import { getInvestmentsByToken, getInvestmentsByWallet, setInvestmentPosition } from "../../data/investments.js";

const RPC_URL =
  process.env.BASE_SEPOLIA_RPC_URL ||
  process.env.RPC_URL ||
  process.env.TESTNET_RPC_URL ||
  "";
const INVO_TOKEN_ADDRESS =
  process.env.CONTRACT_ADDRESS ||
  process.env.INVOICE_CONTRACT_ADDRESS ||
  "";
const FUNDING_POOL_ADDRESS = process.env.FUNDING_POOL_ADDRESS || "";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";

const blockchainEnabled =
  process.env.BLOCKCHAIN_ENABLED === "false"
    ? false
    : Boolean(RPC_URL && INVO_TOKEN_ADDRESS);

/* ── ABIs ── */
const invoTokenAbi = [
  "function mintInvoice(address to, uint256 slot, string irn, uint256 amount, uint256 dueDate) external returns (uint256)",
  "function getInvoice(uint256) view returns (tuple(string irn, address sme, uint256 amount, uint256 dueDate, uint8 status))",
  "function valueOf(uint256) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function setInvoiceStatus(uint256, uint8) external",
  "event InvoiceMinted(uint256 indexed tokenId, uint256 indexed slot, string irn, address indexed sme, uint256 amount, uint256 dueDate)",
];
const fundingPoolAbi = [
  "function openFunding(uint256 tokenId) external",
  "function getFundingInfo(uint256) view returns (tuple(uint256 tokenId, uint256 targetAmount, uint256 fundedAmount, uint256 fundingDeadline, bool fullyFunded, bool settled))",
  "function getInvestment(address, uint256) view returns (uint256)",
  "function hasClaimed(address, uint256) view returns (bool)",
  "function claimReturns(uint256 tokenId) external",
  "function settleInvoice(uint256 tokenId) external payable",
  "function invest(uint256 tokenId) external payable",
  "function transferInvestment(uint256 tokenId, address to, uint256 amount) external",
  "function platformBackstop(uint256 tokenId) external payable",
  "event InvestmentMade(uint256 indexed tokenId, address indexed investor, uint256 amount)",
  "event InvoiceSettled(uint256 indexed tokenId, uint256 repaymentAmount)",
  "event InvestorWithdrawal(uint256 indexed tokenId, address indexed investor, uint256 payout)",
  "event PositionTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount)",
];

const FUNDING_POOL_DEPLOY_BLOCK = Number(process.env.FUNDING_POOL_DEPLOY_BLOCK) || 40060000;

/* ── Provider + Contracts ── */
const provider = RPC_URL ? new ethers.JsonRpcProvider(RPC_URL) : null;
const wallet =
  provider && DEPLOYER_KEY ? new ethers.Wallet(DEPLOYER_KEY, provider) : null;

const invoTokenRead =
  provider && INVO_TOKEN_ADDRESS
    ? new ethers.Contract(INVO_TOKEN_ADDRESS, invoTokenAbi, provider)
    : null;
const invoTokenWrite =
  wallet && INVO_TOKEN_ADDRESS
    ? new ethers.Contract(INVO_TOKEN_ADDRESS, invoTokenAbi, wallet)
    : null;
const fundingPoolRead =
  provider && FUNDING_POOL_ADDRESS
    ? new ethers.Contract(FUNDING_POOL_ADDRESS, fundingPoolAbi, provider)
    : null;
const fundingPoolWrite =
  wallet && FUNDING_POOL_ADDRESS
    ? new ethers.Contract(FUNDING_POOL_ADDRESS, fundingPoolAbi, wallet)
    : null;

export const getBackendWalletAddress = () => (wallet ? wallet.address : null);

/* ── Helpers ── */
const seededRandom = (seed) => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

const simulateFunding = (invoiceId, amount) => {
  const parsedId = Number(invoiceId);
  const totalAmount = Number(amount) || 0;
  const randomPercent = 0.2 + seededRandom(parsedId * 97 + 17) * 0.75;
  return Math.min(Number((totalAmount * randomPercent).toFixed(2)), totalAmount);
};

const fallbackState = (invoiceId, amount) => ({
  amount: Number(amount) || 0,
  fundedAmount: simulateFunding(invoiceId, amount),
  isPaid: false,
  blockchainAvailable: false,
});

/* ── Read invoice from chain ── */
export const getChainInvoice = async (invoiceId, amount) => {
  if (!blockchainEnabled || !invoTokenRead) {
    return fallbackState(invoiceId, amount);
  }
  const parsedId = Number(invoiceId);
  if (!Number.isFinite(parsedId) || parsedId < 1) {
    return fallbackState(invoiceId, amount);
  }
  try {
    const info = await invoTokenRead.getInvoice(parsedId);
    const onChainAmount = Number(ethers.formatUnits(info.amount, 6));
    let fundedAmount = 0;
    if (fundingPoolRead) {
      try {
        const fi = await fundingPoolRead.getFundingInfo(parsedId);
        fundedAmount = Number(ethers.formatUnits(fi.fundedAmount, 6));
      } catch { /* funding not opened yet */ }
    }
    return {
      amount: onChainAmount || Number(amount) || 0,
      fundedAmount,
      isPaid: Number(info.status) >= 2,
      blockchainAvailable: true,
      tokenId: parsedId,
      onChainStatus: Number(info.status),
    };
  } catch (err) {
    // Token id exists in local DB but is not readable on current chain deployment.
    // Do not show simulated funding in this case; force a safe zero-funded state.
    return {
      amount: Number(amount) || 0,
      fundedAmount: 0,
      isPaid: false,
      blockchainAvailable: true,
      tokenId: parsedId,
      tokenMissing: true,
      reason: err?.message || "token_not_minted",
    };
  }
};
export const getInvoiceOnChain = getChainInvoice;

/* ── Ensure funding is opened for a token ── */
export const ensureFundingOpenOnChain = async (tokenId) => {
  if (!blockchainEnabled || !fundingPoolWrite || !fundingPoolRead || !wallet) {
    return { success: false, reason: "blockchain_disabled" };
  }

  const parsedTokenId = Number(tokenId);
  if (!Number.isFinite(parsedTokenId) || parsedTokenId < 1) {
    return { success: false, reason: "invalid_token_id" };
  }

  try {
    // Guard: token must exist on-chain.
    try {
      await invoTokenRead.ownerOf(parsedTokenId);
    } catch {
      return { success: false, reason: "token_not_minted" };
    }

    // If already open, return fast.
    const current = await fundingPoolRead.getFundingInfo(parsedTokenId);
    const currentTarget = Number(ethers.formatUnits(current.targetAmount, 6));
    if (currentTarget > 0) {
      return {
        success: true,
        openedNow: false,
        alreadyOpen: true,
        targetAmount: currentTarget,
      };
    }

    // Open now via admin/deployer wallet.
    const tx = await fundingPoolWrite.openFunding(parsedTokenId, {
      gasLimit: 500000n,
    });
    const receipt = await tx.wait();

    // Verify it really opened.
    const updated = await fundingPoolRead.getFundingInfo(parsedTokenId);
    const updatedTarget = Number(ethers.formatUnits(updated.targetAmount, 6));
    if (updatedTarget <= 0) {
      return {
        success: false,
        reason: "open_funding_verification_failed",
        txHash: receipt.hash,
      };
    }

    return {
      success: true,
      openedNow: true,
      alreadyOpen: false,
      txHash: receipt.hash,
      targetAmount: updatedTarget,
    };
  } catch (err) {
    return { success: false, reason: err.message || "open_funding_failed" };
  }
};

/* ── Server-side direct funding fallback (no contract changes) ── */
export const fundInvoiceFromBackend = async ({ tokenId, amountUsd, investorWallet }) => {
  if (!blockchainEnabled || !fundingPoolWrite || !fundingPoolRead || !wallet) {
    return { success: false, reason: "blockchain_disabled" };
  }

  const parsedTokenId = Number(tokenId);
  const parsedAmount = Number(amountUsd);
  if (!Number.isFinite(parsedTokenId) || parsedTokenId < 1) {
    return { success: false, reason: "invalid_token_id" };
  }
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { success: false, reason: "invalid_amount" };
  }

  try {
    try {
      await invoTokenRead.ownerOf(parsedTokenId);
    } catch {
      return { success: false, reason: "token_not_minted" };
    }

    const openResult = await ensureFundingOpenOnChain(parsedTokenId);
    if (!openResult.success) {
      return { success: false, reason: openResult.reason || "open_funding_failed" };
    }

    const backendAddr = await wallet.getAddress();
    const before = await fundingPoolRead.getInvestment(backendAddr, parsedTokenId);

    const amountWei = ethers.parseUnits(String(parsedAmount), 6);
    const investTx = await fundingPoolWrite.invest(parsedTokenId, {
      value: amountWei,
      gasLimit: 500000n,
    });
    const investReceipt = await investTx.wait();

    const after = await fundingPoolRead.getInvestment(backendAddr, parsedTokenId);
    const delta = after - before;

    let transferTxHash = null;
    if (
      investorWallet &&
      ethers.isAddress(investorWallet) &&
      investorWallet.toLowerCase() !== backendAddr.toLowerCase() &&
      delta > 0n
    ) {
      const transferTx = await fundingPoolWrite.transferInvestment(
        parsedTokenId,
        investorWallet,
        delta,
        { gasLimit: 300000n }
      );
      const transferReceipt = await transferTx.wait();
      transferTxHash = transferReceipt.hash;

      // Persist investor's updated on-chain position for fast UI reflection.
      const investorPosition = await fundingPoolRead.getInvestment(investorWallet, parsedTokenId);
      setInvestmentPosition({
        tokenId: parsedTokenId,
        investorWallet,
        amount: Number(ethers.formatUnits(investorPosition, 6)),
        txHash: transferTxHash,
      });
    } else if (delta > 0n) {
      // Investment remains with backend wallet.
      const backendPosition = await fundingPoolRead.getInvestment(backendAddr, parsedTokenId);
      setInvestmentPosition({
        tokenId: parsedTokenId,
        investorWallet: backendAddr,
        amount: Number(ethers.formatUnits(backendPosition, 6)),
        txHash: investReceipt.hash,
      });
    }

    return {
      success: true,
      investTxHash: investReceipt.hash,
      transferTxHash,
      fundedAmount: Number(ethers.formatUnits(delta, 6)),
    };
  } catch (err) {
    return { success: false, reason: err.message || "fund_invoice_failed" };
  }
};

export const getFundingSnapshotOnChain = async ({ tokenId, account }) => {
  if (!blockchainEnabled || !fundingPoolRead) {
    return { success: false, reason: "blockchain_disabled" };
  }

  const parsedTokenId = Number(tokenId);
  if (!Number.isFinite(parsedTokenId) || parsedTokenId < 1) {
    return { success: false, reason: "invalid_token_id" };
  }

  try {
    const fi = await fundingPoolRead.getFundingInfo(parsedTokenId);

    const ledgerRows = getInvestmentsByToken(parsedTokenId);
    const funders = ledgerRows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({ address: String(r.investorWallet).toLowerCase(), amount: Number(r.amount) }));

    let myPosition = 0;
    if (account && ethers.isAddress(account)) {
      try {
        const invested = await fundingPoolRead.getInvestment(account, parsedTokenId);
        myPosition = Number(ethers.formatUnits(invested, 6));
        if (myPosition <= 0) {
          const fallback = ledgerRows.find(
            (r) => String(r.investorWallet || "").toLowerCase() === String(account).toLowerCase()
          );
          myPosition = Number(fallback?.amount || 0);
        }
      } catch {
        const fallback = ledgerRows.find(
          (r) => String(r.investorWallet || "").toLowerCase() === String(account).toLowerCase()
        );
        myPosition = Number(fallback?.amount || 0);
      }

      if (myPosition > 0) {
        const idx = funders.findIndex((f) => f.address === String(account).toLowerCase());
        if (idx >= 0) {
          funders[idx].amount = Math.max(Number(funders[idx].amount || 0), myPosition);
        } else {
          funders.push({ address: String(account).toLowerCase(), amount: myPosition });
        }
      }
    }

    funders.sort((a, b) => b.amount - a.amount);

    return {
      success: true,
      tokenId: parsedTokenId,
      targetAmount: Number(ethers.formatUnits(fi.targetAmount, 6)),
      fundedAmount: Number(ethers.formatUnits(fi.fundedAmount, 6)),
      fullyFunded: Boolean(fi.fullyFunded),
      settled: Boolean(fi.settled),
      fundingDeadline: Number(fi.fundingDeadline),
      funders,
      myPosition,
    };
  } catch (err) {
    return { success: false, reason: err.message || "snapshot_failed" };
  }
};

export const getInvestorPortfolioOnChain = async (walletAddress) => {
  if (!blockchainEnabled || !fundingPoolRead || !invoTokenRead) {
    return { success: false, reason: "blockchain_disabled" };
  }
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    return { success: false, reason: "invalid_wallet" };
  }

  try {
    const invoiceTokenIds = getAllInvoices()
      .map((r) => Number(r.tokenId))
      .filter((id) => Number.isFinite(id) && id > 0);
    const ledgerTokenIds = getInvestmentsByWallet(walletAddress)
      .map((r) => Number(r.tokenId))
      .filter((id) => Number.isFinite(id) && id > 0);
    const tokenIds = [...new Set([...invoiceTokenIds, ...ledgerTokenIds])];
    const positions = [];

    for (const tokenId of tokenIds) {
      try {
        const ledgerRow = getInvestmentsByWallet(walletAddress).find((r) => Number(r.tokenId) === tokenId);
        let investedAmount = Number(ledgerRow?.amount || 0);
        try {
          const invested = await fundingPoolRead.getInvestment(walletAddress, tokenId);
          const chainAmount = Number(ethers.formatUnits(invested, 6));
          investedAmount = Math.max(investedAmount, chainAmount);
        } catch {
          // Keep ledger fallback value.
        }
        if (investedAmount <= 0) continue;

        const fi = await fundingPoolRead.getFundingInfo(tokenId);
        const inv = await invoTokenRead.getInvoice(tokenId);
        const dueDateUnix = Number(inv[3]) || 0;
        const daysToMaturity = Math.max(0, Math.ceil((dueDateUnix * 1000 - Date.now()) / 86400000));
        const yld = 10;
        let claimed = false;
        try {
          claimed = await fundingPoolRead.hasClaimed(walletAddress, tokenId);
        } catch {
          claimed = false;
        }
        const claimable = Boolean(fi.settled) && !claimed;

        positions.push({
          id: `chain-${tokenId}`,
          tokenId,
          business: `Invoice #${tokenId}`,
          invoiceNumber: `INV-${String(tokenId).padStart(3, "0")}`,
          investedAmount,
          expectedReturn: investedAmount * (yld / 100) * (daysToMaturity / 365),
          yield: yld,
          trustScore: 75,
          riskLevel: "Medium",
          daysToMaturity,
          status: fi.settled ? "settled" : "funding",
          claimed,
          claimable,
          targetAmount: Number(ethers.formatUnits(fi.targetAmount, 6)),
          fundedAmount: Number(ethers.formatUnits(fi.fundedAmount, 6)),
          _source: "chain",
        });
      } catch {
        // ignore per-token read errors
      }
    }

    return { success: true, positions };
  } catch (err) {
    return { success: false, reason: err.message || "portfolio_failed", positions: [] };
  }
};

export const syncInvestmentPosition = async ({ tokenId, investorWallet, deltaAmount = 0, txHash = null }) => {
  try {
    if (!investorWallet || !ethers.isAddress(investorWallet)) {
      return { success: false, error: "Invalid investor wallet" };
    }

    const parsedTokenId = Number(tokenId);
    if (!Number.isFinite(parsedTokenId) || parsedTokenId <= 0) {
      return { success: false, error: "Invalid token id" };
    }

    const numericDelta = Number(deltaAmount) || 0;
    let amount = 0;
    let source = "ledger";

    try {
      const invested = await fundingPoolRead.getInvestment(investorWallet, parsedTokenId);
      amount = Number(ethers.formatUnits(invested, 6));
      source = "chain";

      if (amount <= 0 && numericDelta > 0) {
        const existing = getInvestmentsByWallet(investorWallet).find((r) => Number(r.tokenId) === parsedTokenId);
        amount = Number(existing?.amount || 0) + numericDelta;
        source = "chain+delta";
      }
    } catch {
      const existing = getInvestmentsByWallet(investorWallet).find((r) => Number(r.tokenId) === parsedTokenId);
      amount = Number(existing?.amount || 0) + numericDelta;
    }

    const record = setInvestmentPosition({
      tokenId: parsedTokenId,
      investorWallet,
      amount,
      txHash,
    });

    return {
      success: true,
      tokenId: parsedTokenId,
      investorWallet: String(investorWallet).toLowerCase(),
      amount,
      source,
      record,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const transferEscrowedPositionOnChain = async ({ tokenId, toWallet, amount }) => {
  if (!blockchainEnabled || !fundingPoolWrite || !fundingPoolRead || !wallet) {
    return { success: false, reason: "blockchain_disabled" };
  }

  const parsedTokenId = Number(tokenId);
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedTokenId) || parsedTokenId < 1) {
    return { success: false, reason: "invalid_token_id" };
  }
  if (!toWallet || !ethers.isAddress(toWallet)) {
    return { success: false, reason: "invalid_to_wallet" };
  }
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { success: false, reason: "invalid_amount" };
  }

  try {
    const transferAmount = ethers.parseUnits(String(parsedAmount), 6);
    const tx = await fundingPoolWrite.transferInvestment(parsedTokenId, toWallet, transferAmount, {
      gasLimit: 300000n,
    });
    const receipt = await tx.wait();

    const updated = await fundingPoolRead.getInvestment(toWallet, parsedTokenId);
    setInvestmentPosition({
      tokenId: parsedTokenId,
      investorWallet: toWallet,
      amount: Number(ethers.formatUnits(updated, 6)),
      txHash: receipt.hash,
    });

    return { success: true, txHash: receipt.hash };
  } catch (err) {
    return { success: false, reason: err.message || "transfer_failed" };
  }
};

/* ── Mint invoice on-chain + open funding ── */
export const mintAndOpenFunding = async ({ smeWallet, invoiceId, amount, dueDate }) => {
  if (!blockchainEnabled || !invoTokenWrite) {
    return { success: false, reason: "blockchain_disabled" };
  }
  try {
    const to = smeWallet || wallet.address;
    const slot = 1; // single category for hackathon
    // Use timestamp suffix to guarantee unique IRN across server restarts
    const irn = `IRN-${Date.now()}-${String(invoiceId).padStart(4, "0")}`;
    const amountWei = ethers.parseUnits(String(amount), 6);
    const dueDateUnix = Math.floor(new Date(dueDate).getTime() / 1000);

    // 1. Mint the InvoToken
    const mintTx = await invoTokenWrite.mintInvoice(to, slot, irn, amountWei, dueDateUnix);
    const mintReceipt = await mintTx.wait();

    // Extract tokenId from Transfer event (ERC-721 mint: from=0x0, to=sme, tokenId)
    let tokenId = null;
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    for (const log of mintReceipt.logs) {
      if (log.address.toLowerCase() === INVO_TOKEN_ADDRESS.toLowerCase() && log.topics[0] === transferTopic) {
        tokenId = Number(BigInt(log.topics[3]));
        break;
      }
    }
    if (!tokenId) {
      // Fallback: read totalSupply
      tokenId = Number(await invoTokenWrite.totalSupply());
    }

    // 2. Open funding on FundingPool (skip gas estimation with raw tx)
    let fundingTx = null;
    if (fundingPoolWrite && wallet) {
      try {
        const ftx = await fundingPoolWrite.openFunding(tokenId, {
          gasLimit: 500000n,
        });
        fundingTx = await ftx.wait();
      } catch (err) {
        console.error("openFunding failed (non-fatal):", err.message);
      }
    }

    return {
      success: true,
      tokenId,
      mintTxHash: mintReceipt.hash,
      fundingTxHash: fundingTx?.hash || null,
      irn,
    };
  } catch (err) {
    console.error("mintAndOpenFunding error:", err.message);
    return { success: false, reason: err.message };
  }
};

/* ── Get platform stats from chain ── */
export const getChainStats = async () => {
  if (!blockchainEnabled || !invoTokenRead) return null;
  try {
    const supply = Number(await invoTokenRead.totalSupply());
    let totalFunded = 0;
    for (let i = 1; i <= supply; i++) {
      try {
        if (!fundingPoolRead) break;
        const fi = await fundingPoolRead.getFundingInfo(i);
        totalFunded += Number(ethers.formatUnits(fi.fundedAmount, 6));
      } catch { /* skip */ }
    }
    return { totalTokens: supply, totalFunded };
  } catch {
    return null;
  }
};

/* ── INR → ETH conversion ── */
const INR_PER_ETH = Number(process.env.INR_PER_ETH) || 250000;

export const convertINRtoWei = (amountINR) => {
  const ethAmount = amountINR / INR_PER_ETH;
  return ethers.parseEther(ethAmount.toFixed(18));
};

export const convertINRtoETH = (amountINR) => amountINR / INR_PER_ETH;

/* ── Settle invoice on-chain (called by webhook after fiat payment) ── */
export const settleInvoiceOnChain = async (tokenId, amountINR) => {
  if (!blockchainEnabled || !fundingPoolWrite) {
    return { success: false, reason: "blockchain_disabled" };
  }
  try {
    const fi = await fundingPoolRead.getFundingInfo(tokenId);
    if (!fi.fullyFunded) {
      return { success: false, reason: "invoice_not_fully_funded" };
    }
    if (fi.settled) {
      return { success: false, reason: "already_settled" };
    }

    // Settlement value must be >= targetAmount. For hackathon, send targetAmount + 5% yield.
    const yieldMultiplier = 105n; // 105% = principal + 5% yield
    const settlementValue = (fi.targetAmount * yieldMultiplier) / 100n;

    const tx = await fundingPoolWrite.settleInvoice(tokenId, { value: settlementValue, gasLimit: 500000n });
    const receipt = await tx.wait();

    return { success: true, txHash: receipt.hash, settlementValue: ethers.formatEther(settlementValue) };
  } catch (err) {
    console.error("settleInvoiceOnChain error:", err.message);
    return { success: false, reason: err.message };
  }
};

/* ── Invest on behalf of a UPI investor (platform wallet invests, then transfers position) ── */
export const investOnBehalf = async (tokenId, investorWallet, amountINR) => {
  if (!blockchainEnabled || !fundingPoolWrite) {
    return { success: false, reason: "blockchain_disabled" };
  }
  try {
    const amountWei = convertINRtoWei(amountINR);

    // 1. Platform wallet invests
    const investTx = await fundingPoolWrite.invest(tokenId, { value: amountWei, gasLimit: 500000n });
    const investReceipt = await investTx.wait();

    // 2. Transfer the position to the actual investor wallet
    let transferTxHash = null;
    if (investorWallet && investorWallet !== wallet.address) {
      try {
        const transferTx = await fundingPoolWrite.transferInvestment(tokenId, investorWallet, amountWei, { gasLimit: 300000n });
        const transferReceipt = await transferTx.wait();
        transferTxHash = transferReceipt.hash;

        const investorPosition = await fundingPoolRead.getInvestment(investorWallet, tokenId);
        setInvestmentPosition({
          tokenId,
          investorWallet,
          amount: Number(ethers.formatUnits(investorPosition, 6)),
          txHash: transferTxHash,
        });
      } catch (err) {
        console.error("transferInvestment failed (non-fatal):", err.message);
      }
    }

    return {
      success: true,
      investTxHash: investReceipt.hash,
      transferTxHash,
      amountETH: ethers.formatEther(amountWei),
    };
  } catch (err) {
    console.error("investOnBehalf error:", err.message);
    return { success: false, reason: err.message };
  }
};

/* ── Platform Backstop — fill remaining gap after 2-week deadline ── */
export const callPlatformBackstop = async (tokenId) => {
  if (!blockchainEnabled || !fundingPoolWrite || !fundingPoolRead) {
    return { success: false, reason: "blockchain_disabled" };
  }
  try {
    const fi = await fundingPoolRead.getFundingInfo(tokenId);
    if (fi.fullyFunded) return { success: false, reason: "already_funded" };
    if (fi.targetAmount === 0n) return { success: false, reason: "not_open" };

    const now = Math.floor(Date.now() / 1000);
    if (now < Number(fi.fundingDeadline)) {
      return { success: false, reason: "deadline_not_reached" };
    }

    const remaining = fi.targetAmount - fi.fundedAmount;
    const tx = await fundingPoolWrite.platformBackstop(tokenId, {
      value: remaining,
      gasLimit: 600000n,
    });
    const receipt = await tx.wait();

    return { success: true, txHash: receipt.hash, amountETH: ethers.formatEther(remaining) };
  } catch (err) {
    console.error("callPlatformBackstop error:", err.message);
    return { success: false, reason: err.message };
  }
};

/* ── Get all open fundings past deadline (for cron) ── */
export const getExpiredUnfundedTokens = async () => {
  if (!blockchainEnabled || !invoTokenRead || !fundingPoolRead) return [];
  try {
    const supply = Number(await invoTokenRead.totalSupply());
    const expired = [];
    const now = Math.floor(Date.now() / 1000);

    for (let i = 1; i <= supply; i++) {
      try {
        const fi = await fundingPoolRead.getFundingInfo(i);
        if (
          fi.targetAmount > 0n &&
          !fi.fullyFunded &&
          Number(fi.fundingDeadline) > 0 &&
          now >= Number(fi.fundingDeadline)
        ) {
          expired.push({
            tokenId: i,
            remaining: fi.targetAmount - fi.fundedAmount,
            deadline: Number(fi.fundingDeadline),
          });
        }
      } catch { /* funding not opened for this token */ }
    }
    return expired;
  } catch {
    return [];
  }
};

export const getSettlementAmountOnChain = async (tokenId) => {
  if (!blockchainEnabled || !fundingPoolRead) return { success: false, reason: "blockchain_disabled" };

  const parsedTokenId = Number(tokenId);
  if (!Number.isFinite(parsedTokenId) || parsedTokenId < 1) {
    return { success: false, reason: "invalid_token_id" };
  }

  try {
    const filter = fundingPoolRead.filters.InvoiceSettled(parsedTokenId);
    const events = await fundingPoolRead.queryFilter(filter, FUNDING_POOL_DEPLOY_BLOCK, "latest");
    if (!events.length) return { success: true, amount: 0 };

    const latest = events[events.length - 1];
    const repaymentAmount = latest.args?.repaymentAmount ?? latest.args?.[1] ?? 0n;
    return { success: true, amount: Number(ethers.formatUnits(repaymentAmount, 6)), txHash: latest.transactionHash };
  } catch (err) {
    return { success: false, reason: err.message || "settlement_query_failed" };
  }
};

export const getClaimsStatusOnChain = async (tokenId) => {
  if (!blockchainEnabled || !fundingPoolRead) {
    return { success: false, reason: "blockchain_disabled" };
  }

  const parsedTokenId = Number(tokenId);
  if (!Number.isFinite(parsedTokenId) || parsedTokenId < 1) {
    return { success: false, reason: "invalid_token_id" };
  }

  try {
    const fi = await fundingPoolRead.getFundingInfo(parsedTokenId);
    const targetAmount = Number(ethers.formatUnits(fi.targetAmount, 6));
    const settled = Boolean(fi.settled);

    const settlement = await getSettlementAmountOnChain(parsedTokenId);
    const settledAmount = settlement.success ? Number(settlement.amount || 0) : 0;

    const ledgerRows = getInvestmentsByToken(parsedTokenId);
    const addrSet = new Set(
      ledgerRows
        .map((r) => String(r.investorWallet || "").toLowerCase())
        .filter(Boolean)
    );

    const backendAddr = getBackendWalletAddress();
    if (backendAddr) addrSet.add(String(backendAddr).toLowerCase());

    const investors = [];
    for (const investor of addrSet) {
      try {
        const invested = await fundingPoolRead.getInvestment(investor, parsedTokenId);
        const position = Number(ethers.formatUnits(invested, 6));
        if (position <= 0) continue;

        const claimed = await fundingPoolRead.hasClaimed(investor, parsedTokenId);
        const claimable = settled && !claimed;
        const estimatedPayout = claimable && targetAmount > 0
          ? (settledAmount * position) / targetAmount
          : 0;

        investors.push({
          investorWallet: investor,
          position,
          claimed: Boolean(claimed),
          claimable,
          estimatedPayout,
          isBackendWallet: backendAddr ? investor === String(backendAddr).toLowerCase() : false,
        });
      } catch {
        // skip malformed/unsupported addresses
      }
    }

    return {
      success: true,
      tokenId: parsedTokenId,
      settled,
      targetAmount,
      settledAmount,
      investors,
      backendWallet: backendAddr,
    };
  } catch (err) {
    return { success: false, reason: err.message || "claims_status_failed" };
  }
};

export const claimReturnsWithBackendWallet = async (tokenId) => {
  if (!blockchainEnabled || !fundingPoolRead || !fundingPoolWrite || !wallet) {
    return { success: false, reason: "blockchain_disabled" };
  }

  const parsedTokenId = Number(tokenId);
  if (!Number.isFinite(parsedTokenId) || parsedTokenId < 1) {
    return { success: false, reason: "invalid_token_id" };
  }

  try {
    const backendAddr = String(wallet.address).toLowerCase();
    const fi = await fundingPoolRead.getFundingInfo(parsedTokenId);
    if (!fi.settled) return { success: false, reason: "invoice_not_settled" };

    const invested = await fundingPoolRead.getInvestment(backendAddr, parsedTokenId);
    const investedAmount = Number(ethers.formatUnits(invested, 6));
    if (investedAmount <= 0) return { success: false, reason: "no_backend_position" };

    const claimed = await fundingPoolRead.hasClaimed(backendAddr, parsedTokenId);
    if (claimed) return { success: true, alreadyClaimed: true, backendWallet: backendAddr, tokenId: parsedTokenId };

    const tx = await fundingPoolWrite.claimReturns(parsedTokenId, { gasLimit: 400000n });
    const receipt = await tx.wait();

    return {
      success: true,
      alreadyClaimed: false,
      tokenId: parsedTokenId,
      backendWallet: backendAddr,
      txHash: receipt.hash,
    };
  } catch (err) {
    return { success: false, reason: err.message || "backend_claim_failed" };
  }
};
