import express from "express";
import dotenv from "dotenv";
import invoiceRoutes from "./routes/invoice.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/invoices", invoiceRoutes);
app.use("/api/webhooks", webhookRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`InvoFlow API running on port ${PORT}`));
