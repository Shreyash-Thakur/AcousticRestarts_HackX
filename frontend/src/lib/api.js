const API_BASE = "/api";

/**
 * Upload a PDF or image file to the backend and receive extracted invoice fields
 * with per-field confidence scores.
 * @param {File} file
 * @returns {Promise<{ fields: Record<string, { value: string, confidence: number }> }>}
 */
export async function parseInvoiceFile(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/invoice/parse`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Parse request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function createInvoice({
  businessName,
  clientName,
  amount,
  dueDate,
  smeWallet,
  invoiceNumber,
  invoiceDate,
  clientGST,
  smeName,
}) {
  const res = await fetch(`${API_BASE}/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      businessName,
      clientName,
      amount: Number(amount),
      dueDate,
      smeWallet,
      invoiceNumber,
      invoiceDate,
      clientGST,
      smeName,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchInvoices() {
  const res = await fetch(`${API_BASE}/invoices`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchInvoice(id) {
  const res = await fetch(`${API_BASE}/invoice/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ── Secondary Market Listings ── */

export async function createListing({ tokenId, sellerWallet, amount, askingPrice }) {
  const res = await fetch(`${API_BASE}/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenId, sellerWallet, amount, askingPrice }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchListings(tokenId) {
  const url = tokenId ? `${API_BASE}/listings?tokenId=${tokenId}` : `${API_BASE}/listings`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function buyListingApi(listingId, { buyerWallet, txHash }) {
  const res = await fetch(`${API_BASE}/listings/${listingId}/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buyerWallet, txHash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function cancelListingApi(listingId, sellerWallet) {
  const res = await fetch(`${API_BASE}/listings/${listingId}?sellerWallet=${sellerWallet}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}
