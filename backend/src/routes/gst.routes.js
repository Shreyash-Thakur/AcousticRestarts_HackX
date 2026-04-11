import { Router } from "express";
import {
  verifyIRNEndpoint,
  verifyGSTINEndpoint,
  requestGSTVerification,
  getGSTStatus,
} from "../controllers/gst.controller.js";

const router = Router();

router.post("/verify-irn", verifyIRNEndpoint);
router.get("/verify-gstin/:gstin", verifyGSTINEndpoint);
router.post("/request-gst-verification", requestGSTVerification);
router.get("/gst-status/:irn", getGSTStatus);

export default router;
