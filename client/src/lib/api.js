const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function fetchInvoices() {
  const res = await fetch(`${BASE_URL}/invoices`);
  if (!res.ok) throw new Error("Failed to fetch invoices");
  return res.json();
}

export async function uploadInvoice(formData) {
  const res = await fetch(`${BASE_URL}/invoices`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Invoice upload failed");
  return res.json();
}
