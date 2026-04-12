import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../context/Web3Context";
import { fetchInvoices, fetchInvestorPortfolio, fetchListings, buyListingApi, cancelListingApi } from "../lib/api";
import PageBackground from "../components/PageBackground";

const shorten = (value = "") => `${value.slice(0, 6)}...${value.slice(-4)}`;

export default function SecondaryMarketPage() {
  const navigate = useNavigate();
  const { account, isConnected, isCorrectChain, connectWallet } = useWeb3();

  const [loading, setLoading] = useState(true);
  const [busyListingId, setBusyListingId] = useState(null);
  const [invoiceByTokenId, setInvoiceByTokenId] = useState(new Map());
  const [myTokenSet, setMyTokenSet] = useState(new Set());
  const [listings, setListings] = useState([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [invoiceRows, listingRows, portfolio] = await Promise.all([
        fetchInvoices(),
        fetchListings(),
        isConnected && account ? fetchInvestorPortfolio(account) : Promise.resolve({ positions: [] }),
      ]);

      const map = new Map();
      for (const inv of Array.isArray(invoiceRows) ? invoiceRows : []) {
        const tokenId = Number(inv.tokenId);
        if (Number.isFinite(tokenId) && tokenId > 0) {
          map.set(String(tokenId), inv);
        }
      }

      const owned = new Set(
        (Array.isArray(portfolio?.positions) ? portfolio.positions : [])
          .map((p) => Number(p.tokenId))
          .filter((id) => Number.isFinite(id) && id > 0)
          .map((id) => String(id))
      );

      setInvoiceByTokenId(map);
      setListings(Array.isArray(listingRows) ? listingRows : []);
      setMyTokenSet(owned);
    } catch (err) {
      console.warn("Failed to load secondary market:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const intervalId = setInterval(refresh, 8000);
    return () => clearInterval(intervalId);
  }, [isConnected, account]);

  const myListings = useMemo(() => {
    if (!account) return [];
    return listings.filter((l) => String(l.sellerWallet).toLowerCase() === String(account).toLowerCase());
  }, [listings, account]);

  const openListings = useMemo(() => {
    if (!account) return listings;
    return listings.filter((l) => String(l.sellerWallet).toLowerCase() !== String(account).toLowerCase());
  }, [listings, account]);

  const handleBuy = async (listing) => {
    if (!isConnected) {
      connectWallet();
      return;
    }
    if (String(listing?.sellerWallet || "").toLowerCase() === String(account || "").toLowerCase()) {
      alert("This is your own listing. Use Cancel instead.");
      return;
    }
    if (!isCorrectChain) {
      alert("Please switch to Base Sepolia network.");
      return;
    }

    setBusyListingId(listing.id);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const askWei = ethers.parseUnits(String(listing.askingPrice), 6);
      const tx = await signer.sendTransaction({
        to: listing.sellerWallet,
        value: askWei,
      });
      const receipt = await tx.wait();

      const buyRes = await buyListingApi(listing.id, {
        buyerWallet: account,
        txHash: receipt.hash,
      });

      if (buyRes?.autoTransferred) {
        alert("Purchase recorded and position transferred automatically.");
      } else {
        alert("Purchase recorded. Manual seller transfer is required for this legacy listing.");
      }
      window.dispatchEvent(new CustomEvent("investment-updated", {
        detail: { tokenId: Number(listing.tokenId), account },
      }));
      await refresh();
    } catch (err) {
      alert(err?.reason || err?.message || "Buy failed");
    } finally {
      setBusyListingId(null);
    }
  };

  const handleCancel = async (listing) => {
    if (!isConnected || !account) return;
    setBusyListingId(listing.id);
    try {
      await cancelListingApi(listing.id, account);
      await refresh();
    } catch (err) {
      alert(err?.message || "Failed to cancel listing");
    } finally {
      setBusyListingId(null);
    }
  };

  return (
    <PageBackground className="page" style={{ background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "2.5rem", paddingBottom: "4rem" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "0.3rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
              Secondary Debt Market
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>
              Buy listed debt positions from other investors, or list your own position from invoice details.
            </p>
          </div>
          <button className="btn btn-outline" onClick={() => navigate("/dashboard/investor")}>
            Back to Portfolio
          </button>
        </div>

        <div style={{ marginBottom: "1rem", padding: "0.9rem 1rem", borderRadius: "10px", border: "1px solid var(--border)", background: "#FFFBEB" }}>
          <p style={{ fontSize: "0.83rem", color: "#92400E", fontFamily: "var(--font-body)" }}>
            To sell: open any owned invoice and click List Position for Sale. Buyers can discover and purchase listings here.
          </p>
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Loading secondary market...</p>
        ) : (
          <>
            <div className="card" style={{ marginBottom: "1.25rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontFamily: "var(--font-head)", marginBottom: "0.75rem", color: "var(--text)" }}>
                Your Listings ({myListings.length})
              </h3>
              {myListings.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", fontFamily: "var(--font-body)" }}>
                  No active listings. Go to your portfolio and list an owned position.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.9rem" }}>
                  {myListings.map((l) => {
                    const inv = invoiceByTokenId.get(String(l.tokenId));
                    const tokenId = Number(l.tokenId);
                    return (
                      <div key={l.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "0.9rem", background: "var(--surface)" }}>
                        <p style={{ fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-body)", marginBottom: "0.3rem" }}>
                          {inv?.businessName || inv?.business || `Invoice #${l.tokenId}`}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.5rem", fontFamily: "var(--font-body)" }}>
                          Token #{l.tokenId}
                        </p>
                        <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", fontFamily: "var(--font-body)", marginBottom: "0.2rem" }}>
                          Position: <strong style={{ color: "var(--text)" }}>${Number(l.amount).toLocaleString()}</strong>
                        </p>
                        <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", fontFamily: "var(--font-body)", marginBottom: "0.75rem" }}>
                          Ask: <strong style={{ color: "#15803D" }}>${Number(l.askingPrice).toLocaleString()}</strong>
                        </p>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => navigate(`/invoice/${tokenId}`)}>
                            View
                          </button>
                          <button className="btn btn-sm" style={{ flex: 1, border: "1px solid #B91C1C", color: "#B91C1C", background: "white" }} disabled={busyListingId === l.id} onClick={() => handleCancel(l)}>
                            {busyListingId === l.id ? "Cancelling..." : "Cancel"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ fontSize: "1.05rem", fontFamily: "var(--font-head)", marginBottom: "0.75rem", color: "var(--text)" }}>
                Open Listings ({openListings.length})
              </h3>
              {openListings.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", fontFamily: "var(--font-body)" }}>
                  No active listings right now.
                </p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.9rem" }}>
                  {openListings.map((l) => {
                    const inv = invoiceByTokenId.get(String(l.tokenId));
                    const tokenId = Number(l.tokenId);
                    const mine = String(l.sellerWallet || "").toLowerCase() === String(account || "").toLowerCase();
                    const owned = myTokenSet.has(String(l.tokenId));
                    return (
                      <div key={l.id} style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "0.9rem", background: "white" }}>
                        <p style={{ fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-body)", marginBottom: "0.3rem" }}>
                          {inv?.businessName || inv?.business || `Invoice #${l.tokenId}`}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", marginBottom: "0.4rem", fontFamily: "var(--font-body)" }}>
                          Token #{l.tokenId} · Seller {shorten(String(l.sellerWallet))}
                        </p>
                        <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", fontFamily: "var(--font-body)", marginBottom: "0.2rem" }}>
                          Position: <strong style={{ color: "var(--text)" }}>${Number(l.amount).toLocaleString()}</strong>
                        </p>
                        <p style={{ fontSize: "0.84rem", color: "var(--text-muted)", fontFamily: "var(--font-body)", marginBottom: "0.2rem" }}>
                          Ask: <strong style={{ color: "#15803D" }}>${Number(l.askingPrice).toLocaleString()}</strong>
                        </p>
                        <p style={{ fontSize: "0.8rem", color: l.discount > 0 ? "#15803D" : l.discount < 0 ? "#B91C1C" : "var(--text-dim)", marginBottom: "0.75rem", fontFamily: "var(--font-body)" }}>
                          {l.discount > 0 ? `${l.discount}% discount` : l.discount < 0 ? `${Math.abs(l.discount)}% premium` : "At par"}
                        </p>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <Link className="btn btn-outline btn-sm" style={{ flex: 1, textAlign: "center" }} to={`/invoice/${tokenId}`}>
                            Details
                          </Link>
                          {mine ? (
                            <button
                              className="btn btn-sm"
                              style={{ flex: 1, border: "1px solid #B91C1C", color: "#B91C1C", background: "white" }}
                              disabled={busyListingId === l.id}
                              onClick={() => handleCancel(l)}
                            >
                              {busyListingId === l.id ? "Cancelling..." : "Cancel"}
                            </button>
                          ) : (
                            <button className="btn btn-gold btn-sm" style={{ flex: 1 }} disabled={busyListingId === l.id || owned} onClick={() => handleBuy(l)}>
                              {owned ? "Already Holding" : busyListingId === l.id ? "Buying..." : "Buy"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageBackground>
  );
}
