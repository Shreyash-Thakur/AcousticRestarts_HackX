import { getAllInvoices, getInvoiceById } from "../../data/invoices.js";
import { getRiskInsights } from "./risk.service.js";
import { simulateCashflow } from "./cashflow.service.js";
import { getInvoiceOnChain } from "./blockchain.service.js";
import { deriveInvoiceStatus } from "./status.service.js";

const buildUnifiedInvoice = async (metadata) => {
  if (!metadata) {
    return null;
  }

  const risk = getRiskInsights(metadata.clientName);
  const cashflow = simulateCashflow(metadata.amount, metadata.dueDate);
  // Use stored tokenId (on-chain) if available, otherwise fall back to in-memory id
  const chainLookupId = metadata.tokenId || metadata.id;
  const chainState = await getInvoiceOnChain(chainLookupId, metadata.amount);

  const amount = Number(chainState.amount || metadata.amount || 0);
  const fundedAmount = Math.min(Number(chainState.fundedAmount || 0), amount);
  const isPaid = Boolean(chainState.isPaid);

  return {
    id: metadata.id,
    businessName: metadata.businessName,
    clientName: metadata.clientName,
    amount,
    fundedAmount,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    returnRate: risk.returnRate,
    subScores: risk.subScores,
    invoiceCount: risk.invoiceCount,
    insufficientHistory: risk.insufficientHistory,
    reliability: risk.reliability,
    status: deriveInvoiceStatus({ amount, fundedAmount, isPaid }),
    dueDate: metadata.dueDate,
    cashflow,
    createdAt: metadata.createdAt,
    blockchainAvailable: Boolean(chainState.blockchainAvailable),
    tokenId: metadata.tokenId || chainState.tokenId || null,
  };
};

export const getFullInvoice = async (invoiceId) => {
  try {
    const metadata = getInvoiceById(invoiceId);
    return await buildUnifiedInvoice(metadata);
  } catch (_error) {
    return null;
  }
};

export const getAllFullInvoices = async () => {
  try {
    const allMetadata = getAllInvoices();
    return await Promise.all(allMetadata.map((item) => buildUnifiedInvoice(item)));
  } catch (_error) {
    return [];
  }
};
