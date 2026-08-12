export async function capabilities() {
  return {
    status: "browser_ocr_ready",
    supported_uploads: ["image/jpeg", "image/png", "application/pdf"],
    readable_fields: ["merchant", "date", "items", "total_amount", "payment_method"],
    message: "JPG and PNG receipts are scanned locally in the browser. PDF uploads can be reviewed, but image receipts work best for live OCR.",
  };
}

export async function demoReceiptScan() {
  return {
    status: "scanned",
    confidence: 97,
    merchant: "SM Hypermarket Cubao",
    date: "2025-06-28",
    time: "2:47 PM",
    cashier: "Cashier #04 - Ana R.",
    payment_method: "gcash",
    suggested_category: "Food",
    items: [
      { id: "milk", name: "Magnolia Fresh Milk 1L", quantity: 2, unit_price: 74, total: 148 },
      { id: "tuna", name: "Century Tuna (3-pack)", quantity: 1, unit_price: 99, total: 99 },
      { id: "detergent", name: "Ariel Detergent Powder 2kg", quantity: 1, unit_price: 229, total: 229 },
      { id: "shampoo", name: "Palmolive Shampoo 200ml", quantity: 1, unit_price: 89, total: 89 },
      { id: "chips", name: "Lay's Original 68g", quantity: 2, unit_price: 39, total: 78 },
      { id: "coffee", name: "Kopiko Brown Coffee 30s", quantity: 1, unit_price: 119, total: 119 },
    ],
    totals: {
      subtotal: 762,
      vat: 87,
      total: 849,
    },
  };
}

export type MobileReceiptInput = { text: string; lines: string[] };
export type MobileReceiptCandidate = {
  merchant: string;
  total: number | null;
  currency: "PHP";
  date: string | null;
  items: { description: string; amount: number }[];
};

function parseMoney(line: string) {
  const match = line.match(/(?:₱|PHP|P\s*)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function parseMobileReceipt(input: MobileReceiptInput): MobileReceiptCandidate {
  const lines = (input.lines.length ? input.lines : input.text.split(/\r?\n/)).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const excluded = /\b(subtotal|tax|vat|cash|tendered|change|discount)\b/i;
  const totalLine = lines.find((line) => /\b(grand\s+total|amount\s+due|total\s+due|net\s+total|total)\b/i.test(line) && !excluded.test(line));
  const merchant = lines.find((line) => !/\d/.test(line) && !/receipt|invoice|official|date|cashier|store/i.test(line)) ?? "Receipt purchase";
  const items = lines.flatMap((line) => {
    if (/\b(total|subtotal|tax|vat|cash|tendered|change|discount|receipt|invoice)\b/i.test(line)) return [];
    const match = line.match(/^(.+?)\s+(?:₱|PHP|P\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)$/i);
    if (!match || !/[A-Za-z]/.test(match[1])) return [];
    const amount = Number(match[2].replace(/,/g, ""));
    return Number.isFinite(amount) && amount > 0 ? [{ description: match[1].trim(), amount }] : [];
  }).slice(0, 50);
  let date: string | null = null;
  for (const line of lines) {
    const iso = line.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (iso) { date = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`; break; }
    const unambiguous = line.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
    if (unambiguous && (Number(unambiguous[1]) > 12 || Number(unambiguous[2]) > 12)) {
      const day = Number(unambiguous[1]) > 12 ? unambiguous[1] : unambiguous[2];
      const month = Number(unambiguous[1]) > 12 ? unambiguous[2] : unambiguous[1];
      date = `${unambiguous[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`; break;
    }
  }
  return { merchant, total: totalLine ? parseMoney(totalLine) : null, currency: "PHP", date, items };
}
