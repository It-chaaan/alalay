export function formatCurrency(amount: number, showCentavos = false) {
  const hasCentavos = !Number.isInteger(amount);

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: showCentavos || hasCentavos ? 2 : 0,
    maximumFractionDigits: showCentavos || hasCentavos ? 2 : 0,
  }).format(amount);
}
