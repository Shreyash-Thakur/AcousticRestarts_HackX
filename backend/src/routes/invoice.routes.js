import { Router } from "express";
import {
  createInvoice,
  listInvoices,
} from "../controllers/invoice.controller.js";

const router = Router();

router.post("/invoice", createInvoice);
router.get("/invoices", listInvoices);

// Backward-compatible aliases for existing frontend integration.
router.post("/invoices", createInvoice);
router.get("/invoice", listInvoices);

export default router;
