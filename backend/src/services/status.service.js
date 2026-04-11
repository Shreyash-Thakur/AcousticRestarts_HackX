export const deriveInvoiceStatus = ({ amount, fundedAmount, isPaid }) => {
  const totalAmount = Number(amount) || 0;
  const funded = Number(fundedAmount) || 0;

  if (Boolean(isPaid)) {
    return "Paid";
  }

  if (funded >= totalAmount && totalAmount > 0) {
    return "Funded";
  }

  if (funded > 0 && funded < totalAmount) {
    return "Funding";
  }

  return "Pending";
};
