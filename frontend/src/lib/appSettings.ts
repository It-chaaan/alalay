export type CurrencyCode = "PHP" | "USD" | "EUR" | "JPY" | "SGD";
export type DateFormat = "short" | "slash" | "iso";
export type ThemeMode = "light" | "dark" | "system";
export type CategoryKind = "expense" | "income";

export type AppCategory = { id: string; kind: CategoryKind; name: string; icon: string; color: string; order: number };
export type NotificationSettings = { billReminders: boolean; billReminderDays: number; overspendingAlerts: boolean; budgetThresholds: boolean; subscriptionReminders: boolean; summaries: boolean; savingsMilestones: boolean; loginAlerts: boolean };
export type AppSettings = { theme: ThemeMode; currency: CurrencyCode; dateFormat: DateFormat; notifications: NotificationSettings; categories: AppCategory[] };

const storageKey = "alalay-app-settings";
export const settingsChangedEvent = "alalay-settings-changed";

const defaultCategories: AppCategory[] = [
  ["Food", "utensils", "#e8775d", "expense"], ["Transport", "car", "#5d8fc4", "expense"], ["Rent", "house", "#4d9a73", "expense"],
  ["Electricity", "zap", "#d89b1d", "expense"], ["Internet", "wifi", "#4778c7", "expense"], ["Water", "droplet", "#5da9d6", "expense"],
  ["Subscriptions", "repeat", "#8d70ad", "expense"], ["Other", "tag", "#8b8b8b", "expense"],
  ["Salary", "arrow-up", "#3f7d16", "income"], ["Freelance", "arrow-up", "#6fa3d2", "income"], ["Business", "arrow-up", "#f4c37d", "income"], ["Gifts", "star", "#e8775d", "income"],
].map(([name, icon, color, kind], order) => ({ id: `${kind}-${name.toLowerCase()}`, name, icon, color, kind: kind as CategoryKind, order }));

export const defaultSettings: AppSettings = {
  theme: "light", currency: "PHP", dateFormat: "short",
  notifications: { billReminders: true, billReminderDays: 3, overspendingAlerts: true, budgetThresholds: true, subscriptionReminders: true, summaries: false, savingsMilestones: true, loginAlerts: true },
  categories: defaultCategories,
};

export function readAppSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || "null") as Partial<AppSettings> | null;
    const theme = stored?.theme && ["light", "dark", "system"].includes(stored.theme) ? stored.theme : defaultSettings.theme;
    const currency = stored?.currency && ["PHP", "USD", "EUR", "JPY", "SGD"].includes(stored.currency) ? stored.currency : defaultSettings.currency;
    const dateFormat = stored?.dateFormat && ["short", "slash", "iso"].includes(stored.dateFormat) ? stored.dateFormat : defaultSettings.dateFormat;
    return { ...defaultSettings, ...stored, theme: theme as ThemeMode, currency: currency as CurrencyCode, dateFormat: dateFormat as DateFormat, notifications: { ...defaultSettings.notifications, ...stored?.notifications }, categories: stored?.categories?.length ? stored.categories : defaultSettings.categories };
  } catch { return defaultSettings; }
}

export function writeAppSettings(settings: AppSettings) { window.localStorage.setItem(storageKey, JSON.stringify(settings)); window.dispatchEvent(new CustomEvent(settingsChangedEvent)); }
export function getCategories(kind?: CategoryKind) { return readAppSettings().categories.filter((category) => category.name !== "Utilities" && (!kind || category.kind === kind)).sort((a, b) => a.order - b.order); }
export function createCategoryId() { return globalThis.crypto?.randomUUID?.() || `category-${Date.now()}`; }
