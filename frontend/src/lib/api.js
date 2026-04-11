const API_BASE = "/api";

export async function createInvoice({ businessName, clientName, amount, dueDate, smeWallet }) {
  const res = await fetch(`${API_BASE}/invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessName, clientName, amount: Number(amount), dueDate, smeWallet }),
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
