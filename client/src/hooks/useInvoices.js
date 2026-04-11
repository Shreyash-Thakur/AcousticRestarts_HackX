import { useState, useEffect } from "react";
import { fetchInvoices } from "../lib/api";

export function useInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoices()
      .then(setInvoices)
      .finally(() => setLoading(false));
  }, []);

  return { invoices, loading };
}
