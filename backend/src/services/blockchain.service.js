import { ethers } from "ethers";

const RPC_URL = process.env.TESTNET_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || "";
const CONTRACT_ADDRESS = process.env.INVOICE_CONTRACT_ADDRESS || "";

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

export const getInvoiceOnChain = async (invoiceId) => {
  if (!contract) {
    return {
      amount: 0,
      fundedAmount: 0,
      isPaid: false,
    };
  }

  const parsedInvoiceId = Number(invoiceId);
  if (!Number.isFinite(parsedInvoiceId) || parsedInvoiceId < 1) {
    return {
      amount: 0,
      fundedAmount: 0,
      isPaid: false,
    };
  }

  try {
    const data = await contract.getInvoice(parsedInvoiceId);
    return {
      amount: normalizeBigInt(data.amount),
      fundedAmount: normalizeBigInt(data.fundedAmount),
      isPaid: Boolean(data.isPaid),
    };
  } catch (_error) {
    try {
      const data = await contract.invoices(parsedInvoiceId);
      return {
        amount: normalizeBigInt(data.amount),
        fundedAmount: normalizeBigInt(data.fundedAmount),
        isPaid: Boolean(data.isPaid),
      };
    } catch (_fallbackError) {
      return {
        amount: 0,
        fundedAmount: 0,
        isPaid: false,
      };
    }
  }
};
