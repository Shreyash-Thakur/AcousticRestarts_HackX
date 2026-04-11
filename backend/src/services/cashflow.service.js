export const simulateCashflow = (amount, dueDate) => {
  try {
    const invoiceAmount = Number(amount) || 0;
    const dueTime = new Date(dueDate).getTime();
    const now = Date.now();

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysToDue = Number.isFinite(dueTime)
      ? Math.max(0, Math.ceil((dueTime - now) / msPerDay))
      : 0;

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
  } catch (_error) {
    return {
      currentCash: 0,
      beforePayment: { cash: 0, waitingDays: 0 },
      afterEarlyFunding: { cash: 0, availableImmediately: 0 },
      benefit: { liquidityGain: 0, daysSaved: 0 },
    };
  }
};
