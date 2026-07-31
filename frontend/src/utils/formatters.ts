import { readAppSettings, type CurrencyCode, type DateFormat } from "../lib/appSettings";

const currencyLocales: Record<CurrencyCode, string> = {
  PHP: "en-PH",
  USD: "en-US",
  EUR: "de-DE",
  JPY: "ja-JP",
  SGD: "en-SG",
};

export function formatCurrency(amount: number, showCentavos = false, currency = readAppSettings().currency) {
  const hasCentavos = !Number.isInteger(amount);

  return new Intl.NumberFormat(currencyLocales[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "JPY" ? 0 : showCentavos || hasCentavos ? 2 : 0,
    maximumFractionDigits: currency === "JPY" ? 0 : showCentavos || hasCentavos ? 2 : 0,
  }).format(amount);
}

export function formatDateShort(value: string) {
  return formatDate(value, readAppSettings().dateFormat);
}

export function formatMonthYear(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parseDateOnly(value));
}

export function formatDate(value: string, format: DateFormat = readAppSettings().dateFormat) {
  const date = parseDateOnly(value);
  if (format === "iso") return value.slice(0, 10);
  if (format === "slash") {
    return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(value);
  }

  return new Date(year, month - 1, day);
}
