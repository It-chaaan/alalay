import { CategoryIcon } from './CategoryIcon';
import { getCategoryMeta } from '../../utils/categoryRegistry';

export function CategoryBadge({
  category,
  compact = false,
}: {
  category: string;
  compact?: boolean;
}) {
  const meta = getCategoryMeta(category);
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium"
      style={{ backgroundColor: meta.tint, color: meta.color }}
    >
      <CategoryIcon category={category} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
}
