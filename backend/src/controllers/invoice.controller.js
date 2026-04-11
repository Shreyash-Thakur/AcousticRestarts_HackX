import {
  addInvoice,
  getAllInvoices,
  getNextInvoiceId,
} from "../../data/invoices.js";
import { getRiskInsights } from "../services/risk.service.js";
import { getInvoiceOnChain } from "../services/blockchain.service.js";
import { simulateCashflow } from "../services/cashflow.service.js";

const isValidDate = (value) => !Number.isNaN(Date.parse(value));

export const createInvoice = async (req, res) => {
  try {
    const { businessName, clientName, amount, dueDate } = req.body;

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
    const risk = getRiskInsights(clientName);
    const cashflow = simulateCashflow(parsedAmount, dueDate);

    const invoice = addInvoice({
      id,
      businessName,
      clientName,
      amount: parsedAmount,
      dueDate,
      riskScore: risk.riskScore,
      riskLevel: risk.riskLevel,
      returnRate: risk.returnRate,
      reliability: risk.reliability,
      cashflow,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json(invoice);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create invoice" });
  }
};

export const listInvoices = async (_req, res) => {
  try {
    const invoices = getAllInvoices();

    const merged = await Promise.all(
      invoices.map(async (invoice) => {
        const onChain = await getInvoiceOnChain(invoice.id);
        const fundedAmount = Number(onChain.fundedAmount || 0);

        let status = "Pending";
        if (onChain.isPaid) {
          status = "Paid";
        } else if (fundedAmount > 0) {
          status = "Funded";
        }

        return {
          id: invoice.id,
          businessName: invoice.businessName,
          clientName: invoice.clientName,
          amount: Number(onChain.amount || invoice.amount),
          fundedAmount,
          riskScore: invoice.riskScore,
          reliability: invoice.reliability,
          status,
          dueDate: invoice.dueDate,
          riskLevel: invoice.riskLevel,
          returnRate: invoice.returnRate,
          cashflow: invoice.cashflow,
        };
      })
    );

    return res.json(merged);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch invoices" });
  }
};
