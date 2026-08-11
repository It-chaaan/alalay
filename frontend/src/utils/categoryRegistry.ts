import { CATEGORY_DEFINITIONS, getSharedCategoryMeta, normalizeCategoryKey, type SharedCategoryMeta } from "../../../mobile/src/constants/category-registry";

export type CategoryMeta = SharedCategoryMeta;

function fallback(value: string): CategoryMeta {
  const key = normalizeCategoryKey(value) || "other";
  const hash = [...key].reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 7);
  const colors = ["#8B8B8B", "#60758A", "#A97852", "#6B7E9F"];
  const color = colors[hash % colors.length];
  return { key, label: value.trim() || "Other", iconKey: "tag", color, tint: `${color}22` };
}

export function getCategoryMeta(value: string | null | undefined): CategoryMeta {
  return getSharedCategoryMeta(value) ?? fallback(value ?? "Other");
}

export const categoryDefinitions = Object.values(CATEGORY_DEFINITIONS);
