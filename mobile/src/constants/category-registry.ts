export type SharedCategoryMeta = { key: string; label: string; iconKey: string; color: string; tint: string };

export const CATEGORY_DEFINITIONS: Record<string, SharedCategoryMeta> = {
  food: { key: 'food', label: 'Food', iconKey: 'utensils', color: '#E8775D', tint: '#FBE3DC' },
  groceries: { key: 'groceries', label: 'Groceries', iconKey: 'shopping-basket', color: '#5B9B73', tint: '#E3F2E8' },
  transport: { key: 'transport', label: 'Transport', iconKey: 'car', color: '#5D8FC4', tint: '#E2EFFB' },
  subscriptions: { key: 'subscriptions', label: 'Subscriptions', iconKey: 'repeat', color: '#6FBF9A', tint: '#E1F4EA' },
  rent: { key: 'rent', label: 'Rent', iconKey: 'house', color: '#C98228', tint: '#FFF0D8' },
  water: { key: 'water', label: 'Water', iconKey: 'droplet', color: '#8D70AD', tint: '#EEE6F7' },
  electricity: { key: 'electricity', label: 'Electricity', iconKey: 'zap', color: '#D8A21B', tint: '#FFF5C9' },
  internet: { key: 'internet', label: 'Internet', iconKey: 'wifi', color: '#2D9C95', tint: '#DDF3F0' },
  healthcare: { key: 'healthcare', label: 'Healthcare', iconKey: 'heart-pulse', color: '#D96C80', tint: '#FBE3E8' },
  education: { key: 'education', label: 'Education', iconKey: 'graduation-cap', color: '#6675C7', tint: '#E8EAFF' },
  entertainment: { key: 'entertainment', label: 'Entertainment', iconKey: 'gamepad-2', color: '#9B6BD6', tint: '#F0E6FF' },
  shopping: { key: 'shopping', label: 'Shopping', iconKey: 'shopping-bag', color: '#C95C9D', tint: '#F9E4F1' },
  travel: { key: 'travel', label: 'Travel', iconKey: 'plane', color: '#55A7D9', tint: '#E2F2FB' },
  insurance: { key: 'insurance', label: 'Insurance', iconKey: 'shield', color: '#60758A', tint: '#E7EDF2' },
  'personal-care': { key: 'personal-care', label: 'Personal Care', iconKey: 'sparkles', color: '#D77C9E', tint: '#FAE6EF' },
  gifts: { key: 'gifts', label: 'Gifts', iconKey: 'gift', color: '#A66BB8', tint: '#F0E5F5' },
  pets: { key: 'pets', label: 'Pets', iconKey: 'paw-print', color: '#B5784C', tint: '#F4E7DC' },
  other: { key: 'other', label: 'Other', iconKey: 'tag', color: '#8B8B8B', tint: '#ECECEC' },
  bills: { key: 'bills', label: 'Bills', iconKey: 'credit-card', color: '#60758A', tint: '#E7EDF2' },
};

export const CATEGORY_ALIASES: Record<string, string> = {
  transportation: 'transport', subscription: 'subscriptions', housing: 'rent', 'housing-rent': 'rent',
  utilities: 'electricity', utility: 'electricity', 'mobile-phone': 'internet', 'mobile-phone-internet': 'internet',
  'gifts-donations': 'gifts', 'personal-care': 'personal-care', custom: 'other', 'other-custom': 'other',
  'financial-other': 'other', 'debt-loan': 'other',
};

export function normalizeCategoryKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getSharedCategoryMeta(value: string | null | undefined): SharedCategoryMeta | undefined {
  const normalized = normalizeCategoryKey(value);
  return CATEGORY_DEFINITIONS[CATEGORY_ALIASES[normalized] ?? normalized];
}
