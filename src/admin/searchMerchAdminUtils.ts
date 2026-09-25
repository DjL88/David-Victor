export type SearchMerchTargetType = 'product' | 'category' | 'brand';

export interface SearchMerchProductReference {
  plu: string;
  name: string;
}

export interface SearchMerchCategoryReference {
  id: string;
  name: string;
}

export function splitSearchMerchReferences(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function mergeSearchMerchReferences(
  current: readonly string[],
  input: string,
): string[] {
  return Array.from(new Set([...current, ...splitSearchMerchReferences(input)]));
}

export function resolveSearchMerchTargetName(
  type: SearchMerchTargetType,
  targetId: string,
  products: readonly SearchMerchProductReference[],
  categories: readonly SearchMerchCategoryReference[],
): string {
  if (type === 'product') {
    return products.find((product) => product.plu === targetId)?.name || targetId;
  }

  if (type === 'category') {
    return categories.find((category) => category.id === targetId)?.name || targetId;
  }

  return targetId;
}
