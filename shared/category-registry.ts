export type CategoryGroup =
  | 'everyday'
  | 'home'
  | 'transportation'
  | 'health'
  | 'education'
  | 'financial'
  | 'lifestyle'
  | 'family'
  | 'work'
  | 'other';

export type SharedCategoryMeta = {
  key: string;
  label: string;
  iconKey: string;
  color: string;
  tint: string;
  group: CategoryGroup;
  transactionTypes: Array<'expense' | 'budget' | 'bill' | 'subscription' | 'income'>;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
};

function hashCategoryKey(value: string) {
  return [...value].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  const rgb =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return `#${rgb
    .map((value) =>
      Math.round((value + match) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function categoryColor(key: string) {
  const hash = hashCategoryKey(key);
  const saturation = 0.46 + ((hash >>> 8) % 18) / 100;
  const lightness = 0.38 + ((hash >>> 16) % 14) / 100;
  return hslToHex(hash % 360, saturation, lightness);
}

function categoryTint(key: string) {
  const hash = hashCategoryKey(key);
  const saturation = 0.48 + ((hash >>> 8) % 16) / 100;
  return hslToHex(hash % 360, saturation, 0.93);
}

function category(
  key: string,
  label: string,
  iconKey: string,
  group: CategoryGroup,
  transactionTypes: SharedCategoryMeta['transactionTypes'] = ['expense', 'budget'],
  sortOrder = 0,
): SharedCategoryMeta {
  return {
    key,
    label,
    iconKey,
    group,
    color: categoryColor(key),
    tint: categoryTint(key),
    transactionTypes,
    sortOrder,
    isSystem: true,
    isActive: true,
  };
}

export const CATEGORY_DEFINITIONS: Record<string, SharedCategoryMeta> = Object.fromEntries(
  [
    category('essentials', 'Essentials', 'package', 'everyday'),
    category('food', 'Food', 'utensils', 'everyday'),
    category('groceries', 'Groceries', 'shopping-basket', 'everyday'),
    category('dining-out', 'Dining Out', 'utensils-crossed', 'everyday'),
    category('coffee-cafes', 'Coffee / Cafes', 'coffee', 'everyday'),
    category('household', 'Household', 'home', 'everyday'),
    category('clothing', 'Clothing', 'shirt', 'everyday'),
    category('shopping', 'Shopping', 'shopping-bag', 'everyday'),
    category('personal-care', 'Personal Care', 'sparkles', 'everyday'),
    category('housing-rent', 'Housing / Rent', 'house', 'home'),
    category('rent', 'Rent', 'building-2', 'home'),
    category('mortgage', 'Mortgage', 'landmark', 'home'),
    category('utilities', 'Utilities', 'utility-pole', 'home'),
    category('electricity', 'Electricity', 'zap', 'home'),
    category('water', 'Water', 'droplet', 'home'),
    category('internet', 'Internet', 'wifi', 'home'),
    category('mobile-phone', 'Mobile / Phone', 'smartphone', 'home'),
    category('home-maintenance', 'Home Maintenance', 'wrench', 'home'),
    category('furniture-appliances', 'Furniture / Appliances', 'sofa', 'home'),
    category('transport', 'Transport', 'car', 'transportation'),
    category('fuel-gas', 'Fuel / Gas', 'fuel', 'transportation'),
    category('public-transport', 'Public Transport', 'bus', 'transportation'),
    category('taxi-ride-hailing', 'Taxi / Ride Hailing', 'taxi', 'transportation'),
    category('parking', 'Parking', 'parking', 'transportation'),
    category('tolls', 'Tolls', 'road', 'transportation'),
    category('vehicle-maintenance', 'Vehicle Maintenance', 'wrench', 'transportation'),
    category('vehicle-payment', 'Vehicle Payment', 'car', 'transportation'),
    category('healthcare', 'Healthcare', 'heart-pulse', 'health'),
    category('medicine-pharmacy', 'Medicine / Pharmacy', 'pill', 'health'),
    category('doctor-medical', 'Doctor / Medical', 'stethoscope', 'health'),
    category('dental', 'Dental', 'tooth', 'health'),
    category('fitness', 'Fitness', 'dumbbell', 'health'),
    category('wellness', 'Wellness', 'activity', 'health'),
    category('education', 'Education', 'graduation-cap', 'education'),
    category('tuition', 'Tuition', 'school', 'education'),
    category('books-supplies', 'Books / Supplies', 'book-open', 'education'),
    category('courses-training', 'Courses / Training', 'presentation', 'education'),
    category('bills', 'Bills', 'receipt', 'financial'),
    category('subscriptions', 'Subscriptions', 'repeat', 'financial'),
    category('insurance', 'Insurance', 'shield', 'financial'),
    category('debt-loan', 'Debt / Loan', 'credit-card', 'financial'),
    category('bank-fees', 'Bank Fees', 'landmark', 'financial'),
    category('taxes', 'Taxes', 'file-text', 'financial'),
    category('savings', 'Savings', 'piggy-bank', 'financial'),
    category('investments', 'Investments', 'trending-up', 'financial'),
    category('financial-other', 'Financial / Other', 'hand-coins', 'financial'),
    category('lifestyle', 'Lifestyle', 'layers-2', 'lifestyle'),
    category('entertainment', 'Entertainment', 'ticket', 'lifestyle'),
    category('movies-streaming', 'Movies / Streaming', 'film', 'lifestyle'),
    category('games', 'Games', 'gamepad-2', 'lifestyle'),
    category('hobbies', 'Hobbies', 'palette', 'lifestyle'),
    category('sports', 'Sports', 'trophy', 'lifestyle'),
    category('travel', 'Travel', 'plane', 'lifestyle'),
    category('vacation', 'Vacation', 'luggage', 'lifestyle'),
    category('events', 'Events', 'calendar-days', 'lifestyle'),
    category('family', 'Family', 'users', 'family'),
    category('children', 'Children', 'baby', 'family'),
    category('pets', 'Pets', 'paw-print', 'family'),
    category('gifts', 'Gifts', 'gift', 'family'),
    category('gifts-donations', 'Gifts / Donations', 'heart-handshake', 'family'),
    category('donations-charity', 'Donations / Charity', 'heart-handshake', 'family'),
    category('work-business', 'Work / Business', 'briefcase', 'work'),
    category('office-supplies', 'Office Supplies', 'clipboard-list', 'work'),
    category('professional-services', 'Professional Services', 'briefcase-business', 'work'),
    category('other', 'Other', 'shapes', 'other'),
  ].map((item) => [item.key, item]),
);

// Subscription providers use the shared category catalog, but only this
// domain-relevant subset is offered by subscription forms.
export const SUBSCRIPTION_CATEGORY_KEYS = [
  'movies-streaming',
  'entertainment',
  'games',
  'fitness',
  'education',
  'internet',
  'mobile-phone',
  'professional-services',
  'subscriptions',
  'financial-other',
  'other',
] as const;

export const subscriptionCategoryDefinitions = SUBSCRIPTION_CATEGORY_KEYS.map(
  (key) => CATEGORY_DEFINITIONS[key],
);

export const CATEGORY_ALIASES: Record<string, string> = {
  transportation: 'transport',
  housing: 'housing-rent',
  'housing-rent': 'housing-rent',
  utility: 'utilities',
  'mobile-phone-internet': 'mobile-phone',
  gas: 'fuel-gas',
  'taxi-ride-hailing': 'taxi-ride-hailing',
  subscription: 'subscriptions',
  streaming: 'movies-streaming',
  'gifts-donations': 'gifts-donations',
  custom: 'other',
  'other-custom': 'other',
  others: 'other',
  repair: 'home-maintenance',
  repairs: 'home-maintenance',
  'credit-cards': 'debt-loan',
  essentials: 'essentials',
};

export function normalizeCategoryKey(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getSharedCategoryMeta(
  value: string | null | undefined,
): SharedCategoryMeta | undefined {
  const normalized = normalizeCategoryKey(value);
  const key = CATEGORY_ALIASES[normalized] ?? normalized;
  return CATEGORY_DEFINITIONS[key] ?? INCOME_CATEGORY_DEFINITIONS[key];
}

export function getCustomCategoryMeta(value: string | null | undefined): SharedCategoryMeta {
  const label = value?.trim() || 'Other';
  const key = normalizeCategoryKey(label) || 'other';
  return {
    key,
    label,
    iconKey: 'shapes',
    color: categoryColor(key),
    tint: categoryTint(key),
    group: 'other',
    transactionTypes: ['expense', 'budget', 'bill', 'subscription'],
    sortOrder: Number.MAX_SAFE_INTEGER,
    isSystem: false,
    isActive: true,
  };
}

export const categoryDefinitions = Object.values(CATEGORY_DEFINITIONS);
export const categoryLabels = categoryDefinitions.map((item) => item.label);

export const INCOME_CATEGORY_DEFINITIONS: Record<string, SharedCategoryMeta> = Object.fromEntries(
  [
    category('salary', 'Salary', 'briefcase', 'work'),
    category('freelance', 'Freelance', 'laptop', 'work'),
    category('business', 'Business', 'store', 'work'),
    category('remittance', 'Remittance', 'send', 'family'),
    category('allowance', 'Allowance', 'hand-coins', 'family'),
    category('bonus', 'Bonus', 'party-popper', 'work'),
    category('commission', 'Commission', 'badge-percent', 'work'),
    category('overtime', 'Overtime', 'clock-3', 'work'),
    category('tips', 'Tips', 'hand-heart', 'work'),
    category('investment-income', 'Investment Income', 'chart-no-axes-combined', 'financial'),
    category('interest', 'Interest Income', 'percent', 'financial'),
    category('dividend', 'Dividend', 'coins', 'financial'),
    category('rental-income', 'Rental Income', 'house', 'home'),
    category('government-benefit', 'Government Benefit', 'landmark', 'financial'),
    category('pension', 'Pension', 'shield-check', 'financial'),
    category('scholarship', 'Scholarship', 'graduation-cap', 'education'),
    category('gift-received', 'Gift Received', 'gift-card', 'family'),
    category('refund', 'Refund', 'undo-2', 'financial'),
    category('reimbursement', 'Reimbursement', 'receipt', 'financial'),
    category('cashback-rewards', 'Cashback / Rewards', 'award', 'financial'),
    category('sale-of-item', 'Sale of Item', 'tag', 'lifestyle'),
    category('side-hustle', 'Side Hustle', 'briefcase-business', 'work'),
    category('royalties', 'Royalties', 'music-2', 'work'),
    category('other-income', 'Other Income', 'circle-dollar-sign', 'other'),
  ].map((item) => [item.key, { ...item, transactionTypes: ['income'] }]),
);

export const incomeCategoryDefinitions = Object.values(INCOME_CATEGORY_DEFINITIONS);
export const incomeCategoryKeys = incomeCategoryDefinitions.map((item) => item.key);
