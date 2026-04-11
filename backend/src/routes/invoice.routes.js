import { Router } from "express";
import multer from "multer";
import {
  createInvoice,
  listInvoices,
  getInvoice,
  getStats,
} from "../controllers/invoice.controller.js";
import { parseInvoiceFile } from "../controllers/parse.controller.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are supported for invoice parsing"));
    }
  },
});

// Invoice parsing (file upload)
router.post("/invoice/parse", upload.single("file"), parseInvoiceFile);

// Invoice CRUD
router.post("/invoice", createInvoice);
router.get("/invoices", listInvoices);
router.get("/invoice/:id", getInvoice);
router.get("/stats", getStats);

// Backward-compatible aliases
router.post("/invoices", createInvoice);
router.get("/invoice", listInvoices);

export default router;
