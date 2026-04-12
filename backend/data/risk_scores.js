import { readDb, writeDb } from "./db.js";

const DB = "risk_scores";

export const getAllRiskScores = () => readDb(DB, {});

export const getCachedRiskScore = (clientName) => {
  const scores = readDb(DB, {});
  return scores[clientName] || null;
};

export const setCachedRiskScore = (clientName, scoreData) => {
  const scores = readDb(DB, {});
  scores[clientName] = { ...scoreData, lastUpdated: new Date().toISOString() };
  writeDb(DB, scores);
  return scores[clientName];
};
