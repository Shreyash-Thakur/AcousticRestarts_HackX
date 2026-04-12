import {
  getAllListings,
  getNextListingId,
  addListing,
  updateListing,
  findListing,
} from "../../data/listings.js";
import { getBackendWalletAddress, transferEscrowedPositionOnChain } from "../services/blockchain.service.js";

export function getListingConfig(_req, res) {
  res.json({
    escrowWallet: getBackendWalletAddress(),
    automatedTransfer: true,
  });
}

export function createListing(req, res) {
  const { tokenId, sellerWallet, amount, askingPrice, escrowed, escrowTxHash } = req.body;

  if (!tokenId || !sellerWallet || !amount || !askingPrice) {
    return res.status(400).json({ message: "tokenId, sellerWallet, amount, askingPrice are required" });
  }
  if (Number(amount) <= 0 || Number(askingPrice) <= 0) {
    return res.status(400).json({ message: "amount and askingPrice must be positive" });
  }
  if (!escrowed || !escrowTxHash) {
    return res.status(400).json({ message: "Escrow transfer is required before listing" });
  }

  const existing = findListing(
    (l) =>
      l.tokenId === String(tokenId) &&
      l.sellerWallet.toLowerCase() === sellerWallet.toLowerCase() &&
      l.status === "active"
  );
  if (existing) {
    return res.status(409).json({ message: "You already have an active listing for this invoice" });
  }

  const listing = addListing({
    id: getNextListingId(),
    tokenId: String(tokenId),
    sellerWallet,
    amount: Number(amount),
    askingPrice: Number(askingPrice),
    discount: Math.round((1 - Number(askingPrice) / Number(amount)) * 100),
    status: "active",
    createdAt: new Date().toISOString(),
    buyerWallet: null,
    soldAt: null,
    escrowed: true,
    escrowTxHash,
    positionTransferTxHash: null,
  });

  res.status(201).json(listing);
}

export function getListings(req, res) {
  const { tokenId } = req.query;
  let result = getAllListings().filter((l) => l.status === "active");
  if (tokenId) result = result.filter((l) => l.tokenId === String(tokenId));
  res.json(result);
}

export async function buyListing(req, res) {
  const { id } = req.params;
  const { buyerWallet, txHash } = req.body;

  if (!buyerWallet) {
    return res.status(400).json({ message: "buyerWallet is required" });
  }

  const listing = findListing((l) => l.id === Number(id));
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  if (listing.status !== "active") return res.status(409).json({ message: "Listing is no longer active" });
  if (listing.sellerWallet.toLowerCase() === buyerWallet.toLowerCase()) {
    return res.status(400).json({ message: "Cannot buy your own listing" });
  }

  let positionTransferTxHash = null;
  if (listing.escrowed) {
    const transferResult = await transferEscrowedPositionOnChain({
      tokenId: listing.tokenId,
      toWallet: buyerWallet,
      amount: listing.amount,
    });
    if (!transferResult.success) {
      return res.status(400).json({
        message: "Payment recorded but automated position transfer failed",
        reason: transferResult.reason,
      });
    }
    positionTransferTxHash = transferResult.txHash;
  }

  const updated = updateListing(id, {
    status: "sold",
    buyerWallet,
    txHash: txHash || null,
    soldAt: new Date().toISOString(),
    autoTransferred: Boolean(listing.escrowed),
    positionTransferTxHash,
  });

  res.json(updated);
}

export async function cancelListing(req, res) {
  const { id } = req.params;
  const sellerWallet = req.query.sellerWallet || req.body?.sellerWallet;

  const listing = findListing((l) => l.id === Number(id));
  if (!listing) return res.status(404).json({ message: "Listing not found" });
  if (listing.status !== "active") return res.status(409).json({ message: "Listing is no longer active" });
  if (!sellerWallet || listing.sellerWallet.toLowerCase() !== sellerWallet.toLowerCase()) {
    return res.status(403).json({ message: "Only the seller can cancel" });
  }

  if (listing.escrowed) {
    const returnResult = await transferEscrowedPositionOnChain({
      tokenId: listing.tokenId,
      toWallet: sellerWallet,
      amount: listing.amount,
    });
    if (!returnResult.success) {
      return res.status(400).json({
        message: "Failed to return escrowed position to seller",
        reason: returnResult.reason,
      });
    }
  }

  const updated = updateListing(id, { status: "cancelled" });
  res.json({ message: "Listing cancelled", listing: updated });
}
