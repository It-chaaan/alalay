export type InstitutionType = 'e_wallet' | 'digital_bank' | 'bank' | 'cash' | 'other';
export type WalletAccountType = 'debit' | 'credit';
export type WalletPurpose = 'everyday' | 'savings';
export type InterestCreditFrequency =
  'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'unspecified';
export type InstitutionDefinition = {
  id: string;
  displayName: string;
  institutionType: InstitutionType;
  defaultCurrency: 'PHP';
  supportedAccountTypes: readonly WalletAccountType[];
  supportsAccountPurpose: boolean;
  supportsInterest: boolean;
  brandColor: string;
  mark: string;
  aliases: readonly string[];
};
const debitAndCredit: readonly WalletAccountType[] = ['debit', 'credit'];
const noAccountClassification: readonly WalletAccountType[] = [];
const classifiedAccountCapabilities = {
  supportsAccountPurpose: true,
  supportsInterest: true,
} as const;
const unclassifiedAccountCapabilities = {
  supportsAccountPurpose: false,
  supportsInterest: false,
} as const;

// Canonical institution metadata used by mobile and web. IDs are stable database values.
// Curated 2026-09-09 against BSP digital-bank and InstaPay participant lists,
// plus BSP commercial/thrift-bank directories. This is intentionally static.
export const institutionRegistry: readonly InstitutionDefinition[] = [
  {
    id: 'gcash',
    displayName: 'GCash',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
    brandColor: '#007DFE',
    mark: 'G',
    aliases: ['g cash'],
  },
  {
    id: 'maya',
    displayName: 'Maya Wallet',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
    brandColor: '#00A878',
    mark: 'M',
    aliases: ['maya', 'paymaya', 'maya ewallet'],
  },
  {
    id: 'grabpay',
    displayName: 'GrabPay',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
    brandColor: '#00B14F',
    mark: 'GP',
    aliases: ['grab pay'],
  },
  {
    id: 'shopeepay',
    displayName: 'ShopeePay',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
    brandColor: '#EE4D2D',
    mark: 'SP',
    aliases: ['shopee pay'],
  },
  {
    id: 'palawanpay',
    displayName: 'PalawanPay',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
    brandColor: '#4C8E37',
    mark: 'PP',
    aliases: ['palawan pay'],
  },
  {
    id: 'bayad',
    displayName: 'Bayad',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
    brandColor: '#E76F24',
    mark: 'B',
    aliases: ['bayad center', 'cis bayad'],
  },
  {
    id: 'ecebuana',
    displayName: 'eCebuana',
    institutionType: 'e_wallet',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
    brandColor: '#D62828',
    mark: 'EC',
    aliases: ['cebuana', 'cebuana lhuillier'],
  },
  {
    id: 'gotyme',
    displayName: 'GoTyme',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#F58220',
    mark: 'GT',
    aliases: ['go tyme'],
  },
  {
    id: 'maribank',
    displayName: 'MariBank',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#FF6B00',
    mark: 'M',
    aliases: ['mari bank', 'seabank', 'sea bank'],
  },
  {
    id: 'cimb_ph',
    displayName: 'CIMB Bank PH',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#D94A75',
    mark: 'C',
    aliases: ['cimb', 'cimb bank'],
  },
  {
    id: 'tonik',
    displayName: 'Tonik',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#3A9FBF',
    mark: 'T',
    aliases: [],
  },
  {
    id: 'maya_bank',
    displayName: 'Maya Bank',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#248F72',
    mark: 'MB',
    aliases: ['maya savings', 'maya bank inc'],
  },
  {
    id: 'uno_digital',
    displayName: 'UNO Digital Bank',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#6450A8',
    mark: 'UNO',
    aliases: ['uno', 'unobank'],
  },
  {
    id: 'uniondigital',
    displayName: 'UnionDigital Bank',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#CA5B3B',
    mark: 'UD',
    aliases: ['union digital'],
  },
  {
    id: 'ofbank',
    displayName: 'OFBank',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#2E8B57',
    mark: 'OF',
    aliases: ['overseas filipino bank', 'of bank'],
  },
  {
    id: 'diskartech',
    displayName: 'DiskarTech',
    institutionType: 'digital_bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#F05A28',
    mark: 'D',
    aliases: ['rcbc diskartech', 'diskar tech'],
  },
  {
    id: 'bpi',
    displayName: 'BPI',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
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
    ...classifiedAccountCapabilities,
    brandColor: '#A04A4A',
    mark: 'CB',
    aliases: ['chinabank'],
  },
  {
    id: 'aub',
    displayName: 'AUB',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#2866A3',
    mark: 'AUB',
    aliases: ['asia united bank'],
  },
  {
    id: 'bank_of_commerce',
    displayName: 'Bank of Commerce',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#1E6B89',
    mark: 'BC',
    aliases: ['bankofcommerce'],
  },
  {
    id: 'dbp',
    displayName: 'DBP',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#1B6E5A',
    mark: 'DBP',
    aliases: ['development bank of the philippines'],
  },
  {
    id: 'maybank_ph',
    displayName: 'Maybank Philippines',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#D99A00',
    mark: 'MB',
    aliases: ['maybank'],
  },
  {
    id: 'pbcom',
    displayName: 'PBCom',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#1C6B8E',
    mark: 'PB',
    aliases: ['philippine bank of communications'],
  },
  {
    id: 'psbank',
    displayName: 'PSBank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#C43F4C',
    mark: 'PS',
    aliases: ['philippine savings bank'],
  },
  {
    id: 'philippine_business_bank',
    displayName: 'Philippine Business Bank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#3B6E55',
    mark: 'PBB',
    aliases: ['pbb'],
  },
  {
    id: 'allbank',
    displayName: 'AllBank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#9E6A21',
    mark: 'AB',
    aliases: ['all bank'],
  },
  {
    id: 'china_bank_savings',
    displayName: 'China Bank Savings',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#8D5A45',
    mark: 'CBS',
    aliases: ['chinabank savings'],
  },
  {
    id: 'bpi_direct_banko',
    displayName: 'BPI Direct BanKo',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#B43F4B',
    mark: 'BK',
    aliases: ['banko', 'bpi direct banko'],
  },
  {
    id: 'ctbc_ph',
    displayName: 'CTBC Bank Philippines',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#C64256',
    mark: 'CT',
    aliases: ['ctbc'],
  },
  {
    id: 'hsbc_ph',
    displayName: 'HSBC Philippines',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#CF1B2B',
    mark: 'HSBC',
    aliases: ['hsbc'],
  },
  {
    id: 'philippine_veterans_bank',
    displayName: 'Philippine Veterans Bank',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#476C55',
    mark: 'PVB',
    aliases: ['veterans bank', 'pvb'],
  },
  {
    id: 'sterling_bank',
    displayName: 'Sterling Bank of Asia',
    institutionType: 'bank',
    defaultCurrency: 'PHP',
    supportedAccountTypes: debitAndCredit,
    ...classifiedAccountCapabilities,
    brandColor: '#697A47',
    mark: 'SBA',
    aliases: ['sterling bank'],
  },
  {
    id: 'cash',
    displayName: 'Cash',
    institutionType: 'cash',
    defaultCurrency: 'PHP',
    supportedAccountTypes: noAccountClassification,
    ...unclassifiedAccountCapabilities,
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
export function supportsAccountPurpose(key?: string | null) {
  return institutionFor(key).supportsAccountPurpose;
}
export function supportsInterest(key?: string | null) {
  return institutionFor(key).supportsInterest;
}
export type WalletMetadataInput = {
  accountType?: WalletAccountType | null;
  accountPurpose?: WalletPurpose | null;
  earnsInterest?: boolean | null;
  annualInterestRate?: number | null;
  interestCreditFrequency?: InterestCreditFrequency | null;
};
/** Removes unsupported or contradictory optional fields before a wallet request is sent. */
export function sanitizeWalletMetadata(key: string | null | undefined, input: WalletMetadataInput) {
  const institution = institutionFor(key);
  const accountType =
    input.accountType && institution.supportedAccountTypes.includes(input.accountType)
      ? input.accountType
      : null;
  const debit = accountType === 'debit';
  const accountPurpose =
    debit && institution.supportsAccountPurpose ? (input.accountPurpose ?? 'everyday') : null;
  const earnsInterest =
    debit &&
    accountPurpose === 'savings' &&
    institution.supportsInterest &&
    input.earnsInterest === true;
  return {
    account_type: accountType,
    account_purpose: accountPurpose,
    earns_interest: earnsInterest,
    annual_interest_rate: earnsInterest ? (input.annualInterestRate ?? null) : null,
    interest_credit_frequency: earnsInterest ? (input.interestCreditFrequency ?? null) : null,
  } as const;
}
