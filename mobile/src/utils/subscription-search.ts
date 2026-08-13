export type SubscriptionSearchable = {
  id: string;
  name: string;
  amount?: number | string;
  renewal_date?: string | null;
  billing_cycle?: string | null;
  category?: string | null;
  custom_category?: string | null;
  wallet_id?: string | null;
};

export type WalletLike = {
  id: string;
  name: string;
};

export function normalizeSubscriptionSearch(value: string) {
  return value.trim().toLowerCase();
}

export function filterSubscriptions<T extends SubscriptionSearchable>(subscriptions: T[], wallets: WalletLike[], query: string) {
  const cleaned = normalizeSubscriptionSearch(query);
  if (!cleaned) return [...subscriptions];

  const walletNamesById = new Map(wallets.map((wallet) => [wallet.id, wallet.name]));

  return subscriptions.filter((subscription) => {
    const searchText = [
      subscription.name,
      subscription.category,
      subscription.custom_category,
      walletNamesById.get(subscription.wallet_id ?? '') ?? '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchText.includes(cleaned);
  });
}
