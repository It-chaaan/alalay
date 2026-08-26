import {
  Activity, Award, Baby, BadgePercent, BookOpen, BriefcaseBusiness, BusFront, CalendarDays, CarFront, ChartNoAxesCombined,
  CircleDollarSign, CircleParking, ClipboardList, Clock3, Coins, Coffee, CreditCard, Droplets, Dumbbell, FileText, Film, Fuel,
  Gamepad2, Gift, GraduationCap, HandCoins, HandHeart, HeartHandshake, HeartPulse, House, Landmark, Laptop, Layers2, Luggage, Package,
  Palette, PartyPopper, PawPrint, PiggyBank, Pill, Plane, Presentation, Receipt, Repeat, School, Send, Shapes, ShieldCheck,
  ShoppingBag, ShoppingBasket, Smartphone, Sofa, Sparkles, Stethoscope, Store, Tag, Ticket, TrendingUp, Trophy,
  Undo2, Utensils, UtensilsCrossed, Users, Wifi, Wrench, Zap, Music2, Percent, Building2, type LucideIcon,
} from 'lucide-react-native';
import { CATEGORY_DEFINITIONS, categoryDefinitions, getCustomCategoryMeta, getSharedCategoryMeta, type SharedCategoryMeta } from './category-registry';

export type CategoryMeta = Omit<SharedCategoryMeta, 'iconKey'> & { icon: LucideIcon };
export type CategoryOption = { label: string; icon: LucideIcon };

const icons: Record<string, LucideIcon> = {
  package: Package, utensils: Utensils, 'utensils-crossed': UtensilsCrossed, 'shopping-basket': ShoppingBasket, coffee: Coffee, shirt: ShoppingBag,
  'shopping-bag': ShoppingBag, sparkles: Sparkles, house: House, 'utility-pole': Zap, zap: Zap, droplet: Droplets,
  wifi: Wifi, smartphone: Smartphone, wrench: Wrench, sofa: Sofa, 'building-2': Building2, car: CarFront, fuel: Fuel, bus: BusFront,
  taxi: CarFront, parking: CircleParking, road: CarFront, 'heart-pulse': HeartPulse, pill: Pill, stethoscope: Stethoscope,
  dumbbell: Dumbbell, activity: Activity, 'graduation-cap': GraduationCap, school: School, 'book-open': BookOpen,
  presentation: Presentation, receipt: Receipt, repeat: Repeat, shield: ShieldCheck, 'credit-card': CreditCard,
  landmark: Landmark, 'piggy-bank': PiggyBank, 'trending-up': TrendingUp, 'hand-coins': HandCoins, ticket: Ticket,
  film: Film, 'gamepad-2': Gamepad2, palette: Palette, trophy: Trophy, plane: Plane, luggage: Luggage,
  'calendar-days': CalendarDays, users: Users, baby: Baby, 'paw-print': PawPrint, gift: Gift,
  'heart-handshake': HeartHandshake, briefcase: BriefcaseBusiness, 'briefcase-business': BriefcaseBusiness, laptop: Laptop,
  store: Store, send: Send, 'badge-percent': BadgePercent, 'clock-3': Clock3, 'chart-no-axes-combined': ChartNoAxesCombined,
  percent: Percent, coins: Coins, 'shield-check': ShieldCheck, 'undo-2': Undo2, award: Award, tag: Tag,
  'music-2': Music2, 'circle-dollar-sign': CircleDollarSign, 'file-text': FileText, 'layers-2': Layers2, tooth: HeartPulse,
  'party-popper': PartyPopper, 'gift-card': Gift, 'hand-heart': HandHeart, 'clipboard-list': ClipboardList, shapes: Shapes,
};

export function getCategoryMeta(value: string | null | undefined): CategoryMeta {
  const shared = getSharedCategoryMeta(value);
  const metadata = shared ?? getCustomCategoryMeta(value);
  return { ...metadata, icon: icons[metadata.iconKey] ?? Shapes };
}

export function getCategoryKey(value: string) { return getCategoryMeta(value).key; }
export const spendingCategoryOptions: CategoryOption[] = categoryDefinitions.map(({ label, iconKey }) => ({ label, icon: icons[iconKey] ?? Shapes }));
export { CATEGORY_DEFINITIONS };
