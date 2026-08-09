export type WalletPreset = { key: string; name: string; type: 'e_wallet' | 'digital_bank' | 'bank' | 'cash' | 'other'; color: string; group: string };

export const walletPresets: WalletPreset[] = [
  { key: 'gcash', name: 'GCash', type: 'e_wallet', color: '#1976D2', group: 'E-wallets' },
  { key: 'maya', name: 'Maya', type: 'e_wallet', color: '#00A878', group: 'E-wallets' },
  { key: 'gotyme', name: 'GoTyme', type: 'e_wallet', color: '#E65C4F', group: 'E-wallets' },
  { key: 'shopeepay', name: 'ShopeePay', type: 'e_wallet', color: '#EE4D2D', group: 'E-wallets' },
  { key: 'coins_ph', name: 'Coins.ph', type: 'e_wallet', color: '#F4A62A', group: 'E-wallets' },
  { key: 'maribank', name: 'Maribank', type: 'digital_bank', color: '#7A5AF8', group: 'Digital banks' },
  { key: 'cimb_ph', name: 'CIMB Bank PH', type: 'digital_bank', color: '#D94A75', group: 'Digital banks' },
  { key: 'tonik', name: 'Tonik', type: 'digital_bank', color: '#3A9FBF', group: 'Digital banks' },
  { key: 'ing_ph', name: 'ING PH', type: 'digital_bank', color: '#F26522', group: 'Digital banks' },
  { key: 'uno_digital', name: 'UNO Digital Bank', type: 'digital_bank', color: '#3C6E71', group: 'Digital banks' },
  { key: 'bpi', name: 'BPI', type: 'bank', color: '#B43F4B', group: 'Traditional banks' },
  { key: 'bdo', name: 'BDO', type: 'bank', color: '#2F5DA8', group: 'Traditional banks' },
  { key: 'metrobank', name: 'Metrobank', type: 'bank', color: '#176B87', group: 'Traditional banks' },
  { key: 'unionbank', name: 'UnionBank', type: 'bank', color: '#B84D8B', group: 'Traditional banks' },
  { key: 'rcbc', name: 'RCBC', type: 'bank', color: '#347A58', group: 'Traditional banks' },
  { key: 'landbank', name: 'Landbank', type: 'bank', color: '#2B7A78', group: 'Traditional banks' },
  { key: 'pnb', name: 'PNB', type: 'bank', color: '#7B4B94', group: 'Traditional banks' },
  { key: 'security_bank', name: 'Security Bank', type: 'bank', color: '#C65D3A', group: 'Traditional banks' },
  { key: 'eastwest', name: 'EastWest Bank', type: 'bank', color: '#316B83', group: 'Traditional banks' },
  { key: 'china_bank', name: 'China Bank', type: 'bank', color: '#A04A4A', group: 'Traditional banks' },
  { key: 'cash', name: 'Cash', type: 'cash', color: '#0F8A6B', group: 'Cash' },
];

export function walletInitials(name: string) { return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3).toUpperCase(); }
