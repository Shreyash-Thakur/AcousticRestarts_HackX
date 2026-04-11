import { parseInvoice } from "../services/invoice-parser.service.js";

export async function parseInvoiceFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded. Send the file as field name 'file'." });
    }

    const { buffer, mimetype } = req.file;
    const { fields, gstVerification } = await parseInvoice(buffer, mimetype);
    return res.json({ fields, gstVerification });
  } catch (err) {
    console.error("Invoice parse error:", err.message);
    return res.status(500).json({ message: err.message || "Failed to parse invoice" });
  }
}
