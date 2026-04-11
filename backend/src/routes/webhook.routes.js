import { Router } from "express";
import { handlePaymentWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// Decentro / RazorpayX will POST here on invoice settlement
router.post("/payment", handlePaymentWebhook);

export default router;
