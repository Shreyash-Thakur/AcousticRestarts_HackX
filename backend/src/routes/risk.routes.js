import { Router } from "express";
import {
  getRiskProof,
  submitRiskProof,
  getRiskScore,
} from "../controllers/risk.controller.js";

const router = Router();

router.post("/risk-proof", getRiskProof);
router.post("/submit-risk-proof", submitRiskProof);
router.get("/risk-score/:clientName", getRiskScore);

export default router;
