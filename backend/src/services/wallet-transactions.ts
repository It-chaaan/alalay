export type WalletTransferRow = {
  id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number | string;
  fee: number | string;
  transfer_method?: string | null;
  note?: string | null;
  transferred_at: string;
  created_at?: string;
};

export function walletTransferPerspective(
  row: WalletTransferRow,
  walletId: string,
  counterpartName: string,
) {
  const outgoing = row.from_wallet_id === walletId;
  return {
    ...row,
    kind: outgoing ? 'transfer_out' : 'transfer_in',
    label: outgoing ? `Transfer to ${counterpartName}` : `Transfer from ${counterpartName}`,
    date: row.transferred_at,
    // The canonical fee is its own linked Bank Fees expense. Keeping this row
    // to principal prevents wallet history from showing the same fee twice.
    amount: (outgoing ? -1 : 1) * Number(row.amount),
  };
}
