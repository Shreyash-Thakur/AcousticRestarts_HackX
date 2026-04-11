const invoices = [];
let nextInvoiceId = 1;

export const getNextInvoiceId = () => nextInvoiceId++;

export const addInvoice = (invoice) => {
  invoices.push(invoice);
  return invoice;
};

export const getAllInvoices = () => [...invoices];

export const getInvoiceById = (invoiceId) => {
  const parsedId = Number(invoiceId);
  if (!Number.isFinite(parsedId)) {
    return null;
  }

  return invoices.find((invoice) => invoice.id === parsedId) || null;
};
