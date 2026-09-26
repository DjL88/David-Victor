import { Category, Product } from '../commerce/models';

export interface SearchMerchSuggestion {
  value: string;
  label: string;
  description?: string;
}

export interface SearchMerchEntityOptions {
  products: SearchMerchSuggestion[];
  categories: SearchMerchSuggestion[];
  brands: SearchMerchSuggestion[];
}

const normalise = (value: unknown) => String(value ?? '').trim();

export function flattenSearchMerchCategories(
  categories: readonly Category[],
  parentLabel = '',
): SearchMerchSuggestion[] {
  const options: SearchMerchSuggestion[] = [];
  for (const category of categories || []) {
    const value = normalise(category.id);
    const name = normalise(category.name) || value;
    if (!value || !name) continue;
    const label = parentLabel ? `${parentLabel} › ${name}` : name;
    options.push({ value, label });
    if (category.subcategories?.length) {
      options.push(...flattenSearchMerchCategories(category.subcategories, label));
    }
  }
  return options;
}

function dedupeSuggestions(options: readonly SearchMerchSuggestion[]): SearchMerchSuggestion[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = option.value.toLocaleLowerCase();
    if (!option.value || !option.label || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSearchMerchEntityOptions(
  products: readonly Product[],
  categories: readonly Category[],
): SearchMerchEntityOptions {
  const productOptions = dedupeSuggestions(
    (products || []).map((product) => ({
      value: normalise(product.plu),
      label: normalise(product.name) || normalise(product.plu),
      description: normalise(product.brand) || undefined,
    })),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const categoryOptions = dedupeSuggestions(
    flattenSearchMerchCategories(categories || []),
  ).sort((a, b) => a.label.localeCompare(b.label));

  const brandOptions = dedupeSuggestions(
    (products || [])
      .map((product) => normalise(product.brand))
      .filter(Boolean)
      .map((brand) => ({ value: brand, label: brand })),
  ).sort((a, b) => a.label.localeCompare(b.label));

  return {
    products: productOptions,
    categories: categoryOptions,
    brands: brandOptions,
  };
}

export function resolveSearchMerchTargetName(
  type: 'product' | 'category' | 'brand',
  targetId: string,
  options: SearchMerchEntityOptions,
): string | undefined {
  const value = normalise(targetId);
  if (!value) return undefined;
  const source =
    type === 'product'
      ? options.products
      : type === 'category'
        ? options.categories
        : options.brands;
  return source.find((option) => option.value === value)?.label;
}
