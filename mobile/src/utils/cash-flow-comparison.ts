export type CashFlowComparison = {
  income: number;
  spending: number;
  scaleMax: number;
  incomeRatio: number;
  spendingRatio: number;
};

function finiteNonNegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/**
 * The Reports cash-flow labels and bars deliberately share this one model.
 * Values are kept numeric all the way to the final percentage style.
 */
export function cashFlowComparison(
  incomeValue: unknown,
  spendingValue: unknown,
): CashFlowComparison {
  const income = finiteNonNegative(incomeValue);
  const spending = finiteNonNegative(spendingValue);
  const scaleMax = Math.max(income, spending, 0);
  const ratio = (value: number) => (scaleMax > 0 ? Math.min(1, Math.max(0, value / scaleMax)) : 0);
  return { income, spending, scaleMax, incomeRatio: ratio(income), spendingRatio: ratio(spending) };
}
