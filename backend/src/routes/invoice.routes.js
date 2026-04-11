import { Router } from "express";
import {
  createInvoice,
  listInvoices,
  getInvoice,
  getStats,
} from "../controllers/invoice.controller.js";

const router = Router();

router.post("/invoice", createInvoice);
router.get("/invoices", listInvoices);
router.get("/invoice/:id", getInvoice);
router.get("/stats", getStats);

// Backward-compatible aliases for existing frontend integration.
router.post("/invoices", createInvoice);
router.get("/invoice", listInvoices);

export default router;
