/** Legacy persisted values are intentionally retained for existing installations. */
export function walletBalanceVisibilityFromStoredValue(value: string | null) {
  return value !== 'hidden';
}

export function nextWalletBalanceVisibility(visible: boolean | null) {
  return visible === false;
}
