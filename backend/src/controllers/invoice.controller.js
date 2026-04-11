import {
  addInvoice,
  getNextInvoiceId,
  updateInvoice,
  getAllInvoices as getRawInvoices,
} from "../../data/invoices.js";
import {
  getAllFullInvoices,
  getFullInvoice,
} from "../services/invoice-orchestration.service.js";
import { mintAndOpenFunding, getChainStats } from "../services/blockchain.service.js";

const isValidDate = (value) => !Number.isNaN(Date.parse(value));

export const createInvoice = async (req, res) => {
  try {
    const {
      businessName,
      clientName,
      amount,
      dueDate,
      smeWallet,
      // Optional enriched fields from invoice parser
      invoiceNumber,
      invoiceDate,
      clientGST,
      smeName,
    } = req.body;

    if (!businessName || !clientName || !amount || !dueDate) {
      return res.status(400).json({
        message: "businessName, clientName, amount, and dueDate are required",
      });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    if (!isValidDate(dueDate)) {
      return res.status(400).json({ message: "dueDate must be a valid date" });
    }

    const id = getNextInvoiceId();
    addInvoice({
      id,
      businessName,
      clientName,
      amount: parsedAmount,
      dueDate,
      smeWallet: smeWallet || null,
      invoiceNumber: invoiceNumber || null,
      invoiceDate: invoiceDate || null,
      clientGST: clientGST || null,
      smeName: smeName || null,
      createdAt: new Date().toISOString(),
    });

    // Try to mint on-chain (non-blocking for response)
    let chainResult = { success: false };
    try {
      chainResult = await mintAndOpenFunding({
        smeWallet,
        invoiceId: id,
        amount: parsedAmount,
        dueDate,
      });
      if (chainResult.success) {
        updateInvoice(id, {
          tokenId: chainResult.tokenId,
          mintTxHash: chainResult.mintTxHash,
          fundingTxHash: chainResult.fundingTxHash,
          irn: chainResult.irn,
        });
      }
    } catch (err) {
      console.error("On-chain minting failed (non-fatal):", err.message);
    }

    const fullInvoice = await getFullInvoice(id);

    return res.status(201).json({
      ...fullInvoice,
      tokenId: chainResult.tokenId || null,
      mintTxHash: chainResult.mintTxHash || null,
      fundingTxHash: chainResult.fundingTxHash || null,
      irn: chainResult.irn || null,
      onChainMinted: chainResult.success,
    });
  } catch (error) {
    console.error("createInvoice error:", error);
    return res.status(500).json({ message: "Failed to create invoice" });
  }
};

export const listInvoices = async (_req, res) => {
  try {
    const fullInvoices = await getAllFullInvoices();
    // Merge stored tokenId/txHash info
    const raw = getRawInvoices();
    const enriched = fullInvoices.filter(Boolean).map((inv) => {
      const stored = raw.find((r) => r.id === inv.id);
      return {
        ...inv,
        tokenId: stored?.tokenId || null,
        mintTxHash: stored?.mintTxHash || null,
        irn: stored?.irn || null,
        smeWallet: stored?.smeWallet || null,
      };
    });
    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch invoices" });
  }
};

export const getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const fullInvoice = await getFullInvoice(Number(id));
    if (!fullInvoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    const raw = getRawInvoices();
    const stored = raw.find((r) => r.id === Number(id));
    return res.json({
      ...fullInvoice,
      tokenId: stored?.tokenId || null,
      mintTxHash: stored?.mintTxHash || null,
      irn: stored?.irn || null,
      smeWallet: stored?.smeWallet || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch invoice" });
  }
};

export const getStats = async (_req, res) => {
  try {
    const invoices = await getAllFullInvoices();
    const valid = invoices.filter(Boolean);
    const totalAmount = valid.reduce((s, i) => s + i.amount, 0);
    const totalFunded = valid.reduce((s, i) => s + (i.fundedAmount || 0), 0);
    const avgYield = valid.length > 0
      ? (valid.reduce((s, i) => s + (i.returnRate || 0), 0) / valid.length).toFixed(1)
      : "0";
    const avgTrust = valid.length > 0
      ? Math.round(valid.reduce((s, i) => s + (i.riskScore || 0), 0) / valid.length)
      : 0;

    const chainStats = await getChainStats();

    return res.json({
      totalInvoices: valid.length,
      totalAmount,
      totalFunded,
      avgYield: `${avgYield}%`,
      avgTrustScore: avgTrust,
      activeInvoices: valid.filter((i) => i.status !== "Paid").length,
      onChainTokens: chainStats?.totalTokens || 0,
      onChainFunded: chainStats?.totalFunded || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch stats" });
  }
};
