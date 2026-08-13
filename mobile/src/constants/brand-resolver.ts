export type BrandEntity = 'subscription' | 'bill' | 'wallet';
export type BrandMatch = { key: string; mark: string; color: string; aliases: string[] };

const registry: BrandMatch[] = [
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
  { key: 'gcash', mark: 'G', color: '#007DFE', aliases: ['gcash', 'g cash'] },
  { key: 'maya', mark: 'M', color: '#00A878', aliases: ['maya'] },
  { key: 'gotyme', mark: 'GT', color: '#E65C4F', aliases: ['gotyme', 'go tyme'] },
  { key: 'shopeepay', mark: 'S', color: '#EE4D2D', aliases: ['shopeepay', 'shopee pay'] },
  { key: 'coins_ph', mark: '₿', color: '#F4A62A', aliases: ['coins.ph', 'coins ph'] },
  { key: 'maribank', mark: 'M', color: '#7A5AF8', aliases: ['maribank', 'mari bank'] },
  { key: 'cimb_ph', mark: 'C', color: '#D94A75', aliases: ['cimb', 'cimb bank'] },
  { key: 'tonik', mark: 'T', color: '#3A9FBF', aliases: ['tonik'] },
  { key: 'ing_ph', mark: 'I', color: '#F26522', aliases: ['ing'] },
  { key: 'uno_digital', mark: 'U', color: '#3C6E71', aliases: ['uno', 'uno digital bank'] },
  { key: 'bdo', mark: 'BDO', color: '#2F5DA8', aliases: ['bdo'] },
  { key: 'bpi', mark: 'BPI', color: '#B43F4B', aliases: ['bpi'] },
  { key: 'metrobank', mark: 'M', color: '#176B87', aliases: ['metrobank', 'metro bank'] },
  { key: 'unionbank', mark: 'U', color: '#B84D8B', aliases: ['unionbank', 'union bank'] },
  { key: 'security_bank', mark: 'SB', color: '#C65D3A', aliases: ['security bank'] },
  { key: 'landbank', mark: 'L', color: '#2B7A78', aliases: ['landbank', 'land bank'] },
  { key: 'rcbc', mark: 'RC', color: '#347A58', aliases: ['rcbc'] },
  { key: 'pnb', mark: 'P', color: '#7B4B94', aliases: ['pnb'] },
  { key: 'eastwest', mark: 'EW', color: '#316B83', aliases: ['eastwest', 'east west'] },
  { key: 'china_bank', mark: 'CB', color: '#A04A4A', aliases: ['china bank', 'chinabank'] },
  { key: 'cash', mark: '₱', color: '#0F8A6B', aliases: ['cash', 'cash wallet'] },
];

export function normalizeBrandName(value: string) {
  return value.toLowerCase().trim().replace(/[+&/().,'’_-]+/g, ' ').replace(/\s+/g, ' ');
}

function matchesAlias(normalized: string, alias: string) {
  const candidate = normalizeBrandName(alias);
  if (normalized === candidate) return true;
  const tokens = new Set(normalized.split(' '));
  return candidate.split(' ').length === 1 && tokens.has(candidate);
}

export function resolveBrand(name: string, entity: BrandEntity, institutionKey?: string | null): BrandMatch | null {
  const structured = institutionKey ? registry.find((brand) => brand.key === normalizeBrandName(institutionKey).replace(/ /g, '_')) : undefined;
  if (structured) return structured;
  const normalized = normalizeBrandName(name);
  const match = registry.find((brand) => (brand.key !== 'cash' || entity === 'wallet') && brand.aliases.some((alias) => matchesAlias(normalized, alias)));
  if (entity === 'wallet' && normalized === 'cash') return registry.find((brand) => brand.key === 'cash') ?? null;
  return match ?? null;
}

export function initialForName(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';
}
