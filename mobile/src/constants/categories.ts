import { Bolt, CarFront, CreditCard, Droplets, Film, Gift, GraduationCap, HeartPulse, Home, MoreHorizontal, PawPrint, Plane, Repeat, ShieldCheck, ShoppingBag, Sparkles, Utensils, Wifi, type LucideIcon } from 'lucide-react-native';
import { CATEGORY_DEFINITIONS, getSharedCategoryMeta, normalizeCategoryKey, type SharedCategoryMeta } from './category-registry';

export type CategoryMeta = Omit<SharedCategoryMeta, 'iconKey'> & { icon: LucideIcon };

const icons: Record<string, LucideIcon> = {
  utensils: Utensils, 'shopping-basket': ShoppingBag, car: CarFront, repeat: Repeat, house: Home, droplet: Droplets,
  zap: Bolt, wifi: Wifi, 'heart-pulse': HeartPulse, 'graduation-cap': GraduationCap, 'gamepad-2': Film,
  'shopping-bag': ShoppingBag, plane: Plane, shield: ShieldCheck, sparkles: Sparkles, gift: Gift, 'paw-print': PawPrint,
  tag: MoreHorizontal, 'credit-card': CreditCard,
};

function fallback(value: string): CategoryMeta {
  const key = normalizeCategoryKey(value) || 'other';
  const hash = [...key].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) | 0, 7);
  const colors = ['#8B8B8B', '#60758A', '#A97852', '#6B7E9F'];
  const color = colors[Math.abs(hash) % colors.length];
  return { key, label: value.trim() || 'Other', icon: MoreHorizontal, color, tint: `${color}22` };
}

export function getCategoryMeta(value: string | null | undefined): CategoryMeta {
  const shared = getSharedCategoryMeta(value);
  if (!shared) return fallback(value ?? 'Other');
  return { key: shared.key, label: shared.label, icon: icons[shared.iconKey] ?? MoreHorizontal, color: shared.color, tint: shared.tint };
}

export function getCategoryKey(value: string) { return getCategoryMeta(value).key; }
export const spendingCategoryOptions = Object.values(CATEGORY_DEFINITIONS).map(({ label, iconKey }) => ({ label, icon: icons[iconKey] ?? MoreHorizontal }));
