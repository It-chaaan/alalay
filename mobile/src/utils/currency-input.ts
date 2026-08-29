export function formatCurrencyInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  const [whole = '', ...decimalParts] = normalized.split('.');
  const decimal = decimalParts.join('').slice(0, 2);
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (!whole && !decimal) return '';
  return `${grouped || '0'}${normalized.includes('.') ? `.${decimal}` : ''}`;
}

export function formatCurrencyDisplay(value: string) {
  const normalized = formatCurrencyInput(value);
  if (!normalized || normalized === '.') return '';
  const numeric = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(numeric)
    ? numeric.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : normalized;
}
