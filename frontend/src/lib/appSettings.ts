export type CurrencyCode = 'PHP' | 'USD' | 'EUR' | 'JPY' | 'SGD';
export type DateFormat = 'short' | 'slash' | 'iso';
export type ThemeMode = 'light' | 'dark' | 'system';
export type CategoryKind = 'expense' | 'income';

export type AppCategory = {
  id: string;
  kind: CategoryKind;
  name: string;
  icon: string;
  color: string;
  order: number;
};
export type NotificationSettings = {
  billReminders: boolean;
  billReminderDays: number;
  overspendingAlerts: boolean;
  budgetThresholds: boolean;
  subscriptionReminders: boolean;
  summaries: boolean;
  savingsMilestones: boolean;
  loginAlerts: boolean;
};
export type AppSettings = {
  theme: ThemeMode;
  currency: CurrencyCode;
  dateFormat: DateFormat;
  notifications: NotificationSettings;
  categories: AppCategory[];
};

const storageKey = 'alalay-app-settings';
export const settingsChangedEvent = 'alalay-settings-changed';

const defaultCategories: AppCategory[] = [
  ...categoryDefinitions.map((item, order) => ({
    id: `expense-${item.key}`,
    name: item.label,
    icon: item.iconKey,
    color: item.color,
    kind: 'expense' as const,
    order,
  })),
  ...incomeCategoryDefinitions.map((item, order) => ({
    id: `income-${item.key}`,
    name: item.key,
    icon: item.iconKey,
    color: item.color,
    kind: 'income' as const,
    order,
  })),
];

export const defaultSettings: AppSettings = {
  theme: 'light',
  currency: 'PHP',
  dateFormat: 'short',
  notifications: {
    billReminders: true,
    billReminderDays: 3,
    overspendingAlerts: true,
    budgetThresholds: true,
    subscriptionReminders: true,
    summaries: false,
    savingsMilestones: true,
    loginAlerts: true,
  },
  categories: defaultCategories,
};

export function readAppSettings(): AppSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(storageKey) || 'null',
    ) as Partial<AppSettings> | null;
    const theme =
      stored?.theme && ['light', 'dark', 'system'].includes(stored.theme)
        ? stored.theme
        : defaultSettings.theme;
    const currency =
      stored?.currency && ['PHP', 'USD', 'EUR', 'JPY', 'SGD'].includes(stored.currency)
        ? stored.currency
        : defaultSettings.currency;
    const dateFormat =
      stored?.dateFormat && ['short', 'slash', 'iso'].includes(stored.dateFormat)
        ? stored.dateFormat
        : defaultSettings.dateFormat;
    return {
      ...defaultSettings,
      ...stored,
      theme: theme as ThemeMode,
      currency: currency as CurrencyCode,
      dateFormat: dateFormat as DateFormat,
      notifications: { ...defaultSettings.notifications, ...stored?.notifications },
      categories: stored?.categories?.length ? stored.categories : defaultSettings.categories,
    };
  } catch {
    return defaultSettings;
  }
}

export function writeAppSettings(settings: AppSettings) {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(settingsChangedEvent));
}
export function getCategories(kind?: CategoryKind) {
  const stored = readAppSettings().categories.filter((category) => !kind || category.kind === kind);
  if (kind === 'income') {
    const knownNames = new Set(
      defaultCategories
        .filter((category) => category.kind === 'income')
        .map((category) => category.name),
    );
    return [
      ...defaultCategories.filter((category) => category.kind === 'income'),
      ...stored.filter((category) => !knownNames.has(category.name)),
    ];
  }
  if (kind !== 'expense') return stored.sort((a, b) => a.order - b.order);
  // Keep user-created settings categories, but always expose the complete shared
  // catalog so a persisted pre-expansion settings list cannot hide new choices.
  const knownNames = new Set(
    defaultCategories
      .filter((category) => category.kind === 'expense')
      .map((category) => category.name),
  );
  return [
    ...defaultCategories.filter((category) => category.kind === 'expense'),
    ...stored.filter((category) => !knownNames.has(category.name)),
  ];
}
export function createCategoryId() {
  return globalThis.crypto?.randomUUID?.() || `category-${Date.now()}`;
}
import { categoryDefinitions } from '../utils/categoryRegistry';
import { incomeCategoryDefinitions } from '@shared/category-registry';
