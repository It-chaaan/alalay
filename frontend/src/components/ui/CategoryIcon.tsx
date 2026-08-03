import { Car, Droplet, House, Repeat, Tag, Utensils, Wifi, Zap } from "lucide-react";
import { getCategoryDefinition } from "../../utils/categoryDefinitions";

const icons = { utensils: Utensils, car: Car, house: House, zap: Zap, wifi: Wifi, droplet: Droplet, repeat: Repeat, tag: Tag };

export function CategoryIcon({ category, size = "sm" }: { category: string; size?: "sm" | "md" }) {
  const definition = getCategoryDefinition(category);
  const Icon = icons[definition.icon as keyof typeof icons] ?? Tag;
  return <span className={`inline-grid shrink-0 place-items-center rounded-full ${size === "md" ? "h-8 w-8" : "h-6 w-6"}`} style={{ backgroundColor: `${definition.color}22`, color: definition.color }}><Icon className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" /></span>;
}
