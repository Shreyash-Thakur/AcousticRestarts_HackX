import { ethers } from "ethers";

const RPC_URL =
  process.env.RPC_URL ||
  process.env.TESTNET_RPC_URL ||
  process.env.BASE_SEPOLIA_RPC_URL ||
  "";
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || process.env.INVOICE_CONTRACT_ADDRESS || "";
const hasExplicitBlockchainToggle = typeof process.env.BLOCKCHAIN_ENABLED !== "undefined";
const blockchainEnabled = hasExplicitBlockchainToggle
  ? process.env.BLOCKCHAIN_ENABLED === "true"
  : Boolean(RPC_URL && CONTRACT_ADDRESS);

export const defaultChainResponse = {
  amount: 0,
  fundedAmount: 0,
  isPaid: false,
};

const defaultAbi = [
  "function getInvoice(uint256 invoiceId) view returns (uint256 amount, uint256 fundedAmount, bool isPaid)",
  "function invoices(uint256 invoiceId) view returns (uint256 amount, uint256 fundedAmount, bool isPaid)",
];

const provider = RPC_URL ? new ethers.JsonRpcProvider(RPC_URL) : null;
const contract =
  provider && CONTRACT_ADDRESS
    ? new ethers.Contract(CONTRACT_ADDRESS, defaultAbi, provider)
    : null;

const normalizeBigInt = (value) => Number(value ?? 0n);

const seededRandom = (seed) => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

const simulateFunding = (invoiceId, amount) => {
  const parsedId = Number(invoiceId);
  const totalAmount = Number(amount) || 0;
  const randomPercent = 0.2 + seededRandom(parsedId * 97 + 17) * 0.75;
  const rawFunded = Number((totalAmount * randomPercent).toFixed(2));

  return Math.min(rawFunded, totalAmount);
};

const fallbackState = (invoiceId, amount) => {
  const totalAmount = Number(amount) || 0;
  return {
    ...defaultChainResponse,
    amount: totalAmount,
    fundedAmount: simulateFunding(invoiceId, totalAmount),
    blockchainAvailable: false,
  };
};

export const getChainInvoice = async (invoiceId, amount) => {
  if (!blockchainEnabled || !contract) {
    return fallbackState(invoiceId, amount);
  }

  const parsedInvoiceId = Number(invoiceId);
  if (!Number.isFinite(parsedInvoiceId) || parsedInvoiceId < 1) {
    return fallbackState(invoiceId, amount);
  }

  try {
    const data = await contract.getInvoice(parsedInvoiceId);
    return {
      amount: normalizeBigInt(data.amount) || Number(amount) || 0,
      fundedAmount: normalizeBigInt(data.fundedAmount),
      isPaid: Boolean(data.isPaid),
      blockchainAvailable: true,
    };
  } catch (_error) {
    try {
      const data = await contract.invoices(parsedInvoiceId);
      return {
        amount: normalizeBigInt(data.amount) || Number(amount) || 0,
        fundedAmount: normalizeBigInt(data.fundedAmount),
        isPaid: Boolean(data.isPaid),
        blockchainAvailable: true,
      };
    } catch (_fallbackError) {
      return fallbackState(invoiceId, amount);
    }
  }
};

export const getInvoiceOnChain = getChainInvoice;
