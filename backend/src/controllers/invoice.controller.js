import {
  addInvoice,
  getNextInvoiceId,
} from "../../data/invoices.js";
import {
  getAllFullInvoices,
  getFullInvoice,
} from "../services/invoice-orchestration.service.js";

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
    addInvoice({
      id,
      businessName,
      clientName,
      amount: parsedAmount,
      dueDate,
      createdAt: new Date().toISOString(),
    });

    const fullInvoice = await getFullInvoice(id);

    return res.status(201).json(fullInvoice);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create invoice" });
  }
};

export const listInvoices = async (_req, res) => {
  try {
    const fullInvoices = await getAllFullInvoices();
    return res.json(fullInvoices.filter(Boolean));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch invoices" });
  }
};
