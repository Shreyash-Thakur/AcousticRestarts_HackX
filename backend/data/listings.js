import { readDb, writeDb } from "./db.js";

const DB = "listings";

export const getAllListings = () => readDb(DB);

export const getNextListingId = () => {
  const rows = readDb(DB);
  return rows.length > 0 ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
};

export const addListing = (listing) => {
  const rows = readDb(DB);
  rows.push(listing);
  writeDb(DB, rows);
  return listing;
};

export const updateListing = (listingId, updates) => {
  const parsedId = Number(listingId);
  const rows = readDb(DB);
  const item = rows.find((r) => r.id === parsedId);
  if (item) {
    Object.assign(item, updates);
    writeDb(DB, rows);
  }
  return item || null;
};

export const findListing = (predicate) => readDb(DB).find(predicate) || null;
