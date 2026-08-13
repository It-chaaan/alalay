import { Activity, Baby, BookOpen, BriefcaseBusiness, BusFront, CalendarDays, Car, CircleParking, ClipboardList, Coffee, CreditCard, Droplet, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, HandCoins, HeartHandshake, HeartPulse, House, Landmark, Luggage, Package, Palette, PawPrint, PiggyBank, Pill, Plane, Presentation, Receipt, Repeat, School, Shapes, Shield, ShoppingBag, ShoppingBasket, Smartphone, Sofa, Sparkles, Stethoscope, Ticket, TrendingUp, Trophy, Utensils, Users, Wifi, Wrench, Zap } from "lucide-react";
import { getCategoryDefinition } from "../../utils/categoryDefinitions";

const icons = {
  package: Package, utensils: Utensils, "shopping-basket": ShoppingBasket, coffee: Coffee, shirt: ShoppingBag, "shopping-bag": ShoppingBag, sparkles: Sparkles,
  house: House, "utility-pole": Zap, zap: Zap, droplet: Droplet, wifi: Wifi, smartphone: Smartphone, wrench: Wrench, sofa: Sofa,
  car: Car, fuel: Fuel, bus: BusFront, taxi: Car, parking: CircleParking, road: Car, "heart-pulse": HeartPulse, pill: Pill, stethoscope: Stethoscope,
  dumbbell: Dumbbell, activity: Activity, "graduation-cap": GraduationCap, school: School, "book-open": BookOpen, presentation: Presentation,
  receipt: Receipt, repeat: Repeat, shield: Shield, "credit-card": CreditCard, landmark: Landmark, "piggy-bank": PiggyBank, "trending-up": TrendingUp,
  "hand-coins": HandCoins, ticket: Ticket, film: Film, "gamepad-2": Gamepad2, palette: Palette, trophy: Trophy, plane: Plane, luggage: Luggage,
  "calendar-days": CalendarDays, users: Users, baby: Baby, "paw-print": PawPrint, gift: Gift, "heart-handshake": HeartHandshake,
  briefcase: BriefcaseBusiness, "clipboard-list": ClipboardList, shapes: Shapes,
};

export function CategoryIcon({ category, size = "sm" }: { category: string; size?: "sm" | "md" }) {
  const definition = getCategoryDefinition(category);
  const Icon = icons[definition.icon as keyof typeof icons] ?? Shapes;
  return <span className={`inline-grid shrink-0 place-items-center rounded-full ${size === "md" ? "h-8 w-8" : "h-6 w-6"}`} style={{ backgroundColor: `${definition.color}22`, color: definition.color }}><Icon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" /></span>;
}
