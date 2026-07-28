export function formatCurrency(amount: number, showCentavos = false) {
  const hasCentavos = !Number.isInteger(amount);

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: showCentavos || hasCentavos ? 2 : 0,
    maximumFractionDigits: showCentavos || hasCentavos ? 2 : 0,
  }).format(amount);
}

export function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parseDateOnly(value));
}

export function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parseDateOnly(value));
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(value);
  }

  return new Date(year, month - 1, day);
}
