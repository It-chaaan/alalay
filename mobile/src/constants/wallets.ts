import { institutionRegistry, type InstitutionType } from './institution-registry';

export type WalletPreset = {
  key: string;
  name: string;
  type: InstitutionType;
  color: string;
  group: string;
  aliases: readonly string[];
};

export type WalletVisual = { mark: string; watermark: string };

export const walletVisuals: Record<string, WalletVisual> = {
  cash: { mark: 'C', watermark: '◈' },
  gcash: { mark: 'G', watermark: '◌' },
  maya: { mark: 'M', watermark: 'M' },
  gotyme: { mark: 'GT', watermark: '◫' },
  shopeepay: { mark: 'S', watermark: '◇' },
  coins_ph: { mark: '₿', watermark: '◉' },
  maribank: { mark: 'M', watermark: '◈' },
  cimb_ph: { mark: 'C', watermark: '◌' },
  tonik: { mark: 'T', watermark: '◫' },
  ing_ph: { mark: 'I', watermark: '◈' },
  uno_digital: { mark: 'U', watermark: '◉' },
  bpi: { mark: 'BPI', watermark: '◫' },
  bdo: { mark: 'BDO', watermark: '◫' },
  metrobank: { mark: 'M', watermark: '◈' },
  unionbank: { mark: 'U', watermark: '◌' },
  rcbc: { mark: 'RC', watermark: '◫' },
  landbank: { mark: 'L', watermark: '◈' },
  pnb: { mark: 'P', watermark: '◉' },
  security_bank: { mark: 'SB', watermark: '◫' },
  eastwest: { mark: 'EW', watermark: '◈' },
  china_bank: { mark: 'CB', watermark: '◌' },
  custom: { mark: 'W', watermark: '◈' },
};

export function walletVisualFor(key: string): WalletVisual {
  return walletVisuals[key] ?? walletVisuals.custom;
}

const groups: Record<InstitutionType, string> = {
  e_wallet: 'E-wallets',
  digital_bank: 'Digital and app-based banks',
  bank: 'Traditional banks',
  cash: 'Cash',
  other: 'Other',
};

export const walletPresets: WalletPreset[] = institutionRegistry.map((institution) => ({
  key: institution.id,
  name: institution.displayName,
  type: institution.institutionType,
  color: institution.brandColor,
  group: groups[institution.institutionType],
  aliases: institution.aliases,
}));

export function matchesWalletPreset(preset: WalletPreset, query: string) {
  const normalize = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
  const needle = normalize(query);
  return !needle || [preset.name, preset.key, ...preset.aliases].some((value) => normalize(value).includes(needle));
}

export function walletInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}
