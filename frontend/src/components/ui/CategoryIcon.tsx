import { Car, Droplet, Gamepad2, Gift, GraduationCap, HeartPulse, House, PawPrint, Plane, Repeat, Shield, ShoppingBag, ShoppingBasket, Sparkles, Tag, Utensils, Wifi, Zap } from "lucide-react";
import { getCategoryDefinition } from "../../utils/categoryDefinitions";

const icons = { utensils: Utensils, "shopping-basket": ShoppingBasket, car: Car, repeat: Repeat, house: House, droplet: Droplet, zap: Zap, wifi: Wifi, "heart-pulse": HeartPulse, "graduation-cap": GraduationCap, "gamepad-2": Gamepad2, "shopping-bag": ShoppingBag, plane: Plane, shield: Shield, sparkles: Sparkles, gift: Gift, "paw-print": PawPrint, tag: Tag };

export function CategoryIcon({ category, size = "sm" }: { category: string; size?: "sm" | "md" }) {
  const definition = getCategoryDefinition(category);
  const Icon = icons[definition.icon as keyof typeof icons] ?? Tag;
  return <span className={`inline-grid shrink-0 place-items-center rounded-full ${size === "md" ? "h-8 w-8" : "h-6 w-6"}`} style={{ backgroundColor: `${definition.color}22`, color: definition.color }}><Icon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" /></span>;
}
