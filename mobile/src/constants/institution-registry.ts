export type InstitutionType = 'e_wallet' | 'digital_bank' | 'bank' | 'cash' | 'other';
export type WalletAccountType = 'debit' | 'credit';

export type InstitutionDefinition = {
  id: string;
  displayName: string;
  institutionType: InstitutionType;
  defaultCurrency: 'PHP';
  supportedAccountTypes: readonly WalletAccountType[];
  brandColor: string;
  mark: string;
  aliases: readonly string[];
};

const debitAndCredit: readonly WalletAccountType[] = ['debit', 'credit'];

export const institutionRegistry: readonly InstitutionDefinition[] = [
  {
    id: 'gcash',
    displayName: 'GCash',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: [],
    brandColor: '#007DFE',
    mark: 'G',
    aliases: ['g cash'],
  },
  {
    id: 'maya',
    displayName: 'Maya',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: [],
    brandColor: '#00A878',
    mark: 'M',
    aliases: [],
  },
  {
    id: 'gotyme',
    displayName: 'GoTyme',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: [],
    brandColor: '#E65C4F',
    mark: 'GT',
    aliases: ['go tyme'],
  },
  {
    id: 'maribank',
    displayName: 'MariBank',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: ['debit'],
    brandColor: '#7A5AF8',
    mark: 'M',
    aliases: ['mari bank'],
  },
  {
    id: 'cimb_ph',
    displayName: 'CIMB Bank PH',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: ['debit'],
    brandColor: '#D94A75',
    mark: 'C',
    aliases: ['cimb', 'cimb bank'],
  },
  {
    id: 'tonik',
    displayName: 'Tonik',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: ['debit'],
    brandColor: '#3A9FBF',
    mark: 'T',
    aliases: [],
  },
  {
    id: 'bpi',
    displayName: 'BPI',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#B43F4B',
    mark: 'BPI',
    aliases: [],
  },
  {
    id: 'bdo',
    displayName: 'BDO',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#2F5DA8',
    mark: 'BDO',
    aliases: [],
  },
  {
    id: 'metrobank',
    displayName: 'Metrobank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#176B87',
    mark: 'M',
    aliases: ['metro bank'],
  },
  {
    id: 'unionbank',
    displayName: 'UnionBank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#B84D8B',
    mark: 'U',
    aliases: ['union bank'],
  },
  {
    id: 'rcbc',
    displayName: 'RCBC',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#347A58',
    mark: 'RC',
    aliases: [],
  },
  {
    id: 'landbank',
    displayName: 'Landbank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#2B7A78',
    mark: 'L',
    aliases: ['land bank'],
  },
  {
    id: 'pnb',
    displayName: 'PNB',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#7B4B94',
    mark: 'P',
    aliases: [],
  },
  {
    id: 'security_bank',
    displayName: 'Security Bank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#C65D3A',
    mark: 'SB',
    aliases: [],
  },
  {
    id: 'eastwest',
    displayName: 'EastWest Bank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#316B83',
    mark: 'EW',
    aliases: ['east west'],
  },
  {
    id: 'china_bank',
    displayName: 'China Bank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    brandColor: '#A04A4A',
    mark: 'CB',
    aliases: ['chinabank'],
  },
  {
    id: 'cash',
    displayName: 'Cash',
    institutionType: 'cash',
    defaultCurrency: 'PHP',
    supportedAccountTypes: [],
    brandColor: '#0F8A6B',
    mark: '₱',
    aliases: ['cash wallet'],
  },
];

export function institutionFor(key?: string | null) {
  return (
    institutionRegistry.find((institution) => institution.id === key) ??
    institutionRegistry.find((institution) => institution.id === 'cash')!
  );
}

export function supportsAccountType(key: string, accountType: WalletAccountType) {
  return institutionFor(key).supportedAccountTypes.includes(accountType);
}
