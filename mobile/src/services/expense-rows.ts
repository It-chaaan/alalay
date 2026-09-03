/** Expenses returned by the API are the canonical ledger representation.
 * Paid Bill occurrences already create one linked Expense in that ledger. */
export function canonicalExpenseRows<T extends { payment_method?: string }>(expenses: T[]) {
  return expenses.map((expense) => ({
    ...expense,
    source: 'expense' as const,
    payment_method: expense.payment_method || 'other',
  }));
}
