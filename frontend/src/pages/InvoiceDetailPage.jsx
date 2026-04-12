import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { fetchInvoices, createListing, fetchListingConfig, fetchListings, buyListingApi, cancelListingApi, createPaymentOrder, verifyPayment, openRazorpayCheckout, openFundingForToken as openFundingForTokenApi, fundInvoiceDirect as fundInvoiceDirectApi, fetchInvoiceChainState, syncInvestorPosition as syncInvestorPositionApi, settleInvoiceViaBackend } from "../lib/api";
import { useWeb3 } from "../context/Web3Context";
import { getFundingPool, getFundingPoolRead, formatTokenValue, parseTokenValue, txUrl } from "../lib/contracts";
import { TrustScoreRing, SubScoreBar } from "../components/TrustScoreRing";
import PageBackground from "../components/PageBackground";
import RevealOnScroll from "../components/RevealOnScroll";

/* ── Icons ── */
const ArrowLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
  </svg>
);
const ShieldIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const TagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const riskClass = (level) => `badge badge-${level.toLowerCase()}`;

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { signer, account, isConnected, isCorrectChain, connectWallet, userRole } = useWeb3();

  const [liveInvoice, setLiveInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chainFunding, setChainFunding] = useState(null); // { targetAmount, fundedAmount, fullyFunded, settled }
  const [ethBalance, setEthBalance] = useState(0);
  const [myPosition, setMyPosition] = useState(0);

  const [investAmount, setInvestAmount] = useState("");
  const [insurance, setInsurance] = useState(false);
  const [funded, setFunded] = useState(false);
  const [fundingTx, setFundingTx] = useState("");
  const [fundingLoading, setFundingLoading] = useState("");
  const ensureFundingIsOpen = async () => {
    if (!tokenId) return false;
    try {
      const fi = await getFundingPoolRead().getFundingInfo(tokenId);
      const target = formatTokenValue(fi.targetAmount);
      return target > 0;
    } catch {
      return false;
    }
  };

  // Secondary market state
  const [listForSale, setListForSale] = useState(false);
  const [listingPrice, setListingPrice] = useState("");
  const [listingLoading, setListingLoading] = useState("");
  const [myListing, setMyListing] = useState(null); // active listing by this user
  const [otherListings, setOtherListings] = useState([]); // listings by others
  const [buyingId, setBuyingId] = useState(null);

  // Fetch invoice from API
  useEffect(() => {
    setLoading(true);
    setLiveInvoice(null);
    fetchInvoices()
      .then((data) => {
        const arr = Array.isArray(data) ? data : [];
        const found = arr.find((inv) => String(inv.tokenId || inv.id) === id);
        if (found) {
          setLiveInvoice({
            id: String(found.tokenId || found.id),
            business: found.businessName || found.business || "",
            invoiceNumber: found.irn || `INV-${String(found.id).padStart(3, "0")}`,
            clientName: found.clientName || "",
            amount: Number(found.amount) || 0,
            faceAmount: Number(found.faceAmount || found.amount) || 0,
            discountedAmount: Number(found.discountedAmount || found.amount) || 0,
            discountRate: Number(found.discountRate) || 0,
            fundedAmount: Number(found.fundedAmount) || 0,
            fundedPercent: found.amount > 0 ? Math.round((Number(found.fundedAmount) / Number(found.amount)) * 100) : 0,
            trustScore: found.riskScore ?? 75,
            riskLevel: found.riskLevel || "Medium",
            yield: found.returnRate || 10,
            daysRemaining: found.dueDate ? Math.max(0, Math.ceil((new Date(found.dueDate) - Date.now()) / 86400000)) : 30,
            dueDate: found.dueDate ? new Date(found.dueDate).toLocaleDateString("en-CA") : "",
            issuedDate: found.createdAt ? new Date(found.createdAt).toLocaleDateString("en-CA") : new Date().toLocaleDateString("en-CA"),
            status: "funding",
            description: `Invoice from ${found.businessName || "SME"} to ${found.clientName || "client"}`,
            subScores: { paymentReliability: (found.riskScore ?? 75) + 4, invoiceLegitimacy: (found.riskScore ?? 75) + 1, businessProfile: (found.riskScore ?? 75) - 5 },
            funders: [],
            insuranceAvailable: true,
            tokenId: found.tokenId || null,
            mintTxHash: found.mintTxHash || null,
            smeWallet: found.smeWallet || null,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const invoice = liveInvoice;
  const tokenId = liveInvoice?.tokenId || null;

  const [funders, setFunders] = useState([]);

  const refreshChainState = async () => {
    if (!tokenId) return;
    try {
      const snapshot = await fetchInvoiceChainState(tokenId, account);
      const target = Number(snapshot?.targetAmount) || 0;
      if (target > 0) {
        setChainFunding({
          targetAmount: target,
          fundedAmount: Number(snapshot?.fundedAmount) || 0,
          fullyFunded: Boolean(snapshot?.fullyFunded),
          settled: Boolean(snapshot?.settled),
        });
      } else {
        setChainFunding(null);
      }
      setFunders(Array.isArray(snapshot?.funders) ? snapshot.funders : []);
      if (Number.isFinite(snapshot?.myPosition)) {
        setMyPosition(Number(snapshot.myPosition));
      }
    } catch (e) {
      console.error("refreshChainState error:", e);
    }
  };

  // Fetch unified chain state from backend.
  useEffect(() => {
    refreshChainState();
    if (!tokenId) return;
    const intervalId = setInterval(() => {
      refreshChainState();
    }, 5000);
    return () => clearInterval(intervalId);
  }, [tokenId, account]);

  useEffect(() => {
    if (!account) return;
    // Fetch native ETH balance
    import("ethers").then(({ ethers }) => {
      const provider = new ethers.BrowserProvider(window.ethereum);
      provider.getBalance(account).then((b) => setEthBalance(Number(ethers.formatEther(b)))).catch(() => {});
    });
  }, [account, tokenId]);

  // Fetch secondary market listings for this token
  const refreshListings = async () => {
    if (!tokenId) return;
    try {
      const all = await fetchListings(tokenId);
      if (account) {
        const mine = all.find((l) => l.sellerWallet.toLowerCase() === account.toLowerCase());
        setMyListing(mine || null);
        if (mine) setListForSale(true);
        setOtherListings(all.filter((l) => l.sellerWallet.toLowerCase() !== account.toLowerCase()));
      } else {
        setMyListing(null);
        setOtherListings(all);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { refreshListings(); }, [tokenId, account]);

  // Overwrite fundedAmount/fundedPercent from chain if available
  const hasOpenedChainFunding = Boolean(chainFunding && chainFunding.targetAmount > 0);
  const realFundedAmount = hasOpenedChainFunding ? chainFunding.fundedAmount : (invoice?.fundedAmount ?? 0);
  const realAmount = hasOpenedChainFunding ? chainFunding.targetAmount : (invoice?.amount ?? 0);
  const realFundedPercent = realAmount > 0 ? Math.round((realFundedAmount / realAmount) * 100) : 0;

  /* ── Fund on-chain ── */
  const handleFund = async () => {
    if (!isConnected) { connectWallet(); return; }
    if (selfInvestBlocked) {
      alert(userRole === "sme" ? "SME accounts cannot invest in invoices from this page." : "You cannot invest in your own active listing.");
      return;
    }
    if (!isCorrectChain) { alert("Please switch to Base Sepolia network."); return; }
    if (!tokenId) { alert("This invoice is not yet minted on-chain."); return; }

    try {
      const net = await signer?.provider?.getNetwork?.();
      if (Number(net?.chainId) !== 84532) {
        alert("Wallet is not on Base Sepolia. Please switch network and try again.");
        return;
      }
    } catch {
      alert("Unable to verify wallet network. Please reconnect your wallet.");
      return;
    }

    let isOpen = await ensureFundingIsOpen();
    if (!isOpen) {
      setFundingLoading("Opening funding pool…");
      try {
        const openResult = await openFundingForTokenApi(tokenId);
        if (openResult?.healedStaleToken && openResult?.remintedTokenId) {
          setFundingLoading("");
          navigate(`/invoice/${openResult.remintedTokenId}`);
          return;
        }
        if (openResult?.success) {
          isOpen = true;
        }
      } catch (err) {
        console.warn("openFundingForTokenApi failed, continuing with invest attempt:", err?.message || err);
      }
      if (!isOpen) {
        isOpen = await ensureFundingIsOpen();
      }
      if (isOpen) {
        const fi = await getFundingPoolRead().getFundingInfo(tokenId);
        setChainFunding({
          targetAmount: formatTokenValue(fi.targetAmount),
          fundedAmount: formatTokenValue(fi.fundedAmount),
          fullyFunded: fi.fullyFunded,
          settled: fi.settled,
        });
      }
    }

    const parsedAmt = parseFloat(investAmount.replace(/,/g, "")) || 0;
    if (parsedAmt <= 0) return;

    setFundingLoading("Sending ETH…");
    try {
      const pool = getFundingPool(signer);
      const amountWei = parseTokenValue(parsedAmt);

      // Invest with ETH (payable — no approve needed)
      setFundingLoading("Confirming investment…");
      const investTx = await pool.invest(tokenId, { value: amountWei });
      const receipt = await investTx.wait();

      try {
        await syncInvestorPositionApi(tokenId, {
          investorWallet: account,
          deltaAmount: parsedAmt,
          txHash: receipt.hash,
        });
      } catch (syncErr) {
        console.warn("syncInvestorPosition failed:", syncErr?.message || syncErr);
      }

      setFundingTx(receipt.hash);
      setFunded(true);
      setFundingLoading("");

      window.dispatchEvent(new CustomEvent("investment-updated", {
        detail: { tokenId, account, txHash: receipt.hash },
      }));

      // Refresh on-chain data
      try {
        await refreshChainState();
        // Refresh ETH balance
        import("ethers").then(({ ethers }) => {
          const provider = new ethers.BrowserProvider(window.ethereum);
          provider.getBalance(account).then((b) => setEthBalance(Number(ethers.formatEther(b)))).catch(() => {});
        });
      } catch { /* ignore */ }
    } catch (err) {
      const reasonText = String(err?.reason || err?.shortMessage || err?.message || "").toLowerCase();
      const isNotOpen = reasonText.includes("not open");

      // If funding wasn't open at tx time, open it via backend and retry once.
      if (isNotOpen) {
        try {
          setFundingLoading("Opening funding pool…");
          await openFundingForTokenApi(tokenId);

          setFundingLoading("Retrying investment…");
          const pool = getFundingPool(signer);
          const amountWei = parseTokenValue(parsedAmt);
          const retryTx = await pool.invest(tokenId, { value: amountWei });
          const retryReceipt = await retryTx.wait();

          try {
            await syncInvestorPositionApi(tokenId, {
              investorWallet: account,
              deltaAmount: parsedAmt,
              txHash: retryReceipt.hash,
            });
          } catch (syncErr) {
            console.warn("syncInvestorPosition retry failed:", syncErr?.message || syncErr);
          }

          setFundingTx(retryReceipt.hash);
          setFunded(true);
          await refreshChainState();
          setFundingLoading("");
          window.dispatchEvent(new CustomEvent("investment-updated", {
            detail: { tokenId, account, txHash: retryReceipt.hash },
          }));
          return;
        } catch (retryErr) {
          // Final fallback: execute funding through backend relayer path.
          try {
            setFundingLoading("Finalizing via backend…");
            const fallback = await fundInvoiceDirectApi(tokenId, {
              amountUsd: parsedAmt,
              investorWallet: account,
            });

            const optimisticTarget = Number(invoice?.amount) || 0;
            const optimisticFunded = Math.min(optimisticTarget, (Number(realFundedAmount) || 0) + parsedAmt);
            setChainFunding({
              targetAmount: optimisticTarget,
              fundedAmount: optimisticFunded,
              fullyFunded: optimisticTarget > 0 && optimisticFunded >= optimisticTarget,
              settled: false,
            });

            setFundingTx(fallback?.investTxHash || "");
            setFunded(true);
            await refreshChainState();
            setFundingLoading("");
            window.dispatchEvent(new CustomEvent("investment-updated", {
              detail: { tokenId, account, txHash: fallback?.investTxHash || null },
            }));
            return;
          } catch (fallbackErr) {
            console.error("Funding retry failed:", retryErr);
            console.error("Backend fallback failed:", fallbackErr);
            setFundingLoading("");
            alert(fallbackErr?.message || retryErr?.reason || retryErr?.shortMessage || retryErr?.message || "Transaction failed after retries");
            return;
          }
        }
      }

      console.error("Funding failed:", err);
      setFundingLoading("");
      alert(err?.reason || err?.shortMessage || err?.message || "Transaction failed");
    }
  };

  const holdsPosition = myPosition > 0;
  const isOwnActiveListing = Boolean(
    myListing &&
    account &&
    String(myListing.sellerWallet || "").toLowerCase() === String(account).toLowerCase()
  );
  const selfInvestBlocked = userRole === "sme" || isOwnActiveListing;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sellIntent = params.get("sell") === "1";
    if (sellIntent && holdsPosition && !myListing) {
      setListForSale(true);
    }
  }, [location.search, holdsPosition, myListing]);

  /* ── Fund This Invoice via UPI (Razorpay) ── */
  const [upiLoading, setUpiLoading] = useState("");
  const [upiSuccess, setUpiSuccess] = useState(false);

  const handleFundViaUPI = async () => {
    if (selfInvestBlocked) {
      alert(userRole === "sme" ? "SME accounts cannot invest in invoices from this page." : "You cannot invest in your own active listing.");
      return;
    }
    if (!tokenId) { alert("Invoice not minted on-chain yet."); return; }

    let isOpen = await ensureFundingIsOpen();
    if (!isOpen) {
      setUpiLoading("Opening funding pool…");
      try {
        const openResult = await openFundingForTokenApi(tokenId);
        if (openResult?.healedStaleToken && openResult?.remintedTokenId) {
          setUpiLoading("");
          navigate(`/invoice/${openResult.remintedTokenId}`);
          return;
        }
        if (openResult?.success) {
          isOpen = true;
        }
      } catch (err) {
        console.warn("openFundingForTokenApi failed for UPI, continuing:", err?.message || err);
      }
      if (!isOpen) {
        isOpen = await ensureFundingIsOpen();
      }
      if (isOpen) {
        const fi = await getFundingPoolRead().getFundingInfo(tokenId);
        setChainFunding({
          targetAmount: formatTokenValue(fi.targetAmount),
          fundedAmount: formatTokenValue(fi.fundedAmount),
          fullyFunded: fi.fullyFunded,
          settled: fi.settled,
        });
      }
    }
    const parsedAmt = parseFloat(investAmount.replace(/,/g, "")) || 0;
    if (parsedAmt < 1) {
      alert("Please enter an investment amount of at least $1.");
      return;
    }
    if (remainingCapacity <= 0) {
      alert("This invoice is fully funded. No remaining capacity is available.");
      return;
    }
    if (parsedAmt > remainingCapacity) {
      alert(`You can invest up to $${remainingCapacity.toLocaleString()} on this invoice.`);
      return;
    }

    // Convert USD → INR (rough rate for demo)
    const INR_PER_USD = 83;
    const amountINR = parsedAmt * INR_PER_USD;

    setUpiLoading("Creating order…");
    try {
      const order = await createPaymentOrder({
        tokenId,
        amountINR,
        purpose: "investment",
        investorWallet: account || undefined,
      });

      setUpiLoading("Opening Razorpay…");
      const result = await openRazorpayCheckout(order, {
        description: `Invest $${parsedAmt} in Invoice #${tokenId}`,
      });

      setUpiLoading("Verifying payment…");
      await verifyPayment(result);

      setUpiSuccess(true);
      setUpiLoading("");
      setFunded(true);
      await refreshChainState();
      window.dispatchEvent(new CustomEvent("investment-updated", {
        detail: { tokenId, account, txHash: null },
      }));
    } catch (err) {
      console.error("UPI funding failed:", err);
      setUpiLoading("");
      if (err.message !== "Payment cancelled by user") {
        alert(err?.message || "UPI payment failed");
      }
    }
  };

  /* ── Settle Invoice via UPI (buyer pays fiat) ── */
  const [settleLoading, setSettleLoading] = useState("");

  const handleSettleViaUPI = async () => {
    if (!tokenId) { alert("Invoice not minted on-chain yet."); return; }
    // Buyer pays the full face value (not the discounted funding target)
    const totalAmount = invoice?.faceAmount || invoice?.amount || realAmount || 0;
    if (totalAmount <= 0) return;

    const INR_PER_USD = 83;
    const amountINR = totalAmount * INR_PER_USD;

    setSettleLoading("Creating order…");
    try {
      const order = await createPaymentOrder({
        tokenId,
        amountINR,
        purpose: "settlement",
      });

      setSettleLoading("Opening Razorpay…");
      const result = await openRazorpayCheckout(order, {
        description: `Settle Invoice #${tokenId} — ₹${Math.round(amountINR).toLocaleString()}`,
      });

      setSettleLoading("Verifying & settling on-chain…");
      const verifyResult = await verifyPayment(result);

      setSettleLoading("");
      if (verifyResult?.chainResult?.success) {
        alert("Invoice settled on-chain! Tx: " + (verifyResult.chainResult.txHash || "").slice(0, 16) + "…");
      } else if (verifyResult?.chainError) {
        alert("Payment verified but on-chain settlement failed: " + verifyResult.chainError);
      } else {
        alert("Payment verified. Settlement will be processed shortly.");
      }
      await refreshChainState();
    } catch (err) {
      console.error("Settlement failed:", err);
      setSettleLoading("");
      if (err.message !== "Payment cancelled by user") {
        alert(err?.message || "Settlement payment failed");
      }
    }
  };

  /* ── Settle Invoice via Wallet (buyer pays crypto) ── */
  const handleSettleViaWallet = async () => {
    if (!tokenId) { alert("Invoice not minted on-chain yet."); return; }
    if (!isConnected) { connectWallet(); return; }
    if (!isCorrectChain) { alert("Please switch to Base Sepolia network."); return; }

    setSettleLoading("Settling on-chain…");
    try {
      const result = await settleInvoiceViaBackend(tokenId);
      setSettleLoading("");
      if (result.success) {
        alert("Invoice settled on-chain! Tx: " + (result.txHash || "").slice(0, 16) + "…");
      } else {
        alert("Settlement failed: " + (result.reason || "Unknown error"));
      }
      await refreshChainState();
    } catch (err) {
      console.error("Wallet settlement failed:", err);
      setSettleLoading("");
      alert(err?.message || "Settlement failed");
    }
  };

  /* ── List position for sale ── */
  const handleListForSale = async () => {
    if (!isConnected) { connectWallet(); return; }
    if (!isCorrectChain) { alert("Please switch to Base Sepolia network."); return; }
    if (!tokenId) return;

    const price = parseFloat(listingPrice.replace(/,/g, "")) || 0;
    if (price <= 0) { alert("Enter a valid asking price."); return; }

    setListingLoading("Escrowing position…");
    try {
      const cfg = await fetchListingConfig();
      const escrowWallet = cfg?.escrowWallet;
      if (!escrowWallet) {
        throw new Error("Escrow wallet is not configured");
      }

      const pool = getFundingPool(signer);
      const transferAmount = parseTokenValue(myPosition);
      const escrowTx = await pool.transferInvestment(tokenId, escrowWallet, transferAmount);
      const escrowReceipt = await escrowTx.wait();

      setListingLoading("Creating listing…");
      const listing = await createListing({
        tokenId,
        sellerWallet: account,
        amount: myPosition,
        askingPrice: price,
        escrowTxHash: escrowReceipt.hash,
      });
      setMyListing(listing);
      setListForSale(true);
      setListingLoading("");
      setListingPrice("");
      await refreshChainState();
    } catch (err) {
      setListingLoading("");
      alert(err.message || "Failed to create listing");
    }
  };

  /* ── Cancel listing ── */
  const handleCancelListing = async () => {
    if (!myListing) return;
    try {
      await cancelListingApi(myListing.id, account);
      setMyListing(null);
      setListForSale(false);
      refreshListings();
    } catch (err) {
      alert(err.message || "Failed to cancel listing");
    }
  };

  /* ── Buy a listed position ── */
  const handleBuyListing = async (listing) => {
    if (!isConnected) { connectWallet(); return; }
    if (String(listing?.sellerWallet || "").toLowerCase() === String(account || "").toLowerCase()) {
      alert("This is your own listing. Use Cancel instead.");
      return;
    }
    if (!isCorrectChain) { alert("Please switch to Base Sepolia network."); return; }

    setBuyingId(listing.id);
    try {
      // Send ETH to the seller at the asking price
      const { ethers } = await import("ethers");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const senderSigner = await provider.getSigner();

      const askWei = ethers.parseUnits(String(listing.askingPrice), 6);
      const tx = await senderSigner.sendTransaction({
        to: listing.sellerWallet,
        value: askWei,
      });
      const receipt = await tx.wait();

      // Mark listing as sold on backend
      const buyRes = await buyListingApi(listing.id, { buyerWallet: account, txHash: receipt.hash });

      if (buyRes?.autoTransferred) {
        alert("Position purchased and transferred to your wallet automatically.");
      } else {
        alert("Purchase recorded. Manual transfer is still required for this legacy listing.");
      }
      refreshListings();
      await refreshChainState();

      // Refresh balances
      provider.getBalance(account).then((b) => setEthBalance(Number(ethers.formatEther(b)))).catch(() => {});
    } catch (err) {
      console.error("Buy failed:", err);
      alert(err?.reason || err?.message || "Purchase failed");
    } finally {
      setBuyingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Loading invoice…</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.1rem", color: "var(--text-muted)", marginBottom: "1rem", fontFamily: "var(--font-body)" }}>
            Invoice not found.
          </p>
          <button className="btn btn-outline" onClick={() => navigate("/marketplace")}>Back to Marketplace</button>
        </div>
      </div>
    );
  }

  const { business, invoiceNumber, amount, clientName, dueDate, issuedDate, fundedAmount, fundedPercent,
          trustScore, riskLevel, yield: yld, daysRemaining, status, description, subScores, insuranceAvailable } = invoice;

  const remaining = realAmount - realFundedAmount;
  const remainingCapacity = Math.max(0, remaining);
  const isFullyFundedOnChain = Boolean(chainFunding?.fullyFunded) || remainingCapacity <= 0;
  const isSettledOnChain = Boolean(chainFunding?.settled);
  const effectiveStatus = isSettledOnChain
    ? "settled"
    : (isFullyFundedOnChain ? "funded" : status);
  const parsedAmount = parseFloat(investAmount.replace(/,/g, "")) || 0;
  const projectedReturn = parsedAmount * (yld / 100) * (daysRemaining / 365);
  const insurancePremium = insurance ? parsedAmount * 0.015 : 0;
  const fundingLabel =
    realFundedPercent > 0 && realFundedPercent < 1
      ? `${realFundedPercent.toFixed(2)}%`
      : `${Math.round(realFundedPercent)}%`;
  const fundingProgressWidth = Math.max(0, Math.min(100, realFundedPercent > 0 && realFundedPercent < 1 ? 1 : realFundedPercent));

  const faceAmount = invoice?.faceAmount || invoice?.amount || realAmount || 0;
  const discountRate = invoice?.discountRate || 0;

  return (
    <PageBackground className="page" style={{ background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>

        {/* Back */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate("/marketplace")}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "1.75rem", padding: "0.4rem 0.5rem", color: "var(--text-muted)" }}
        >
          <ArrowLeftIcon /> Back to Marketplace
        </button>

        <div className="review-grid">

          {/* ── Left ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Invoice header */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginBottom: "0.3rem", fontFamily: "var(--font-body)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Business</p>
                  <RevealOnScroll><h1 style={{ fontSize: "1.7rem", fontWeight: 800, marginBottom: "0.2rem", fontFamily: "var(--font-head)", letterSpacing: "-0.02em" }}>{business}</h1></RevealOnScroll>
                  <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Client: {clientName}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                  <span className={`badge badge-${effectiveStatus}`}>{effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1)}</span>
                  <span className={riskClass(riskLevel)}>{riskLevel} Risk</span>
                </div>
              </div>

              <div className="divider" />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.25rem" }}>
                {[
                  ["Invoice ID", invoiceNumber],
                  ["Face Value", `$${faceAmount.toLocaleString()}`],
                  ["Funding Target", `$${realAmount.toLocaleString()}`],
                  ["Discount Rate", discountRate > 0 ? `${discountRate}%` : "—"],
                  ["Annual Yield", `${yld}%`],
                  ["Issued", issuedDate],
                  ["Due Date", dueDate],
                  ["Days Remaining", daysRemaining === 0 ? "Matured" : `${daysRemaining} days`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.2rem", fontFamily: "var(--font-body)" }}>{k}</p>
                    <p style={{ fontWeight: 700, color: "var(--text)", fontSize: "0.95rem", fontFamily: "var(--font-body)" }}>{v}</p>
                  </div>
                ))}
              </div>

              <div className="divider" />
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "var(--text-dim)", marginTop: "2px" }}><TagIcon /></span>
                <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.7, fontFamily: "var(--font-body)" }}>{description}</p>
              </div>
            </div>

            {/* Trust score */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
                <span style={{ color: "#1D4ED8" }}><ShieldIcon /></span>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", fontSize: "1rem", color: "var(--text)" }}>Trust Score Breakdown</span>
              </div>
              <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <TrustScoreRing score={trustScore} size={140} />
                  <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>Overall</p>
                </div>
                <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: "1.1rem", justifyContent: "center", paddingTop: "0.5rem" }}>
                  <SubScoreBar label="Payment Reliability" value={subScores.paymentReliability} />
                  <SubScoreBar label="Invoice Legitimacy"  value={subScores.invoiceLegitimacy} />
                  <SubScoreBar label="Business Profile"    value={subScores.businessProfile} />
                </div>
              </div>
            </div>

            {/* Funding progress */}
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>Funding Progress</span>
                <span style={{ fontFamily: "var(--font-head)", fontSize: "1.2rem", color: "#15803D", fontWeight: 700 }}>{fundingLabel}</span>
              </div>
              <div className="progress-bar" style={{ height: 10, marginBottom: "1rem" }}>
                <div className="progress-fill" style={{ width: `${fundingProgressWidth}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontFamily: "var(--font-body)" }}>
                <span style={{ color: "var(--text-muted)" }}>Raised: <strong style={{ color: "var(--text)" }}>${realFundedAmount.toLocaleString()}</strong></span>
                <span style={{ color: "var(--text-muted)" }}>Remaining: <strong style={{ color: "var(--text)" }}>${remainingCapacity.toLocaleString()}</strong></span>
                <span style={{ color: "var(--text-muted)" }}>Target: <strong style={{ color: "var(--text)" }}>${realAmount.toLocaleString()}</strong></span>
              </div>
              {chainFunding && (
                <p style={{ fontSize: "0.72rem", color: "#15803D", marginTop: "0.5rem", fontFamily: "var(--font-body)" }}>
                  ✓ Live on-chain data from Base Sepolia
                </p>
              )}
            </div>

            {/* Funders */}
            <div className="card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem" }}>
                <span style={{ color: "var(--text-dim)" }}><UsersIcon /></span>
                <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)" }}>
                  Current Funders ({funders.length})
                </span>
              </div>
              {funders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "1.5rem 0", background: "var(--surface)", borderRadius: "8px" }}>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                    No funders yet — be the first!
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {funders.map((f, i) => (
                    <div key={i} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.65rem 1rem",
                      background: "var(--surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {f.address.slice(0, 6)}…{f.address.slice(-4)}
                        {account && f.address.toLowerCase() === account.toLowerCase() && (
                          <span style={{ color: "#15803D", fontFamily: "var(--font-body)", marginLeft: "0.5rem", fontSize: "0.75rem" }}>(You)</span>
                        )}
                      </span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-body)" }}>
                        ${f.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div style={{ position: "sticky", top: "calc(var(--nav-h) + 1.5rem)", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* Investment form */}
            {effectiveStatus === "funding" && !funded && !isFullyFundedOnChain && !isSettledOnChain && (
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="card">
                <h3 style={{ fontWeight: 700, marginBottom: "1.25rem", fontSize: "1.05rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>
                  Fund This Invoice
                </h3>

                {selfInvestBlocked && (
                  <div style={{
                    padding: "0.75rem 0.9rem",
                    background: "#FEF2F2",
                    border: "1px solid rgba(185,28,28,0.2)",
                    borderRadius: "10px",
                    marginBottom: "0.9rem",
                  }}>
                    <p style={{ fontSize: "0.82rem", color: "#B91C1C", fontFamily: "var(--font-body)", margin: 0 }}>
                      {userRole === "sme"
                        ? "Funding is disabled for SME role. Switch to Investor to invest."
                        : "Funding is disabled because this invoice has your active listing."}
                    </p>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>Investment Amount (USD)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder={`Up to $${remainingCapacity.toLocaleString()}`}
                    value={investAmount}
                    onChange={(e) => setInvestAmount(e.target.value)}
                    min={100}
                    max={remainingCapacity}
                  />
                  <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.45rem", flexWrap: "wrap" }}>
                    {[500, 2000, 5000, 10000].filter(v => v <= remainingCapacity).map((v) => (
                      <button
                        key={v}
                        className="chip"
                        style={{ fontSize: "0.74rem", padding: "0.2rem 0.6rem" }}
                        onClick={() => setInvestAmount(String(v))}
                      >
                        ${v.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Insurance */}
                {insuranceAvailable && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.85rem 1rem",
                    background: insurance ? "#CCFBF1" : "var(--surface)",
                    border: `1.5px solid ${insurance ? "rgba(13,148,136,0.25)" : "var(--border)"}`,
                    borderRadius: "10px",
                    marginBottom: "1rem",
                    transition: "all 0.2s",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                      <span style={{ color: "#0D9488", marginTop: "1px" }}><ShieldIcon /></span>
                      <div>
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", lineHeight: 1.3, fontFamily: "var(--font-body)" }}>
                          Default Insurance
                        </p>
                        <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                          +1.5% premium — protected against default
                        </p>
                      </div>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)} />
                      <div className="toggle-track" />
                    </label>
                  </div>
                )}

                {/* Projected return */}
                {parsedAmount > 0 && (
                  <div style={{
                    padding: "0.9rem 1rem",
                    background: "#DCFCE7",
                    border: "1px solid rgba(21,128,61,0.2)",
                    borderRadius: "10px",
                    marginBottom: "1rem",
                  }}>
                    {[
                      ["You invest", `$${parsedAmount.toLocaleString()}`, "var(--text)"],
                      insurance && ["Insurance premium", `-$${insurancePremium.toFixed(0)}`, "#B45309"],
                    ].filter(Boolean).map(([k, v, c]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{k}</span>
                        <span style={{ fontSize: "0.88rem", fontWeight: 700, color: c, fontFamily: "var(--font-body)" }}>{v}</span>
                      </div>
                    ))}
                    <div className="divider" style={{ margin: "0.5rem 0", background: "rgba(21,128,61,0.15)" }} />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Projected return</span>
                      <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#15803D", fontFamily: "var(--font-body)" }}>
                        +${(projectedReturn - insurancePremium).toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  className="btn btn-gold"
                  style={{ width: "100%", justifyContent: "center" }}
                  disabled={selfInvestBlocked || !isConnected || !parsedAmount || parsedAmount > remainingCapacity || parsedAmount < 1 || !!fundingLoading}
                  onClick={handleFund}
                >
                  {fundingLoading || (selfInvestBlocked ? "Funding Disabled" : (!isConnected ? "Connect Wallet First" : "Fund This Invoice"))}
                </button>

                {/* Fund via UPI (Razorpay) — no wallet needed */}
                <button
                  className="btn btn-outline"
                  style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem", fontSize: "0.88rem", gap: "0.4rem" }}
                  disabled={selfInvestBlocked || !!upiLoading}
                  onClick={handleFundViaUPI}
                >
                  {upiLoading || (selfInvestBlocked ? "Funding Disabled" : "💳 Fund via UPI / Card")}
                </button>
                {isConnected && ethBalance !== null && (
                  <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", textAlign: "center", marginTop: "0.4rem", fontFamily: "var(--font-body)" }}>
                    Your ETH balance: <strong>{ethBalance.toFixed(8)} ETH</strong>
                  </p>
                )}
                <p style={{ fontSize: "0.74rem", color: "var(--text-dim)", textAlign: "center", marginTop: "0.6rem", display: "flex", alignItems: "center", gap: "0.3rem", justifyContent: "center", fontFamily: "var(--font-body)" }}>
                  <InfoIcon /> Funds held in escrow until invoice settles
                </p>
                <p style={{ fontSize: "0.7rem", color: "#78716C", textAlign: "center", marginTop: "0.35rem", fontFamily: "var(--font-body)" }}>
                  Testnet note: current contract funding uses micro-ETH sized units, so wallet balance changes can look very small.
                </p>
              </motion.div>
            )}
            {tokenId && !hasOpenedChainFunding && !isSettledOnChain && !funded && (
              <div className="card" style={{ borderColor: "rgba(180,83,9,0.2)", background: "#FFFBEB" }}>
                <h3 style={{ fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.95rem", fontFamily: "var(--font-head)", color: "#92400E" }}>
                  Funding Not Open Yet
                </h3>
                <p style={{ fontSize: "0.82rem", color: "#92400E", fontFamily: "var(--font-body)" }}>
                  This invoice is minted, but funding has not been opened on-chain yet. Please retry shortly.
                </p>
              </div>
            )}

            {isFullyFundedOnChain && !isSettledOnChain && (
              <div className="card" style={{ borderColor: "rgba(29,78,216,0.2)", background: "#EFF6FF" }}>
                <h3 style={{ fontWeight: 700, marginBottom: "0.4rem", fontSize: "0.95rem", fontFamily: "var(--font-head)", color: "#1D4ED8" }}>
                  Funding Closed
                </h3>
                <p style={{ fontSize: "0.82rem", color: "#1E3A8A", fontFamily: "var(--font-body)" }}>
                  This invoice is already fully funded on-chain. New investments (ETH or UPI/Card) are disabled.
                </p>
              </div>
            )}

            {/* Funded success */}
            {funded && (
              <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="card" style={{ textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#DCFCE7", border: "2px solid rgba(21,128,61,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem", color: "#15803D" }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontWeight: 700, marginBottom: "0.4rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>Investment confirmed!</p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontFamily: "var(--font-body)" }}>
                  Your position has been recorded on-chain.
                </p>
                {fundingTx && (
                  <a href={txUrl(fundingTx)} target="_blank" rel="noreferrer" style={{ fontSize: "0.8rem", color: "#15803D", fontFamily: "var(--font-body)" }}>
                    View on BaseScan ↗
                  </a>
                )}
                <button className="btn btn-outline btn-sm" style={{ width: "100%", marginTop: "1rem" }} onClick={() => navigate("/dashboard/investor")}>
                  View Portfolio
                </button>
              </motion.div>
            )}

            {/* Settle Invoice via UPI — for corporate buyers */}
            {chainFunding && chainFunding.fullyFunded && !chainFunding.settled && (
              <div className="card" style={{ borderColor: "rgba(180,83,9,0.2)", background: "#FFFBEB" }}>
                <h3 style={{ fontWeight: 700, marginBottom: "0.5rem", fontSize: "0.95rem", fontFamily: "var(--font-head)", color: "#92400E" }}>
                  Buyer Settlement
                </h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1rem", fontFamily: "var(--font-body)" }}>
                  This invoice is fully funded. The corporate buyer can settle the invoice by paying via UPI/Card or directly from their wallet.
                  Settlement triggers on-chain yield distribution to investors.
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(180,83,9,0.08)", borderRadius: "8px" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Settlement Amount</span>
                  <span style={{ fontWeight: 700, color: "#92400E", fontFamily: "var(--font-body)" }}>
                    ${faceAmount.toLocaleString()} (~₹{Math.round(faceAmount * 83).toLocaleString()})
                  </span>
                </div>
                <button
                  className="btn btn-outline"
                  style={{ width: "100%", justifyContent: "center", borderColor: "#D97706", color: "#92400E", gap: "0.4rem" }}
                  disabled={!!settleLoading}
                  onClick={handleSettleViaUPI}
                >
                  {settleLoading || "💳 Settle via UPI / Card"}
                </button>
                <button
                  className="btn btn-outline"
                  style={{ width: "100%", justifyContent: "center", borderColor: "#15803D", color: "#15803D", gap: "0.4rem", marginTop: "0.5rem" }}
                  disabled={!!settleLoading}
                  onClick={handleSettleViaWallet}
                >
                  {settleLoading || "🔗 Settle via Wallet"}
                </button>
                <p style={{ fontSize: "0.7rem", color: "var(--text-dim)", textAlign: "center", marginTop: "0.4rem", fontFamily: "var(--font-body)" }}>
                  Pay via UPI/Card or trigger settlement directly from your wallet
                </p>
              </div>
            )}

            {/* Holds position — secondary market */}
            {holdsPosition && !funded && (
              <div className="card" style={{ borderColor: "rgba(21,128,61,0.2)", background: "#F0FDF4" }}>
                <p style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#15803D", fontFamily: "var(--font-head)" }}>Your Position</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>Invested</span>
                  <span style={{ fontWeight: 700, fontFamily: "var(--font-body)", color: "var(--text)" }}>${myPosition.toLocaleString()}</span>
                </div>
                <div className="divider" />
                <p style={{ fontWeight: 700, marginBottom: "0.6rem", fontSize: "0.9rem", fontFamily: "var(--font-head)", color: "var(--text)" }}>Secondary Market</p>

                {/* Already listed */}
                {myListing ? (
                  <div style={{ padding: "0.75rem", background: "#DCFCE7", border: "1px solid rgba(21,128,61,0.2)", borderRadius: "8px" }}>
                    <p style={{ fontSize: "0.85rem", color: "#15803D", fontWeight: 700, fontFamily: "var(--font-body)", marginBottom: "0.4rem" }}>
                      Listed for ${myListing.askingPrice.toLocaleString()}
                    </p>
                    <p style={{ fontSize: "0.78rem", color: "#166534", fontFamily: "var(--font-body)", marginBottom: "0.5rem" }}>
                      {myListing.discount > 0 ? `${myListing.discount}% discount` : myListing.discount < 0 ? `${Math.abs(myListing.discount)}% premium` : "At par"} — other investors can now purchase your position.
                    </p>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ width: "100%", color: "#B91C1C", borderColor: "#B91C1C" }}
                      onClick={handleCancelListing}
                    >
                      Cancel Listing
                    </button>
                  </div>
                ) : listForSale ? (
                  /* Listing form */
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
                      Set your asking price for your ${myPosition.toLocaleString()} position.
                    </p>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder={String(myPosition)}
                        value={listingPrice}
                        onChange={(e) => setListingPrice(e.target.value)}
                        style={{
                          width: "100%", padding: "0.65rem 0.75rem 0.65rem 1.5rem",
                          borderRadius: "8px", border: "1px solid var(--border)",
                          fontFamily: "var(--font-body)", fontSize: "0.9rem",
                          background: "white",
                        }}
                      />
                    </div>
                    {listingPrice && parseFloat(listingPrice) > 0 && (
                      <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>
                        {parseFloat(listingPrice) < myPosition
                          ? `${Math.round((1 - parseFloat(listingPrice) / myPosition) * 100)}% discount for buyers`
                          : parseFloat(listingPrice) > myPosition
                            ? `${Math.round((parseFloat(listingPrice) / myPosition - 1) * 100)}% premium`
                            : "At par value"}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ flex: 1 }}
                        onClick={() => { setListForSale(false); setListingPrice(""); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-gold btn-sm"
                        style={{ flex: 2 }}
                        disabled={!listingPrice || parseFloat(listingPrice) <= 0 || !!listingLoading}
                        onClick={handleListForSale}
                      >
                        {listingLoading || "List for Sale"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "0.75rem", fontFamily: "var(--font-body)" }}>
                      List your position for sale before maturity.
                    </p>
                    <button className="btn btn-outline btn-sm" style={{ width: "100%" }} onClick={() => setListForSale(true)}>
                      List Position for Sale
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Available listings from other investors */}
            {otherListings.length > 0 && (
              <div className="card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <span style={{ color: "#1D4ED8" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  </span>
                  <span style={{ fontWeight: 700, fontFamily: "var(--font-head)", color: "var(--text)", fontSize: "0.95rem" }}>
                    Positions for Sale ({otherListings.length})
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {otherListings.map((l) => (
                    <div key={l.id} style={{
                      padding: "0.75rem",
                      background: "var(--surface)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {l.sellerWallet.slice(0, 6)}…{l.sellerWallet.slice(-4)}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: l.discount > 0 ? "#15803D" : "#B91C1C", fontWeight: 600, fontFamily: "var(--font-body)" }}>
                          {l.discount > 0 ? `${l.discount}% off` : l.discount < 0 ? `${Math.abs(l.discount)}% premium` : "At par"}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-dim)", fontFamily: "var(--font-body)" }}>Position: </span>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem", fontFamily: "var(--font-body)" }}>${l.amount.toLocaleString()}</span>
                          <span style={{ fontSize: "0.82rem", color: "var(--text-dim)", fontFamily: "var(--font-body)", marginLeft: "0.5rem" }}>Ask: </span>
                          <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "#15803D", fontFamily: "var(--font-body)" }}>${l.askingPrice.toLocaleString()}</span>
                        </div>
                        <button
                          className="btn btn-gold btn-sm"
                          style={{ padding: "0.35rem 1rem", fontSize: "0.8rem" }}
                          disabled={!isConnected || buyingId === l.id}
                          onClick={() => handleBuyListing(l)}
                        >
                          {buyingId === l.id ? "Buying…" : "Buy"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick stats */}
            <div className="card" style={{ background: "var(--surface)", boxShadow: "none" }}>
              <p style={{ fontSize: "0.73rem", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: "0.85rem", fontFamily: "var(--font-body)" }}>
                Quick Stats
              </p>
              {[
                ["Risk Level",   <span className={riskClass(riskLevel)}>{riskLevel}</span>],
                ["Annual Yield", <span style={{ color: "#15803D", fontWeight: 700, fontFamily: "var(--font-body)" }}>{yld}%</span>],
                ["Trust Score",  <span style={{ color: "#15803D", fontWeight: 700, fontFamily: "var(--font-body)" }}>{trustScore}/100</span>],
                ["Funders",      <span style={{ fontFamily: "var(--font-body)" }}>{funders.length}</span>],
                ["Days to Due",  <span style={{ fontFamily: "var(--font-body)" }}>{daysRemaining === 0 ? "Matured" : `${daysRemaining}d`}</span>],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>{k}</span>
                  <span style={{ fontSize: "0.88rem" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageBackground>
  );
}
