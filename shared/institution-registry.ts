export type InstitutionType = 'e_wallet' | 'digital_bank' | 'bank' | 'cash' | 'other';
export type WalletAccountType = 'debit' | 'credit';
export type WalletPurpose = 'everyday' | 'savings';
export type InterestCreditFrequency = 'monthly' | 'quarterly' | 'semi_annually' | 'annually' | 'unspecified';
export type InstitutionDefinition = {
  id: string; displayName: string; institutionType: InstitutionType; defaultCurrency: 'PHP';
  supportedAccountTypes: readonly WalletAccountType[]; supportsAccountPurpose: boolean; supportsInterest: boolean;
  brandColor: string; mark: string; aliases: readonly string[];
};
const debitAndCredit: readonly WalletAccountType[] = ['debit', 'credit'];
const noAccountClassification: readonly WalletAccountType[] = [];
const classifiedAccountCapabilities = { supportsAccountPurpose: true, supportsInterest: true } as const;
const unclassifiedAccountCapabilities = { supportsAccountPurpose: false, supportsInterest: false } as const;

// Canonical institution metadata used by mobile and web. IDs are stable database values.
export const institutionRegistry: readonly InstitutionDefinition[] = [
  { id: 'gcash', displayName: 'GCash', institutionType: 'e_wallet', defaultCurrency: 'PHP', supportedAccountTypes: noAccountClassification, ...unclassifiedAccountCapabilities, brandColor: '#007DFE', mark: 'G', aliases: ['g cash'] },
  { id: 'maya', displayName: 'Maya', institutionType: 'e_wallet', defaultCurrency: 'PHP', supportedAccountTypes: noAccountClassification, ...unclassifiedAccountCapabilities, brandColor: '#00A878', mark: 'M', aliases: [] },
  { id: 'gotyme', displayName: 'GoTyme', institutionType: 'digital_bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#F58220', mark: 'GT', aliases: ['go tyme'] },
  { id: 'maribank', displayName: 'MariBank', institutionType: 'digital_bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#FF6B00', mark: 'M', aliases: ['mari bank'] },
  { id: 'cimb_ph', displayName: 'CIMB Bank PH', institutionType: 'digital_bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#D94A75', mark: 'C', aliases: ['cimb', 'cimb bank'] },
  { id: 'tonik', displayName: 'Tonik', institutionType: 'digital_bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#3A9FBF', mark: 'T', aliases: [] },
  { id: 'bpi', displayName: 'BPI', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#B43F4B', mark: 'BPI', aliases: [] },
  { id: 'bdo', displayName: 'BDO', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#2F5DA8', mark: 'BDO', aliases: [] },
  { id: 'metrobank', displayName: 'Metrobank', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#176B87', mark: 'M', aliases: ['metro bank'] },
  { id: 'unionbank', displayName: 'UnionBank', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#B84D8B', mark: 'U', aliases: ['union bank'] },
  { id: 'rcbc', displayName: 'RCBC', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#347A58', mark: 'RC', aliases: [] },
  { id: 'landbank', displayName: 'Landbank', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#2B7A78', mark: 'L', aliases: ['land bank'] },
  { id: 'pnb', displayName: 'PNB', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#7B4B94', mark: 'P', aliases: [] },
  { id: 'security_bank', displayName: 'Security Bank', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#C65D3A', mark: 'SB', aliases: [] },
  { id: 'eastwest', displayName: 'EastWest Bank', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#316B83', mark: 'EW', aliases: ['east west'] },
  { id: 'china_bank', displayName: 'China Bank', institutionType: 'bank', defaultCurrency: 'PHP', supportedAccountTypes: debitAndCredit, ...classifiedAccountCapabilities, brandColor: '#A04A4A', mark: 'CB', aliases: ['chinabank'] },
  { id: 'cash', displayName: 'Cash', institutionType: 'cash', defaultCurrency: 'PHP', supportedAccountTypes: noAccountClassification, ...unclassifiedAccountCapabilities, brandColor: '#0F8A6B', mark: '₱', aliases: ['cash wallet'] },
];
export function institutionFor(key?: string | null) { return institutionRegistry.find((institution) => institution.id === key) ?? institutionRegistry.find((institution) => institution.id === 'cash')!; }
export function supportsAccountType(key: string, accountType: WalletAccountType) { return institutionFor(key).supportedAccountTypes.includes(accountType); }
export function supportsAccountPurpose(key?: string | null) { return institutionFor(key).supportsAccountPurpose; }
export function supportsInterest(key?: string | null) { return institutionFor(key).supportsInterest; }
export type WalletMetadataInput = { accountType?: WalletAccountType | null; accountPurpose?: WalletPurpose | null; earnsInterest?: boolean | null; annualInterestRate?: number | null; interestCreditFrequency?: InterestCreditFrequency | null };
/** Removes unsupported or contradictory optional fields before a wallet request is sent. */
export function sanitizeWalletMetadata(key: string | null | undefined, input: WalletMetadataInput) {
  const institution = institutionFor(key);
  const accountType = input.accountType && institution.supportedAccountTypes.includes(input.accountType) ? input.accountType : null;
  const debit = accountType === 'debit';
  const accountPurpose = debit && institution.supportsAccountPurpose ? input.accountPurpose ?? 'everyday' : null;
  const earnsInterest = debit && accountPurpose === 'savings' && institution.supportsInterest && input.earnsInterest === true;
  return { account_type: accountType, account_purpose: accountPurpose, earns_interest: earnsInterest, annual_interest_rate: earnsInterest ? input.annualInterestRate ?? null : null, interest_credit_frequency: earnsInterest ? input.interestCreditFrequency ?? null : null } as const;
}
