import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import invoiceRoutes from "./routes/invoice.routes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/", invoiceRoutes);
app.use("/api", invoiceRoutes);

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
app.listen(PORT, () => console.log(`InvoFlow API running on port ${PORT}`));
