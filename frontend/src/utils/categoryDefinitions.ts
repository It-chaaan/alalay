import { categoryDefinitions, getCategoryMeta } from "./categoryRegistry";

export type CategoryDefinition = { name: string; icon: string; color: string };

export const expenseCategoryDefinitions: CategoryDefinition[] = categoryDefinitions.map((category) => ({
  name: category.label,
  icon: category.icon,
  color: category.color,
}));

export function getCategoryDefinition(name: string) {
  const category = getCategoryMeta(name);
  return { name: category.label === "Other" && name.trim() ? name : category.label, icon: category.icon, color: category.color };
}
