import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.PAYMENT_API_KEY,
  key_secret: process.env.PAYMENT_API_SECRET,
});

// In-memory order tracking: orderId → { tokenId, purpose, investorWallet, amountINR }
const pendingOrders = new Map();

/**
 * Create a Razorpay order for invoice settlement (buyer pays) or UPI investment.
 * @param {object} opts
 * @param {number|string} opts.tokenId  – on-chain token ID
 * @param {number} opts.amountINR       – amount in INR (paise = amountINR * 100)
 * @param {"settlement"|"investment"} opts.purpose
 * @param {string} [opts.investorWallet] – required when purpose === "investment"
 * @returns {Promise<object>} Razorpay order + key_id for frontend checkout
 */
export const createPaymentOrder = async ({ tokenId, amountINR, purpose, investorWallet }) => {
  const order = await razorpay.orders.create({
    amount: Math.round(amountINR * 100), // paise
    currency: "INR",
    receipt: `invo_${tokenId}_${Date.now()}`,
    notes: { tokenId: String(tokenId), purpose, investorWallet: investorWallet || "" },
  });

  pendingOrders.set(order.id, { tokenId: String(tokenId), purpose, investorWallet, amountINR });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key_id: process.env.PAYMENT_API_KEY,
  };
};

/**
 * Create a Razorpay payment link / QR for corporate buyer to settle via UPI.
 */
export const createPaymentLink = async ({ tokenId, amountINR, customerName, customerEmail }) => {
  const link = await razorpay.paymentLink.create({
    amount: Math.round(amountINR * 100),
    currency: "INR",
    description: `Invoice settlement – Token #${tokenId}`,
    customer: { name: customerName || "Buyer", email: customerEmail || undefined },
    notify: { email: !!customerEmail },
    notes: { tokenId: String(tokenId), purpose: "settlement" },
    callback_url: "", // frontend can fill this
    callback_method: "get",
  });

  return { shortUrl: link.short_url, linkId: link.id };
};

/**
 * Verify Razorpay payment signature (after frontend checkout).
 * Returns true if valid.
 */
export const verifyPaymentSignature = ({ orderId, paymentId, signature }) => {
  const body = orderId + "|" + paymentId;
  const expected = crypto
    .createHmac("sha256", process.env.PAYMENT_API_SECRET)
    .update(body)
    .digest("hex");
  return expected === signature;
};

/**
 * Verify Razorpay webhook signature against raw body.
 */
export const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.PAYMENT_API_SECRET;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return expected === signature;
};

/**
 * Look up and remove a pending order.
 */
export const consumePendingOrder = (orderId) => {
  const meta = pendingOrders.get(orderId);
  if (meta) pendingOrders.delete(orderId);
  return meta || null;
};

export const getPendingOrder = (orderId) => pendingOrders.get(orderId) || null;

export { razorpay };
