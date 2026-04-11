import express from "express";
import dotenv from "dotenv";
import invoiceRoutes from "./routes/invoice.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/", invoiceRoutes);
app.use("/api", invoiceRoutes);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`InvoFlow API running on port ${PORT}`));
