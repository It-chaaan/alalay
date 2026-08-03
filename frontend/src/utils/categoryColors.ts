const categoryColorMap: Record<string, string> = {
  food: "#e8775d",
  repair: "#d65f4a",
  transport: "#6fa3d2",
  transportation: "#6fa3d2",
  electricity: "#d89b1d",
  internet: "#4778c7",
  water: "#5da9d6",
  rent: "#4d9a73",
  subscriptions: "#8d70ad",
  other: "#8b8b8b",
  gifts: "#e8775d",
  salary: "#3f7d16",
  freelance: "#6fa3d2",
  business: "#f4c37d",
};

const fallbackCategoryColors = ["#e8775d", "#6fa3d2", "#7db59c", "#f2c87c", "#9d90ac", "#bdb2a5", "#0f8a6b"];

export function getCategoryColor(category: string, fallbackIndex = 0) {
  const key = category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  return categoryColorMap[key] ?? fallbackCategoryColors[fallbackIndex % fallbackCategoryColors.length];
}
