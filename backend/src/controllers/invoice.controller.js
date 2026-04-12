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
import {
  mintAndOpenFunding,
  getChainStats,
  ensureFundingOpenOnChain,
  fundInvoiceFromBackend,
  getFundingSnapshotOnChain,
  getInvestorPortfolioOnChain,
  syncInvestmentPosition,
} from "../services/blockchain.service.js";
import { computeRiskProof } from "../services/riskEngine.service.js";
import { verifyIRN } from "../services/gst.service.js";

const isValidDate = (value) => !Number.isNaN(Date.parse(value));

const dedupeInvoices = (rows) => {
  const byKey = new Map();

  const makeKey = (inv) => {
    const invoiceRef = String(inv.invoiceNumber || inv.irn || "").trim().toLowerCase();
    if (!invoiceRef) return `id:${String(inv.id)}`;
    return [
      invoiceRef,
      String(inv.businessName || "").trim().toLowerCase(),
      String(inv.clientName || "").trim().toLowerCase(),
      String(Number(inv.amount) || 0),
      String(inv.dueDate || ""),
    ].join("|");
  };

  for (const inv of rows) {
    const key = makeKey(inv);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, inv);
      continue;
    }

    const prevScore = (prev.tokenId ? 10 : 0) + (prev.mintTxHash ? 5 : 0);
    const curScore = (inv.tokenId ? 10 : 0) + (inv.mintTxHash ? 5 : 0);
    if (curScore > prevScore) {
      byKey.set(key, inv);
      continue;
    }
    if (curScore === prevScore) {
      const prevCreated = new Date(prev.createdAt || 0).getTime();
      const curCreated = new Date(inv.createdAt || 0).getTime();
      if (curCreated > prevCreated) {
        byKey.set(key, inv);
      }
    }
  }

  return [...byKey.values()];
};

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

    // Run ZK risk scoring (non-blocking for response)
    let riskResult = null;
    try {
      riskResult = await computeRiskProof(clientName);
    } catch (err) {
      console.error("Risk scoring failed (non-fatal):", err.message);
    }

    // Run GST IRN verification if we have an IRN (non-blocking)
    let gstResult = null;
    if (chainResult.irn) {
      try {
        gstResult = await verifyIRN(chainResult.irn);
      } catch (err) {
        console.error("GST verification failed (non-fatal):", err.message);
      }
    }

    const fullInvoice = await getFullInvoice(id);

    return res.status(201).json({
      ...fullInvoice,
      tokenId: chainResult.tokenId || null,
      mintTxHash: chainResult.mintTxHash || null,
      fundingTxHash: chainResult.fundingTxHash || null,
      irn: chainResult.irn || null,
      onChainMinted: chainResult.success,
      riskScore: riskResult ? {
        rawScore: riskResult.rawScore,
        riskLevel: riskResult.riskLevel,
        subScores: riskResult.subScores,
        zkAvailable: riskResult.zkAvailable,
      } : null,
      gstVerification: gstResult ? {
        valid: gstResult.valid,
        data: gstResult.data,
      } : null,
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
        invoiceNumber: stored?.invoiceNumber || null,
        smeWallet: stored?.smeWallet || null,
        createdAt: stored?.createdAt || inv.createdAt || null,
      };
    });
    return res.json(dedupeInvoices(enriched));
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

export const openFundingForToken = async (req, res) => {
  try {
    const { tokenId } = req.params;
    let result = await ensureFundingOpenOnChain(tokenId);

    // Auto-heal stale local token references (e.g., contract redeploy changed token set).
    if (!result.success && result.reason === "token_not_minted") {
      const parsedTokenId = Number(tokenId);
      const raw = getRawInvoices();
      const matched = raw.find((r) => Number(r.tokenId) === parsedTokenId);

      if (matched) {
        const remint = await mintAndOpenFunding({
          smeWallet: matched.smeWallet,
          invoiceId: matched.id,
          amount: Number(matched.amount),
          dueDate: matched.dueDate,
        });

        if (remint.success) {
          updateInvoice(matched.id, {
            tokenId: remint.tokenId,
            mintTxHash: remint.mintTxHash,
            fundingTxHash: remint.fundingTxHash,
            irn: remint.irn,
          });

          return res.status(200).json({
            success: true,
            openedNow: true,
            healedStaleToken: true,
            oldTokenId: parsedTokenId,
            remintedTokenId: remint.tokenId,
            mintTxHash: remint.mintTxHash,
            fundingTxHash: remint.fundingTxHash,
            targetAmount: Number(matched.amount) || 0,
          });
        }

        result = {
          success: false,
          reason: remint.reason || "remint_failed",
        };
      }
    }

    if (!result.success) {
      return res.status(400).json({
        message: "Failed to open funding for token",
        ...result,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("openFundingForToken error:", error);
    return res.status(500).json({ message: "Failed to open funding" });
  }
};

export const fundInvoiceDirect = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { amountUsd, investorWallet } = req.body || {};

    const result = await fundInvoiceFromBackend({
      tokenId,
      amountUsd,
      investorWallet,
    });

    if (!result.success) {
      return res.status(400).json({
        message: "Direct funding failed",
        ...result,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("fundInvoiceDirect error:", error);
    return res.status(500).json({ message: "Failed to fund invoice directly" });
  }
};

export const getInvoiceChainState = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { account } = req.query;

    const snapshot = await getFundingSnapshotOnChain({ tokenId, account });
    if (!snapshot.success) {
      return res.status(400).json({
        message: "Failed to fetch invoice chain state",
        ...snapshot,
      });
    }

    return res.status(200).json(snapshot);
  } catch (error) {
    console.error("getInvoiceChainState error:", error);
    return res.status(500).json({ message: "Failed to fetch invoice chain state" });
  }
};

export const getInvestorPortfolio = async (req, res) => {
  try {
    const { wallet } = req.params;
    const result = await getInvestorPortfolioOnChain(wallet);

    if (!result.success) {
      return res.status(400).json({
        message: "Failed to fetch investor portfolio",
        ...result,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("getInvestorPortfolio error:", error);
    return res.status(500).json({ message: "Failed to fetch investor portfolio" });
  }
};

export const syncInvestorPosition = async (req, res) => {
  try {
    const { tokenId } = req.params;
    const { investorWallet, deltaAmount, txHash } = req.body || {};

    const result = await syncInvestmentPosition({ tokenId, investorWallet, deltaAmount, txHash });
    if (!result.success) {
      return res.status(400).json({
        message: "Failed to sync investor position",
        ...result,
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("syncInvestorPosition error:", error);
    return res.status(500).json({ message: "Failed to sync investor position" });
  }
};
