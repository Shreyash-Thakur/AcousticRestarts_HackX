import {
  createPaymentOrder,
  createPaymentLink,
  verifyPaymentSignature,
} from "../services/payment.service.js";

/**
 * POST /api/payments/create-order
 * Body: { tokenId, amountINR, purpose: "settlement"|"investment", investorWallet? }
 */
export const createOrder = async (req, res) => {
  try {
    const { tokenId, amountINR, purpose, investorWallet } = req.body;

    if (!tokenId || !amountINR || !purpose) {
      return res.status(400).json({ message: "tokenId, amountINR, and purpose are required" });
    }
    if (!["settlement", "investment"].includes(purpose)) {
      return res.status(400).json({ message: "purpose must be 'settlement' or 'investment'" });
    }
    if (purpose === "investment" && !investorWallet) {
      return res.status(400).json({ message: "investorWallet is required for investment orders" });
    }

    const parsedAmount = Number(amountINR);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "amountINR must be a positive number" });
    }

    const order = await createPaymentOrder({ tokenId, amountINR: parsedAmount, purpose, investorWallet });
    return res.status(201).json(order);
  } catch (error) {
    console.error("createOrder error:", error);
    return res.status(500).json({ message: "Failed to create payment order" });
  }
};

/**
 * POST /api/payments/create-link
 * Body: { tokenId, amountINR, customerName?, customerEmail? }
 */
export const createLink = async (req, res) => {
  try {
    const { tokenId, amountINR, customerName, customerEmail } = req.body;

    if (!tokenId || !amountINR) {
      return res.status(400).json({ message: "tokenId and amountINR are required" });
    }

    const link = await createPaymentLink({
      tokenId,
      amountINR: Number(amountINR),
      customerName,
      customerEmail,
    });
    return res.status(201).json(link);
  } catch (error) {
    console.error("createLink error:", error);
    return res.status(500).json({ message: "Failed to create payment link" });
  }
};

/**
 * POST /api/payments/verify
 * Body: { orderId, paymentId, signature }
 */
export const verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: "orderId, paymentId, and signature are required" });
    }

    const valid = verifyPaymentSignature({ orderId, paymentId, signature });
    if (!valid) {
      return res.status(400).json({ message: "Invalid payment signature", verified: false });
    }

    return res.json({ verified: true, orderId, paymentId });
  } catch (error) {
    console.error("verifyPayment error:", error);
    return res.status(500).json({ message: "Verification failed" });
  }
};
