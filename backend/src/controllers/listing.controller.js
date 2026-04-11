// In-memory secondary market listings
const listings = [];
let nextId = 1;

/**
 * POST /api/listings
 * Body: { tokenId, sellerWallet, amount, askingPrice }
 */
export function createListing(req, res) {
  const { tokenId, sellerWallet, amount, askingPrice } = req.body;

  if (!tokenId || !sellerWallet || !amount || !askingPrice) {
    return res.status(400).json({ message: "tokenId, sellerWallet, amount, askingPrice are required" });
  }
  if (Number(amount) <= 0 || Number(askingPrice) <= 0) {
    return res.status(400).json({ message: "amount and askingPrice must be positive" });
  }

  // Check no duplicate active listing from same seller for same token
  const existing = listings.find(
    (l) => l.tokenId === String(tokenId) && l.sellerWallet.toLowerCase() === sellerWallet.toLowerCase() && l.status === "active"
  );
  if (existing) {
    return res.status(409).json({ message: "You already have an active listing for this invoice" });
  }

  const listing = {
    id: nextId++,
    tokenId: String(tokenId),
    sellerWallet,
    amount: Number(amount),
    askingPrice: Number(askingPrice),
    discount: Math.round((1 - Number(askingPrice) / Number(amount)) * 100),
    status: "active", // active | sold | cancelled
    createdAt: new Date().toISOString(),
    buyerWallet: null,
    soldAt: null,
  };

  listings.push(listing);
  res.status(201).json(listing);
}

/**
 * GET /api/listings?tokenId=X
 * Returns all active listings, optionally filtered by tokenId.
 */
export function getListings(req, res) {
  const { tokenId } = req.query;
  let result = listings.filter((l) => l.status === "active");
  if (tokenId) {
    result = result.filter((l) => l.tokenId === String(tokenId));
  }
  res.json(result);
}

/**
 * POST /api/listings/:id/buy
 * Body: { buyerWallet, txHash }
 * Marks a listing as sold.
 */
export function buyListing(req, res) {
  const { id } = req.params;
  const { buyerWallet, txHash } = req.body;

  if (!buyerWallet) {
    return res.status(400).json({ message: "buyerWallet is required" });
  }

  const listing = listings.find((l) => l.id === Number(id));
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (listing.status !== "active") {
    return res.status(409).json({ message: "Listing is no longer active" });
  }
  if (listing.sellerWallet.toLowerCase() === buyerWallet.toLowerCase()) {
    return res.status(400).json({ message: "Cannot buy your own listing" });
  }

  listing.status = "sold";
  listing.buyerWallet = buyerWallet;
  listing.txHash = txHash || null;
  listing.soldAt = new Date().toISOString();

  res.json(listing);
}

/**
 * DELETE /api/listings/:id
 * Body: { sellerWallet }
 * Cancel a listing (only the seller can cancel).
 */
export function cancelListing(req, res) {
  const { id } = req.params;
  const sellerWallet = req.query.sellerWallet || req.body?.sellerWallet;

  const listing = listings.find((l) => l.id === Number(id));
  if (!listing) {
    return res.status(404).json({ message: "Listing not found" });
  }
  if (listing.status !== "active") {
    return res.status(409).json({ message: "Listing is no longer active" });
  }
  if (!sellerWallet || listing.sellerWallet.toLowerCase() !== sellerWallet.toLowerCase()) {
    return res.status(403).json({ message: "Only the seller can cancel" });
  }

  listing.status = "cancelled";
  res.json({ message: "Listing cancelled", listing });
}
