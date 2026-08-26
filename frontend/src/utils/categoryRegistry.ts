import {
  CATEGORY_DEFINITIONS,
  getSharedCategoryMeta,
  normalizeCategoryKey,
  getCustomCategoryMeta,
  type SharedCategoryMeta,
} from '@shared/category-registry';

export type CategoryMeta = SharedCategoryMeta;

export function getCategoryMeta(value: string | null | undefined): CategoryMeta {
  return getSharedCategoryMeta(value) ?? getCustomCategoryMeta(value);
}

export const categoryDefinitions = Object.values(CATEGORY_DEFINITIONS);
