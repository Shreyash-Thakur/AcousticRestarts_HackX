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

export async function openFundingForToken(tokenId) {
  const res = await fetch(`${API_BASE}/invoice/token/${tokenId}/open-funding`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || err.reason || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fundInvoiceDirect(tokenId, { amountUsd, investorWallet }) {
  const res = await fetch(`${API_BASE}/invoice/token/${tokenId}/fund-direct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountUsd, investorWallet }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || err.reason || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function syncInvestorPosition(tokenId, { investorWallet, deltaAmount, txHash }) {
  const res = await fetch(`${API_BASE}/invoice/token/${tokenId}/sync-position`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ investorWallet, deltaAmount, txHash }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || err.reason || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchInvoiceChainState(tokenId, account) {
  const q = account ? `?account=${encodeURIComponent(account)}` : "";
  const res = await fetch(`${API_BASE}/invoice/token/${tokenId}/chain-state${q}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || err.reason || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchInvestorPortfolio(wallet) {
  const res = await fetch(`${API_BASE}/portfolio/${wallet}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || err.reason || `HTTP ${res.status}`);
  }
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

/* ── UPI / Razorpay Payments ── */

/**
 * Create a Razorpay order for settlement (buyer pays invoice) or investment (fund via UPI).
 * @param {{ tokenId, amountINR, purpose: "settlement"|"investment", investorWallet? }} opts
 * @returns {{ orderId, amount, currency, key_id }}
 */
export async function createPaymentOrder({ tokenId, amountINR, purpose, investorWallet }) {
  const res = await fetch(`${API_BASE}/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenId, amountINR, purpose, investorWallet }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Verify Razorpay payment signature after checkout.
 */
export async function verifyPayment({ orderId, paymentId, signature }) {
  const res = await fetch(`${API_BASE}/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, paymentId, signature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Open Razorpay checkout in the browser.
 * Loads the Razorpay script if not already present, then opens the modal.
 *
 * @param {{ orderId, amount, currency, key_id }} order - from createPaymentOrder()
 * @param {{ name?, description?, prefillEmail?, prefillContact? }} opts
 * @returns {Promise<{ orderId, paymentId, signature }>}
 */
export function openRazorpayCheckout(order, opts = {}) {
  return new Promise((resolve, reject) => {
    const loadAndOpen = () => {
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: opts.name || "InvoFlow",
        description: opts.description || "Invoice Payment",
        prefill: {
          email: opts.prefillEmail || "",
          contact: opts.prefillContact || "",
        },
        handler: (response) => {
          resolve({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          });
        },
        modal: {
          ondismiss: () => reject(new Error("Payment cancelled by user")),
        },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    };

    if (window.Razorpay) {
      loadAndOpen();
    } else {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = loadAndOpen;
      script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      document.head.appendChild(script);
    }
  });
}
