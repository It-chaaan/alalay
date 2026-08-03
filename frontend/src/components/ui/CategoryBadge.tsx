import { CategoryIcon } from "./CategoryIcon";

export function CategoryBadge({ category, compact = false }: { category: string; compact?: boolean }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${compact ? "bg-slate-50 text-slate-600" : "bg-slate-100 text-slate-700"}`}><CategoryIcon category={category} /><span className="truncate">{category}</span></span>;
}
