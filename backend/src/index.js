import "dotenv/config";
import express from "express";
import cors from "cors";
import invoiceRoutes from "./routes/invoice.routes.js";
import listingRoutes from "./routes/listing.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import riskRoutes from "./routes/risk.routes.js";
import { startBackstopCron } from "./services/backstop.cron.js";
import { startPayoutCron } from "./services/payout.cron.js";

const app = express();
app.use(cors());

// Webhook routes MUST be mounted BEFORE express.json() so the raw body is preserved
// for Razorpay HMAC signature verification. The route itself uses express.raw().
app.use("/webhook", webhookRoutes);

app.use(express.json());

app.use("/", invoiceRoutes);
app.use("/api", invoiceRoutes);
app.use("/", listingRoutes);
app.use("/api", listingRoutes);
app.use("/api", paymentRoutes);
app.use("/", riskRoutes);
app.use("/api", riskRoutes);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const isBlockchainEnabled = () => {
  const explicit = process.env.BLOCKCHAIN_ENABLED;
  if (typeof explicit !== "undefined") {
    return explicit === "true";
  }

  const rpcUrl =
    process.env.RPC_URL || process.env.TESTNET_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS || process.env.INVOICE_CONTRACT_ADDRESS;
  return Boolean(rpcUrl && contractAddress);
};

app.get("/config", (_req, res) => {
  res.json({
    blockchainEnabled: isBlockchainEnabled(),
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    blockchainEnabled: isBlockchainEnabled(),
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`InvoFlow API running on port ${PORT}`);
  startBackstopCron();
  startPayoutCron();
});
