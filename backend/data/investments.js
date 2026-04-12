import { readDb, writeDb } from "./db.js";

const DB = "investments";

export const getAllInvestments = () => readDb(DB);

export const getInvestmentsByToken = (tokenId) => {
  const parsedTokenId = Number(tokenId);
  return getAllInvestments().filter((r) => Number(r.tokenId) === parsedTokenId);
};

export const getInvestmentsByWallet = (wallet) => {
  const key = String(wallet || "").toLowerCase();
  return getAllInvestments().filter((r) => String(r.investorWallet || "").toLowerCase() === key);
};

export const setInvestmentPosition = ({ tokenId, investorWallet, amount, txHash }) => {
  const parsedTokenId = Number(tokenId);
  const wallet = String(investorWallet || "").toLowerCase();
  const numericAmount = Number(amount) || 0;
  if (!parsedTokenId || !wallet) return null;

  const rows = getAllInvestments();
  const existing = rows.find(
    (r) => Number(r.tokenId) === parsedTokenId && String(r.investorWallet || "").toLowerCase() === wallet
  );

  if (existing) {
    existing.amount = numericAmount;
    existing.lastTxHash = txHash || existing.lastTxHash || null;
    existing.updatedAt = new Date().toISOString();
  } else {
    rows.push({
      tokenId: parsedTokenId,
      investorWallet: wallet,
      amount: numericAmount,
      lastTxHash: txHash || null,
      updatedAt: new Date().toISOString(),
    });
  }

  writeDb(DB, rows);
  return { tokenId: parsedTokenId, investorWallet: wallet, amount: numericAmount };
};
