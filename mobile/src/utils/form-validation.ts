
export type FieldErrors = Record<string, string | undefined>;
export type BillFormValues = { name: string; amount: string; date: string; category: string; customCategory?: string; walletId?: string | null };

export function validateMoney(value: string, label: string, allowZero = false) {
  const trimmed = value.trim();
  if (!trimmed) return `Enter a ${label}.`;
  if (/^-/.test(trimmed)) return `${label[0].toUpperCase()}${label.slice(1)} cannot be negative.`;
  const normalized = trimmed.replace(/,/g, '');
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized) || !Number.isFinite(Number(normalized))) return `Enter a valid ${label}.`;
  if (!allowZero && Number(trimmed.replace(/,/g, '')) === 0) return `${label[0].toUpperCase()}${label.slice(1)} must be greater than zero.`;
  return undefined;
}

export function validateBillForm(values: BillFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  if (!name) errors.name = values.name ? 'Enter a valid biller name.' : 'Enter a biller name.';
  const amountError = validateMoney(values.amount, 'bill amount');
  if (amountError) errors.amount = amountError;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) errors.date = 'Select a valid due date.';
  if (!values.category.trim()) errors.category = 'Select a bill category.';
  if (values.category === 'Other' && !values.customCategory?.trim()) errors.customCategory = 'Specify a bill category.';
  if (!values.walletId) errors.wallet = 'Select a wallet.';
  return errors;
}
