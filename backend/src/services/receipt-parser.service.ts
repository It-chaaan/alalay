export type ReceiptLineItem = {
  description: string;
  amount: number;
  confidence: number;
};

export type ExtractedField<T> = {
  value: T | null;
  confidence: number;
  sourceText?: string;
  method: 'ocr_rule';
  requiresConfirmation: boolean;
};

export type ParsedReceipt = {
  merchant: string | null;
  total: number | null;
  currency: string | null;
  date: string | null;
  lineItems: ReceiptLineItem[];
  suggestedCategory: string | null;
  extraction: {
    merchant: ExtractedField<string>;
    total: ExtractedField<number>;
    date: ExtractedField<string>;
    category: ExtractedField<string>;
    warnings: string[];
    overallConfidence: number;
  };
};

type Candidate<T> = {
  value: T;
  sourceText: string;
  score: number;
  reasons: string[];
};

const MONEY_PATTERN =
  /(?:₱|PHP\s*|P\s*)?\s*(\d{1,3}(?:[\s,]\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
const TOTAL_LABEL =
  /\b(?:order\s+total|grand\s+total|total\s+amount|amount\s+due|net\s+total|total\s+due|balance\s+due|total)\b/i;
const EXCLUDED_TOTAL_CONTEXT =
  /\b(?:sub\s*total|tax|vat|cash|tendered|change|voucher|discount|savings?|cashback|original|list\s+price|reference|tracking|order\s*(?:no|number|id)|mobile|phone|contact|customer|delivery|shipping|estimated)\b/i;
const GENERIC_MERCHANT =
  /^(?:&\s*)?(?:order\s+details|receipt|invoice|payment\s+details|delivery\s+information|shipping\s+information|support\s+center|contact\s+seller|customer\s+service|transaction\s+details)$/i;
const NON_ITEM_CONTEXT =
  /\b(?:customer|mobile|phone|contact|address|delivery|shipping|support|seller|order\s*(?:no|number|id)|reference|tracking|voucher|discount|subtotal|total|tax|cash|change)\b/i;
const DATE_LABEL =
  /\b(?:transaction\s+date|purchase\s+date|paid\s+on|order\s+placed|issued|invoice\s+date|date)\b/i;
const DELIVERY_CONTEXT =
  /\b(?:estimated|guaranteed)?\s*delivery|delivery\s+window|arriv(?:e|al)|shipping|voucher\s+valid|expir(?:y|ation)|membership\s+valid/i;
const MIN_TOTAL_SCORE = 55;

function normalizedLines(rawText: string): string[] {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isPhilippinePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return /^09\d{9}$/.test(digits) || /^639\d{9}$/.test(digits);
}

function amountsIn(value: string): number[] {
  if (isPhilippinePhone(value) || parseDate(value)) return [];
  const matches = [...value.matchAll(MONEY_PATTERN)];
  return matches
    .map((match) => Number.parseFloat(match[1].replace(/[\s,]/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0 && amount < 10_000_000);
}

function confidence(score: number, threshold: number): number {
  return Math.max(0, Math.min(1, score / threshold));
}

function choose<T>(candidates: Candidate<T>[]): Candidate<T> | null {
  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function merchantCandidates(lines: string[]): Candidate<string>[] {
  const candidates: Candidate<string>[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const cleaned = line.replace(/^[&©®|]+\s*/, '').trim();
    if (
      !cleaned ||
      GENERIC_MERCHANT.test(cleaned) ||
      !/[a-z]/i.test(cleaned) ||
      cleaned.length > 100
    )
      continue;
    if (NON_ITEM_CONTEXT.test(cleaned) || DATE_LABEL.test(cleaned)) continue;

    let score = index < 5 ? 48 : 25;
    const reasons = [index < 5 ? 'prominent header' : 'text candidate'];
    if (/\b(?:seller|sold\s+by|merchant|store|shop)\b/i.test(line)) {
      score += 28;
      reasons.push('seller label');
    }
    if (/\b(?:details|information)\b/i.test(cleaned)) score -= 35;
    candidates.push({ value: cleaned, sourceText: line, score, reasons });
  }
  return candidates;
}

function totalCandidates(lines: string[]): Candidate<number>[] {
  const candidates: Candidate<number>[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] ?? '';
    for (const [sourceText, sameLine] of [
      [line, true],
      [next, false],
    ] as const) {
      for (const value of amountsIn(sourceText)) {
        let score = 0;
        const reasons: string[] = [];
        const context = `${line} ${sourceText}`;
        if (TOTAL_LABEL.test(line)) {
          score += sameLine ? 72 : 52;
          reasons.push(
            sameLine ? 'strong total label on same line' : 'value adjacent to total label',
          );
        }
        if (/(₱|\bPHP\b|\bP\s*\d)/i.test(sourceText)) {
          score += 10;
          reasons.push('PHP currency marker');
        }
        if (index >= Math.floor(lines.length * 0.55)) {
          score += 6;
          reasons.push('lower summary area');
        }
        if (EXCLUDED_TOTAL_CONTEXT.test(context) || isPhilippinePhone(context)) {
          score -= 100;
          reasons.push('excluded contextual value');
        }
        candidates.push({ value, sourceText, score, reasons });
      }
    }
  }
  return candidates;
}

function parseDate(value: string): string | null {
  const iso = value.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const dmy = value.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : null;
}

function dateCandidate(lines: string[]): Candidate<string> | null {
  const candidates: Candidate<string>[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const date = parseDate(line);
    if (!date || DELIVERY_CONTEXT.test(line)) continue;
    const labeled = DATE_LABEL.test(line) || DATE_LABEL.test(lines[index - 1] ?? '');
    const unambiguousIsoDate = /^\d{4}[-/.]/.test(line.trim());
    candidates.push({
      value: date,
      sourceText: line,
      score: labeled ? 88 : unambiguousIsoDate ? 70 : 45,
      reasons: [
        labeled
          ? 'transaction date label'
          : unambiguousIsoDate
            ? 'unambiguous ISO date'
            : 'unlabelled numeric date',
      ],
    });
  }
  return choose(candidates);
}

function categoryFor(merchant: string | null, items: ReceiptLineItem[]): string | null {
  const text = `${merchant ?? ''} ${items.map((item) => item.description).join(' ')}`.toLowerCase();
  if (/computer|gaming|deepcool|electronics?|phone|laptop/.test(text)) return 'Shopping';
  if (/grocery|supermarket/.test(text)) return 'Groceries';
  if (/restaurant|cafe|food/.test(text)) return 'Food';
  if (/electric|water|internet|utility/.test(text)) return 'Bills';
  if (/grab|taxi|transport|fuel|gasoline/.test(text)) return 'Transport';
  return null;
}

function itemCandidates(lines: string[]): ReceiptLineItem[] {
  return lines.flatMap((line) => {
    if (NON_ITEM_CONTEXT.test(line) || isPhilippinePhone(line) || parseDate(line)) return [];
    const moneyMatches = [...line.matchAll(MONEY_PATTERN)];
    const lastMoneyMatch = moneyMatches.at(-1);
    const amount = amountsIn(lastMoneyMatch?.[0] ?? '').at(-1);
    const description =
      lastMoneyMatch?.index === undefined
        ? ''
        : line
            .slice(0, lastMoneyMatch.index)
            .replace(/[x×]\s*\d+/i, '')
            .trim();
    if (!amount || description.length < 3 || TOTAL_LABEL.test(description)) return [];
    return [{ description, amount, confidence: 0.65 }];
  });
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = normalizedLines(rawText);
  const selectedMerchant = choose(merchantCandidates(lines));
  const selectedTotal = choose(totalCandidates(lines));
  const selectedDate = dateCandidate(lines);
  const lineItems = itemCandidates(lines);
  const merchantScore = selectedMerchant?.score ?? 0;
  const totalScore = selectedTotal?.score ?? 0;
  const dateScore = selectedDate?.score ?? 0;
  const merchant = selectedMerchant?.value ?? null;
  const total = totalScore >= MIN_TOTAL_SCORE ? selectedTotal!.value : null;
  const date = dateScore >= 70 ? selectedDate!.value : null;
  const category = categoryFor(merchant, lineItems);
  const warnings: string[] = [];
  if (!merchant) warnings.push("We couldn't find the merchant. Enter it manually.");
  if (!total) warnings.push("We couldn't find a reliable total. Enter it manually.");
  if (!date) warnings.push("The purchase date wasn't shown clearly. Please select it.");

  const field = <T>(value: T | null, score: number, sourceText?: string): ExtractedField<T> => ({
    value,
    confidence: confidence(score, 90),
    ...(sourceText ? { sourceText } : {}),
    method: 'ocr_rule',
    requiresConfirmation: value === null || score < 70,
  });

  const categoryField = field(category, category ? 55 : 0);
  return {
    merchant,
    total,
    currency: total !== null ? 'PHP' : null,
    date,
    lineItems,
    suggestedCategory: category,
    extraction: {
      merchant: field(merchant, merchantScore, selectedMerchant?.sourceText),
      total: field(total, totalScore, selectedTotal?.sourceText),
      date: field(date, dateScore, selectedDate?.sourceText),
      category: categoryField,
      warnings,
      overallConfidence: Number(
        (
          (confidence(merchantScore, 90) + confidence(totalScore, 90) + confidence(dateScore, 90)) /
          3
        ).toFixed(2),
      ),
    },
  };
}
