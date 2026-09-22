export type LabeledPickerItem = object;

const collator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
  usage: 'sort',
});

type SortOptions<T> = {
  getLabel?: (item: T) => string | null | undefined;
  isSpecialItem?: (item: T) => boolean;
  otherLast?: boolean;
};

/**
 * Returns a presentation-only ordering for picker options. The original array
 * and each item's canonical value are left untouched.
 */
export function sortCategoriesByLabel<T extends LabeledPickerItem>(
  items: readonly T[],
  options: SortOptions<T> = {},
): T[] {
  const {
    getLabel = (item) => ('label' in item && typeof item.label === 'string' ? item.label : ''),
    isSpecialItem = () => false,
    otherLast = true,
  } = options;
  return items
    .map((item, index) => ({ item, index, label: getLabel(item)?.trim() ?? '' }))
    .sort((left, right) => {
      const leftSpecial = isSpecialItem(left.item);
      const rightSpecial = isSpecialItem(right.item);
      if (leftSpecial !== rightSpecial) return leftSpecial ? 1 : -1;

      const leftOther = otherLast && left.label.toLocaleLowerCase() === 'other';
      const rightOther = otherLast && right.label.toLocaleLowerCase() === 'other';
      if (leftOther !== rightOther) return leftOther ? 1 : -1;

      const comparison = collator.compare(left.label, right.label);
      return comparison || left.index - right.index;
    })
    .map(({ item }) => item);
}

/** Preserves group order while independently sorting each group's items. */
export function sortGroupedCategories<T extends LabeledPickerItem, G>(
  groups: readonly { group: G; items: readonly T[] }[],
  options?: SortOptions<T>,
) {
  return groups.map(({ group, items }) => ({
    group,
    items: sortCategoriesByLabel(items, options),
  }));
}
