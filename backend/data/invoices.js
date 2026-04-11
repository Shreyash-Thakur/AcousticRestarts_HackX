const invoices = [];
let nextInvoiceId = 1;

export const getNextInvoiceId = () => nextInvoiceId++;

export const addInvoice = (invoice) => {
  invoices.push(invoice);
  return invoice;
};

export const getAllInvoices = () => [...invoices];
