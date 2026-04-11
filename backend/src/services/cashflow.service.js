export const simulateCashflow = (amount, dueDate) => {
  const invoiceAmount = Number(amount);
  const dueTime = new Date(dueDate).getTime();
  const now = Date.now();

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysToDue = Math.max(0, Math.ceil((dueTime - now) / msPerDay));

  const currentCash = Number((invoiceAmount * 0.35).toFixed(2));
  const beforePayment = {
    cash: currentCash,
    waitingDays: daysToDue,
  };

  const earlyFundingRate = 0.9;
  const fundedNow = Number((invoiceAmount * earlyFundingRate).toFixed(2));
  const afterEarlyFunding = {
    cash: Number((currentCash + fundedNow).toFixed(2)),
    availableImmediately: fundedNow,
  };

  return {
    currentCash,
    beforePayment,
    afterEarlyFunding,
    benefit: {
      liquidityGain: Number((afterEarlyFunding.cash - beforePayment.cash).toFixed(2)),
      daysSaved: daysToDue,
    },
  };
};
