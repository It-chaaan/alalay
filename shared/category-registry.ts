export type CategoryGroup = 'everyday' | 'home' | 'transportation' | 'health' | 'education' | 'financial' | 'lifestyle' | 'family' | 'work' | 'other';

export type SharedCategoryMeta = {
  key: string;
  label: string;
  iconKey: string;
  color: string;
  tint: string;
  group: CategoryGroup;
};

const palettes: Record<CategoryGroup, Pick<SharedCategoryMeta, 'color' | 'tint'>> = {
  everyday: { color: '#5B9B73', tint: '#E3F2E8' }, home: { color: '#C98228', tint: '#FFF0D8' },
  transportation: { color: '#5D8FC4', tint: '#E2EFFB' }, health: { color: '#D96C80', tint: '#FBE3E8' },
  education: { color: '#6675C7', tint: '#E8EAFF' }, financial: { color: '#60758A', tint: '#E7EDF2' },
  lifestyle: { color: '#9B6BD6', tint: '#F0E6FF' }, family: { color: '#A66BB8', tint: '#F0E5F5' },
  work: { color: '#2D9C95', tint: '#DDF3F0' }, other: { color: '#8B8B8B', tint: '#ECECEC' },
};

function category(key: string, label: string, iconKey: string, group: CategoryGroup): SharedCategoryMeta {
  return { key, label, iconKey, group, ...palettes[group] };
}

export const CATEGORY_DEFINITIONS: Record<string, SharedCategoryMeta> = Object.fromEntries([
  category('essentials', 'Essentials', 'package', 'everyday'), category('food', 'Food', 'utensils', 'everyday'),
  category('groceries', 'Groceries', 'shopping-basket', 'everyday'), category('dining-out', 'Dining Out', 'utensils', 'everyday'),
  category('coffee-cafes', 'Coffee / Cafes', 'coffee', 'everyday'), category('household', 'Household', 'package', 'everyday'),
  category('clothing', 'Clothing', 'shirt', 'everyday'), category('shopping', 'Shopping', 'shopping-bag', 'everyday'),
  category('personal-care', 'Personal Care', 'sparkles', 'everyday'), category('housing-rent', 'Housing / Rent', 'house', 'home'),
  category('rent', 'Rent', 'house', 'home'), category('mortgage', 'Mortgage', 'house', 'home'), category('utilities', 'Utilities', 'utility-pole', 'home'),
  category('electricity', 'Electricity', 'zap', 'home'), category('water', 'Water', 'droplet', 'home'), category('internet', 'Internet', 'wifi', 'home'),
  category('mobile-phone', 'Mobile / Phone', 'smartphone', 'home'), category('home-maintenance', 'Home Maintenance', 'wrench', 'home'),
  category('furniture-appliances', 'Furniture / Appliances', 'sofa', 'home'), category('transport', 'Transport', 'car', 'transportation'),
  category('fuel-gas', 'Fuel / Gas', 'fuel', 'transportation'), category('public-transport', 'Public Transport', 'bus', 'transportation'),
  category('taxi-ride-hailing', 'Taxi / Ride Hailing', 'taxi', 'transportation'), category('parking', 'Parking', 'parking', 'transportation'),
  category('tolls', 'Tolls', 'road', 'transportation'), category('vehicle-maintenance', 'Vehicle Maintenance', 'wrench', 'transportation'),
  category('vehicle-payment', 'Vehicle Payment', 'car', 'transportation'), category('healthcare', 'Healthcare', 'heart-pulse', 'health'),
  category('medicine-pharmacy', 'Medicine / Pharmacy', 'pill', 'health'), category('doctor-medical', 'Doctor / Medical', 'stethoscope', 'health'),
  category('dental', 'Dental', 'heart-pulse', 'health'), category('fitness', 'Fitness', 'dumbbell', 'health'), category('wellness', 'Wellness', 'activity', 'health'),
  category('education', 'Education', 'graduation-cap', 'education'), category('tuition', 'Tuition', 'school', 'education'),
  category('books-supplies', 'Books / Supplies', 'book-open', 'education'), category('courses-training', 'Courses / Training', 'presentation', 'education'),
  category('bills', 'Bills', 'receipt', 'financial'), category('subscriptions', 'Subscriptions', 'repeat', 'financial'),
  category('insurance', 'Insurance', 'shield', 'financial'), category('debt-loan', 'Debt / Loan', 'credit-card', 'financial'),
  category('bank-fees', 'Bank Fees', 'landmark', 'financial'), category('taxes', 'Taxes', 'receipt', 'financial'),
  category('savings', 'Savings', 'piggy-bank', 'financial'), category('investments', 'Investments', 'trending-up', 'financial'),
  category('financial-other', 'Financial / Other', 'hand-coins', 'financial'), category('lifestyle', 'Lifestyle', 'sparkles', 'lifestyle'),
  category('entertainment', 'Entertainment', 'ticket', 'lifestyle'), category('movies-streaming', 'Movies / Streaming', 'film', 'lifestyle'),
  category('games', 'Games', 'gamepad-2', 'lifestyle'), category('hobbies', 'Hobbies', 'palette', 'lifestyle'), category('sports', 'Sports', 'trophy', 'lifestyle'),
  category('travel', 'Travel', 'plane', 'lifestyle'), category('vacation', 'Vacation', 'luggage', 'lifestyle'), category('events', 'Events', 'calendar-days', 'lifestyle'),
  category('family', 'Family', 'users', 'family'), category('children', 'Children', 'baby', 'family'), category('pets', 'Pets', 'paw-print', 'family'),
  category('gifts', 'Gifts', 'gift', 'family'), category('gifts-donations', 'Gifts / Donations', 'gift', 'family'),
  category('donations-charity', 'Donations / Charity', 'heart-handshake', 'family'), category('work-business', 'Work / Business', 'briefcase', 'work'),
  category('office-supplies', 'Office Supplies', 'clipboard-list', 'work'), category('professional-services', 'Professional Services', 'briefcase', 'work'),
  category('other', 'Other', 'shapes', 'other'),
].map((item) => [item.key, item]));

export const CATEGORY_ALIASES: Record<string, string> = {
  transportation: 'transport', housing: 'housing-rent', 'housing-rent': 'housing-rent', utility: 'utilities',
  'mobile-phone-internet': 'mobile-phone', gas: 'fuel-gas', 'taxi-ride-hailing': 'taxi-ride-hailing',
  subscription: 'subscriptions', streaming: 'movies-streaming', 'gifts-donations': 'gifts-donations', custom: 'other', 'other-custom': 'other',
};

export function normalizeCategoryKey(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function getSharedCategoryMeta(value: string | null | undefined): SharedCategoryMeta | undefined {
  const normalized = normalizeCategoryKey(value);
  return CATEGORY_DEFINITIONS[CATEGORY_ALIASES[normalized] ?? normalized];
}

export const categoryDefinitions = Object.values(CATEGORY_DEFINITIONS);
export const categoryLabels = categoryDefinitions.map((item) => item.label);
