export type BillIconName =
  | 'electricity'
  | 'water'
  | 'internet'
  | 'cable'
  | 'rent'
  | 'subscription'
  | 'phone'
  | 'insurance'
  | 'loan';

export type BillIconResolution =
  | { kind: 'icon'; name: BillIconName }
  | { kind: 'provider'; name: string }
  | { kind: 'initial'; name: string };

const categoryIcons: [BillIconName, string[]][] = [
  ['electricity', ['electricity', 'power', 'electric']],
  ['water', ['water', 'utility water']],
  ['internet', ['internet', 'wifi', 'wi fi', 'broadband']],
  ['cable', ['cable tv', 'cable television', 'television', 'tv']],
  ['rent', ['rent', 'apartment', 'housing', 'home']],
  ['subscription', ['subscription', 'subscriptions', 'streaming']],
  ['phone', ['phone', 'mobile', 'telephone', 'telecom']],
  ['insurance', ['insurance']],
  ['loan', ['loan', 'debt', 'credit card', 'finance']],
];

export function normalizeBillCategory(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[&/_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function iconName(value: string | null | undefined): BillIconName | null {
  const normalized = normalizeBillCategory(value);
  if (!normalized) return null;
  return categoryIcons.find(([, aliases]) => aliases.includes(normalized))?.[0] ?? null;
}

function initial(value: string | null | undefined) {
  const first = (value ?? '').trim().slice(0, 1).toUpperCase();
  return first || '?';
}

export function resolveBillIcon(input: {
  name?: string | null;
  category?: string | null;
  customCategory?: string | null;
  icon?: string | null;
  providerKey?: string | null;
}): BillIconResolution {
  const explicit = iconName(input.icon);
  if (explicit) return { kind: 'icon', name: explicit };
  const category = iconName(input.customCategory) ?? iconName(input.category);
  if (category) return { kind: 'icon', name: category };
  if (input.providerKey?.trim()) return { kind: 'provider', name: input.providerKey.trim() };
  return { kind: 'initial', name: initial(input.name) };
}
