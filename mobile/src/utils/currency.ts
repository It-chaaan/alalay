const pesoSymbol = '\u20B1';

export const currencySeparator = '\u00B7';

/** Display-only Philippine peso formatting; stored financial values are untouched. */
export function formatCurrency(value: unknown) {
  const normalized = typeof value === 'string'
    ? value.replace(/\u20B1/gu, '').replace(/,/gu, '').replace(/^−/u, '-').trim()
    : value;
  const amount = typeof normalized === 'number' ? normalized : Number(normalized);
  if (!Number.isFinite(amount)) return `${pesoSymbol}0`;
  const absolute = Math.abs(amount);
  const formatted = absolute.toLocaleString('en-PH', {
    minimumFractionDigits: Number.isInteger(absolute) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}${pesoSymbol}${formatted}`;
}
