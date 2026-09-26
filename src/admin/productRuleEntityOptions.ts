import type { Product } from '../commerce/models';
import type { SearchMerchSuggestion } from './searchMerchEntityOptions';

export function buildProductRuleTagOptions(products: readonly Product[]): SearchMerchSuggestion[] {
  const byValue = new Map<string, SearchMerchSuggestion>();

  for (const product of products || []) {
    (product.productTags || []).forEach((tag, index) => {
      const value = String(tag).trim();
      if (!value) return;
      const key = value.toLocaleLowerCase();
      if (!byValue.has(key)) {
        byValue.set(key, {
          value,
          label: String(product.productTagLabels?.[index] || value).trim() || value,
        });
      }
    });

    for (const tag of product.tags || []) {
      const value = String(tag).trim();
      if (!value) continue;
      const key = value.toLocaleLowerCase();
      if (!byValue.has(key)) byValue.set(key, { value, label: value });
    }
  }

  return Array.from(byValue.values()).sort(
    (a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value),
  );
}

export const splitAdminRuleValues = (value: unknown): string[] =>
  String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
