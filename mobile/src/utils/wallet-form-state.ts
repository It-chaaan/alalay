export type TransferFeeWallet = {
  id: string;
  default_outgoing_transfer_fee?: number | string | null;
};

export function defaultTransferFeeForSource(
  wallets: TransferFeeWallet[],
  sourceId: string | null | undefined,
) {
  const suggestedFee = wallets.find((wallet) => wallet.id === sourceId)
    ?.default_outgoing_transfer_fee;
  return suggestedFee == null ? '0' : String(suggestedFee);
}
