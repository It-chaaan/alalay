import { getCategoryMeta } from "./categoryRegistry";

export { getCategoryMeta } from "./categoryRegistry";

export function getCategoryColor(category: string, _fallbackIndex?: number) {
  return getCategoryMeta(category).color;
}
