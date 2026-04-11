import { readDb, writeDb } from "./db.js";

const DB = "invoices";

export const getAllInvoices = () => readDb(DB);

export const getNextInvoiceId = () => {
  const rows = readDb(DB);
  return rows.length > 0 ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
};

export const addInvoice = (invoice) => {
  const rows = readDb(DB);
  rows.push(invoice);
  writeDb(DB, rows);
  return invoice;
};

export const getInvoiceById = (invoiceId) => {
  const parsedId = Number(invoiceId);
  if (!Number.isFinite(parsedId)) return null;
  return readDb(DB).find((r) => r.id === parsedId) || null;
};

export const updateInvoice = (invoiceId, updates) => {
  const parsedId = Number(invoiceId);
  const rows = readDb(DB);
  const inv = rows.find((r) => r.id === parsedId);
  if (inv) {
    Object.assign(inv, updates);
    writeDb(DB, rows);
  }
  return inv || null;
};
