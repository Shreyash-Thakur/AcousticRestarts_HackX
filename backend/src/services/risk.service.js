const hashString = (input) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const seededRandom = (seed) => {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
};

const randomInRange = (seed, min, max, decimals = 0) => {
  const value = min + seededRandom(seed) * (max - min);
  return Number(value.toFixed(decimals));
};

export const getRiskInsights = (clientName) => {
  const baseSeed = hashString(clientName.toLowerCase().trim() || "unknown-client");

  const riskScore = randomInRange(baseSeed + 11, 35, 92, 0);
  const riskLevel = riskScore <= 45 ? "Low" : riskScore <= 70 ? "Medium" : "High";
  const returnRate = randomInRange(baseSeed + 29, 7, 18, 2);

  const paymentReliability = randomInRange(baseSeed + 47, 70, 95, 0);
  const avgDelayDays = randomInRange(baseSeed + 73, 1, 28, 0);
  const reliabilityLevel =
    paymentReliability >= 88 ? "High" : paymentReliability >= 78 ? "Medium" : "Low";

  return {
    riskScore,
    riskLevel,
    returnRate,
    reliability: {
      paymentReliability,
      avgDelayDays,
      reliabilityLevel,
    },
  };
};
