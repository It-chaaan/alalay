export const WALLET_SLOT_OFFSETS = [0, -10, -20] as const;

export function walletSlotOffset(slotIndex: number) {
  return WALLET_SLOT_OFFSETS[Math.min(Math.max(slotIndex, 0), 2)];
}

export function visibleWallets<T>(wallets: readonly T[], frontIndex: number) {
  if (wallets.length === 0) return [] as T[];
  const count = Math.min(3, wallets.length);
  const start = ((frontIndex % wallets.length) + wallets.length) % wallets.length;
  return Array.from({ length: count }, (_, offset) => wallets[(start + offset) % wallets.length]);
}

export function cycleIndex(current: number, count: number, steps: number) {
  if (count === 0) return 0;
  return (((current + steps) % count) + count) % count;
}
