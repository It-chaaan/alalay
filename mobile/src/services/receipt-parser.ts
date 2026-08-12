import { dateKeyInManila } from './finance';
import type { MobileOcrResult } from './mobile-ocr';

export type ReceiptItem = { description: string; amount: number };
export type ReceiptCandidate = {
  merchant: string;
  total: number | null;
  currency: string;
  date: string | null;
  items: ReceiptItem[];
  rawText: string;
};

const moneyPattern = /(?:₱|PHP|P\s*)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)/i;
const amountFrom = (value: string) => {
  const match = value.match(moneyPattern);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

function normalizedLines(result: MobileOcrResult) {
  const source = result.lines.length ? result.lines.map((line) => line.text) : result.text.split(/\r?\n/);
  return source.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function parseDate(lines: string[]) {
  for (const line of lines) {
    const match = line.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    const dmy = line.match(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/);
    if (dmy) {
      const first = Number(dmy[1]); const second = Number(dmy[2]);
      // Only resolve unambiguous dates; leave 08/12/2026 for review.
      if (first > 12 || second > 12) return first > 12 ? `${dmy[3]}-${String(second).padStart(2, '0')}-${String(first).padStart(2, '0')}` : `${dmy[3]}-${String(first).padStart(2, '0')}-${String(second).padStart(2, '0')}`;
    }
  }
  return null;
}

export function parseReceipt(result: MobileOcrResult): ReceiptCandidate {
  const lines = normalizedLines(result);
  const totalLabels = /\b(grand\s+total|amount\s+due|total\s+due|net\s+total|total)\b/i;
  const excluded = /\b(subtotal|tax|vat|cash|tendered|change|discount)\b/i;
  const totalLine = lines.find((line) => totalLabels.test(line) && !excluded.test(line)) ?? lines.find((line) => /\btotal\b/i.test(line) && !excluded.test(line));
  const total = totalLine ? amountFrom(totalLine) : null;
  const merchant = lines.find((line) => !/\d/.test(line) && !/receipt|invoice|official|date|cashier|store/i.test(line)) ?? 'Receipt purchase';
  const items = lines.flatMap((line) => {
    if (/\b(total|subtotal|tax|vat|cash|tendered|change|discount|receipt|invoice)\b/i.test(line)) return [];
    const match = line.match(/^(.+?)\s+(?:₱|PHP|P\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.\d{1,2})?|[0-9]+(?:\.\d{1,2})?)$/i);
    if (!match || !/[A-Za-z]/.test(match[1])) return [];
    const amount = Number(match[2].replace(/,/g, ''));
    return Number.isFinite(amount) && amount > 0 ? [{ description: match[1].trim(), amount }] : [];
  }).slice(0, 50);
  return { merchant, total, currency: /₱|\bPHP\b/i.test(result.text) ? 'PHP' : 'PHP', date: parseDate(lines), items, rawText: result.text };
}

export function candidateDate(candidate: ReceiptCandidate) { return candidate.date ?? dateKeyInManila(); }
