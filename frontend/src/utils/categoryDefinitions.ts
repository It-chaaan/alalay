export type CategoryDefinition = { name: string; icon: string; color: string };

export const expenseCategoryDefinitions: CategoryDefinition[] = [
  { name: "Food", icon: "utensils", color: "#e8775d" },
  { name: "Transport", icon: "car", color: "#5d8fc4" },
  { name: "Rent", icon: "house", color: "#4d9a73" },
  { name: "Electricity", icon: "zap", color: "#d89b1d" },
  { name: "Internet", icon: "wifi", color: "#4778c7" },
  { name: "Water", icon: "droplet", color: "#5da9d6" },
  { name: "Subscriptions", icon: "repeat", color: "#8d70ad" },
  { name: "Other", icon: "tag", color: "#8b8b8b" },
];

export function getCategoryDefinition(name: string) {
  const normalized = name.trim().toLowerCase();
  return expenseCategoryDefinitions.find((category) => category.name.toLowerCase() === normalized)
    ?? { name, icon: "tag", color: "#8b8b8b" };
}
