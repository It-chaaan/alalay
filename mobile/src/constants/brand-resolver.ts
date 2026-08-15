import { institutionRegistry } from './institution-registry';

export type BrandEntity = 'subscription' | 'bill' | 'wallet';
export type BrandMatch = { key: string; mark: string; color: string; aliases: string[] };

const serviceBrands: BrandMatch[] = [
  { key: 'netflix', mark: 'N', color: '#E50914', aliases: ['netflix'] },
  { key: 'spotify', mark: 'S', color: '#1DB954', aliases: ['spotify'] },
  { key: 'chatgpt', mark: 'AI', color: '#10A37F', aliases: ['chatgpt', 'openai'] },
  { key: 'canva', mark: 'C', color: '#00C4CC', aliases: ['canva'] },
  { key: 'adobe', mark: 'A', color: '#FA0F00', aliases: ['adobe', 'creative cloud'] },
  { key: 'youtube', mark: 'YT', color: '#FF0000', aliases: ['youtube'] },
  { key: 'disney', mark: 'D+', color: '#113CCF', aliases: ['disney', 'disney plus'] },
  { key: 'apple', mark: '', color: '#555555', aliases: ['apple', 'icloud'] },
  { key: 'google', mark: 'G', color: '#4285F4', aliases: ['google', 'google one'] },
  { key: 'microsoft', mark: 'MS', color: '#737373', aliases: ['microsoft', 'office 365', 'xbox'] },
  { key: 'meralco', mark: 'M', color: '#E83B35', aliases: ['meralco'] },
  { key: 'pldt', mark: 'P', color: '#0072BC', aliases: ['pldt'] },
  { key: 'maynilad', mark: 'M', color: '#0077B8', aliases: ['maynilad'] },
  { key: 'manila_water', mark: 'MW', color: '#0066A1', aliases: ['manila water'] },
  { key: 'globe', mark: 'G', color: '#00AEEF', aliases: ['globe'] },
  { key: 'smart', mark: 'S', color: '#78BE20', aliases: ['smart'] },
  { key: 'converge', mark: 'C', color: '#F58220', aliases: ['converge'] },
];

const institutionBrands: BrandMatch[] = institutionRegistry.map((institution) => ({
  key: institution.id,
  mark: institution.mark,
  color: institution.brandColor,
  aliases: [institution.displayName, ...institution.aliases],
}));

export function normalizeBrandName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[+&/().,'’_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function matchesAlias(normalized: string, alias: string) {
  const candidate = normalizeBrandName(alias);
  if (normalized === candidate) return true;
  const tokens = new Set(normalized.split(' '));
  return candidate.split(' ').length === 1 && tokens.has(candidate);
}

export function resolveBrand(
  name: string,
  entity: BrandEntity,
  institutionKey?: string | null,
): BrandMatch | null {
  const structured =
    institutionKey && institutionKey !== 'custom'
      ? institutionBrands.find((brand) => brand.key === institutionKey)
      : undefined;
  if (structured) return structured;
  const normalized = normalizeBrandName(name);
  const match = [...institutionBrands, ...serviceBrands].find(
    (brand) =>
      (brand.key !== 'cash' || entity === 'wallet') &&
      brand.aliases.some((alias) => matchesAlias(normalized, alias)),
  );
  return match ?? null;
}

export function initialForName(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}
