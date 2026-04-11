import { verifyWebhookSignature, consumePendingOrder } from "../services/payment.service.js";
import { settleInvoiceOnChain, investOnBehalf } from "../services/blockchain.service.js";
import { updateInvoice } from "../../data/invoices.js";

/**
 * POST /webhook/payment
 * Razorpay fires this on payment events.
 * req.body is a Buffer (raw) thanks to express.raw() middleware.
 */
export const handlePaymentWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).json({ message: "Missing signature header" });
    }

    // req.body is a Buffer when using express.raw()
    const rawBody = typeof req.body === "string" ? req.body : req.body.toString("utf8");

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("Webhook signature verification failed");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // We only care about successful payments
    if (eventType !== "payment.captured" && eventType !== "payment.authorized") {
      return res.json({ status: "ignored", event: eventType });
    }

    const payment = event.payload?.payment?.entity;
    if (!payment) {
      return res.status(400).json({ message: "No payment entity in payload" });
    }

    const notes = payment.notes || {};
    const tokenId = notes.tokenId;
    const purpose = notes.purpose;
    const investorWallet = notes.investorWallet;

    if (!tokenId) {
      console.warn("Webhook payment has no tokenId in notes:", payment.id);
      return res.json({ status: "ignored", reason: "no_tokenId" });
    }

    console.log(`[Webhook] ${eventType} — tokenId=${tokenId}, purpose=${purpose}, amount=${payment.amount / 100} INR`);

    if (purpose === "settlement") {
      // Corporate buyer paid fiat → settle on-chain
      const result = await settleInvoiceOnChain(Number(tokenId), payment.amount / 100);
      console.log("[Webhook] settleInvoice result:", result);

      if (result.success) {
        updateInvoice(Number(tokenId), { settlementTxHash: result.txHash, settledAt: new Date().toISOString() });
      }

      return res.json({ status: "processed", purpose: "settlement", result });
    }

    if (purpose === "investment") {
      // Investor paid via UPI → platform invests on their behalf
      if (!investorWallet) {
        console.warn("Investment webhook missing investorWallet");
        return res.json({ status: "error", reason: "no_investorWallet" });
      }

      const result = await investOnBehalf(Number(tokenId), investorWallet, payment.amount / 100);
      console.log("[Webhook] investOnBehalf result:", result);

      return res.json({ status: "processed", purpose: "investment", result });
    }

    return res.json({ status: "ignored", reason: "unknown_purpose" });
  } catch (error) {
    console.error("Webhook processing error:", error);
    // Always return 200 to avoid Razorpay retries on processing errors
    return res.status(200).json({ status: "error", message: error.message });
  }
};
