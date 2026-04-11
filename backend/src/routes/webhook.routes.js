import { Router } from "express";
import express from "express";
import { handlePaymentWebhook } from "../controllers/webhook.controller.js";

const router = Router();

// Razorpay webhook needs raw body for HMAC signature verification.
// mount express.raw() only on this route so it doesn't affect other JSON routes.
router.post("/payment", express.raw({ type: "application/json" }), handlePaymentWebhook);

export default router;
