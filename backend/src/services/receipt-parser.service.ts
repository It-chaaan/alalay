export type ReceiptLineItem = { description: string; amount: number };
export type ParsedReceipt = {
  merchant: string | null;
  total: number | null;
  currency: string | null;
  date: string | null;
  lineItems: ReceiptLineItem[];
  suggestedCategory: string | null;
};

const money = /(?:₱|PHP\s*|P\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)/i;
const ignoredMerchant = /\b(receipt|invoice|official|date|cashier|terminal|tax|vat|tel(?:ephone)?|branch)\b/i;
const totalLabel = /\b(grand\s+total|amount\s+due|total\s+due|net\s+total|total)\b/i;
const excludedTotal = /\b(subtotal|tax|vat|cash|tendered|change|discount)\b/i;

function amountFrom(value: string) {
  const match = value.match(money);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function dateFrom(lines: string[]) {
  for (const line of lines) {
    const iso = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const dmy = line.match(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/);
    if (dmy && (Number(dmy[1]) > 12 || Number(dmy[2]) > 12)) {
      const dayFirst = Number(dmy[1]) > 12;
      return `${dmy[3]}-${(dayFirst ? dmy[2] : dmy[1]).padStart(2, "0")}-${(dayFirst ? dmy[1] : dmy[2]).padStart(2, "0")}`;
    }
  }
  return null;
}

function suggestedCategory(text: string) {
  if (/\b(pharmacy|drugstore|medicine|medical)\b/i.test(text)) return "Medicine / Pharmacy";
  if (/\b(supermarket|grocery|groceries|market)\b/i.test(text)) return "Groceries";
  if (/\b(restaurant|cafe|coffee|bistro|diner)\b/i.test(text)) return "Dining Out";
  if (/\b(gasoline|fuel|petron|shell|caltex)\b/i.test(text)) return "Fuel / Gas";
  if (/\b(transport|taxi|grab)\b/i.test(text)) return "Transport";
  return null;
}

/** Best-effort parsing only. Null signals review is required; no financial value is invented. */
export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 500);
  const totalLine = lines.find((line) => totalLabel.test(line) && !excludedTotal.test(line));
  const merchant = lines.find((line) => /[A-Za-z]/.test(line) && !ignoredMerchant.test(line) && !/^\d/.test(line) && line.length <= 100) ?? null;
  const lineItems = lines.flatMap((line) => {
    if (/\b(total|subtotal|tax|vat|cash|tendered|change|discount|receipt|invoice)\b/i.test(line)) return [];
    const match = line.match(/^(.+?)\s+(?:₱|PHP|P\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)$/i);
    const amount = match ? Number(match[2].replace(/,/g, "")) : NaN;
    return match && /[A-Za-z]/.test(match[1]) && Number.isFinite(amount) && amount > 0 ? [{ description: match[1].trim(), amount }] : [];
  }).slice(0, 50);
  return {
    merchant,
    total: totalLine ? amountFrom(totalLine) : null,
    currency: /₱|\bPHP\b/i.test(rawText) ? "PHP" : null,
    date: dateFrom(lines),
    lineItems,
    suggestedCategory: suggestedCategory(rawText),
  };
}
