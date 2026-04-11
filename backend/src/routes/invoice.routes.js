import { Router } from "express";
import {
  uploadInvoice,
  getInvoice,
  listInvoices,
} from "../controllers/invoice.controller.js";

const router = Router();

router.post("/", uploadInvoice);
router.get("/:id", getInvoice);
router.get("/", listInvoices);

export default router;
