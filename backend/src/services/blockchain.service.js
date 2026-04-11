import { ethers } from "ethers";

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
  process.env.BLOCKCHAIN_ENABLED === "true" && Boolean(RPC_URL && INVO_TOKEN_ADDRESS);

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
  "function getFundingInfo(uint256) view returns (tuple(uint256 tokenId, uint256 targetAmount, uint256 fundedAmount, bool fullyFunded, bool settled, bool defaulted))",
  "function getInvestment(address, uint256) view returns (uint256)",
];

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
  } catch {
    return fallbackState(invoiceId, amount);
  }
};
export const getInvoiceOnChain = getChainInvoice;

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
        const data = fundingPoolWrite.interface.encodeFunctionData("openFunding", [tokenId]);
        const ftx = await wallet.sendTransaction({
          to: FUNDING_POOL_ADDRESS,
          data,
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
