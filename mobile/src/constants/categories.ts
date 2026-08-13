import {
  Activity, Baby, BookOpen, BriefcaseBusiness, BusFront, CalendarDays, CarFront, CircleParking, ClipboardList,
  Coffee, CreditCard, Droplets, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, HeartHandshake,
  HeartPulse, House, Landmark, Luggage, Package, Palette, PawPrint, PiggyBank, Pill, Plane, Presentation, Receipt,
  Repeat, School, Shapes, ShieldCheck, ShoppingBag, ShoppingBasket, Smartphone, Sofa, Sparkles, Stethoscope,
  Ticket, TrendingUp, Trophy, Utensils, Users, Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react-native';
import { CATEGORY_DEFINITIONS, categoryDefinitions, getSharedCategoryMeta, normalizeCategoryKey, type SharedCategoryMeta } from './category-registry';

export type CategoryMeta = Omit<SharedCategoryMeta, 'iconKey'> & { icon: LucideIcon };
export type CategoryOption = { label: string; icon: LucideIcon };

const icons: Record<string, LucideIcon> = {
  package: Package, utensils: Utensils, 'shopping-basket': ShoppingBasket, coffee: Coffee, shirt: ShoppingBag,
  'shopping-bag': ShoppingBag, sparkles: Sparkles, house: House, 'utility-pole': Zap, zap: Zap, droplet: Droplets,
  wifi: Wifi, smartphone: Smartphone, wrench: Wrench, sofa: Sofa, car: CarFront, fuel: Fuel, bus: BusFront,
  taxi: CarFront, parking: CircleParking, road: CarFront, 'heart-pulse': HeartPulse, pill: Pill, stethoscope: Stethoscope,
  dumbbell: Dumbbell, activity: Activity, 'graduation-cap': GraduationCap, school: School, 'book-open': BookOpen,
  presentation: Presentation, receipt: Receipt, repeat: Repeat, shield: ShieldCheck, 'credit-card': CreditCard,
  landmark: Landmark, 'piggy-bank': PiggyBank, 'trending-up': TrendingUp, 'hand-coins': HandCoins, ticket: Ticket,
  film: Film, 'gamepad-2': Gamepad2, palette: Palette, trophy: Trophy, plane: Plane, luggage: Luggage,
  'calendar-days': CalendarDays, users: Users, baby: Baby, 'paw-print': PawPrint, gift: Gift,
  'heart-handshake': HeartHandshake, briefcase: BriefcaseBusiness, 'clipboard-list': ClipboardList, shapes: Shapes,
};

function fallback(value: string): CategoryMeta {
  const key = normalizeCategoryKey(value) || 'other';
  const color = '#8B8B8B';
  return { key, label: value.trim() || 'Other', icon: Shapes, color, tint: `${color}22`, group: 'other' };
}

export function getCategoryMeta(value: string | null | undefined): CategoryMeta {
  const shared = getSharedCategoryMeta(value);
  return shared ? { ...shared, icon: icons[shared.iconKey] ?? Shapes } : fallback(value ?? 'Other');
}

export function getCategoryKey(value: string) { return getCategoryMeta(value).key; }
export const spendingCategoryOptions: CategoryOption[] = categoryDefinitions.map(({ label, iconKey }) => ({ label, icon: icons[iconKey] ?? Shapes }));
export { CATEGORY_DEFINITIONS };
