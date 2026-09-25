export interface LocalizedEntityText {
  name?: string;
  description?: string;
}

export type EntityTranslations = Record<string, LocalizedEntityText>;

export function canonicalizeLocaleTag(value: string | undefined | null): string {
  const raw = String(value || '').trim().replace(/_/g, '-');
  if (!raw) return '';
  try {
    return Intl.getCanonicalLocales(raw)[0] || raw;
  } catch {
    return raw;
  }
}

function languageOnly(locale: string): string {
  return canonicalizeLocaleTag(locale).split('-')[0] || '';
}

/**
 * Deliverect publishes nameTranslations / descriptionTranslations as
 * language-code keyed string maps. Preserve regional variants while merging
 * both fields into the storefront entity translation shape.
 */
export function normaliseDeliverectTranslations(
  nameTranslations: unknown,
  descriptionTranslations?: unknown
): EntityTranslations | undefined {
  const output: EntityTranslations = {};

  const ingest = (value: unknown, field: keyof LocalizedEntityText) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const [rawLocale, rawText] of Object.entries(value as Record<string, unknown>)) {
      if (typeof rawText !== 'string') continue;
      const text = rawText.trim();
      if (!text) continue;
      const locale = canonicalizeLocaleTag(rawLocale);
      if (!locale) continue;
      output[locale] = { ...(output[locale] || {}), [field]: text };
    }
  };

  ingest(nameTranslations, 'name');
  ingest(descriptionTranslations, 'description');

  return Object.keys(output).length ? output : undefined;
}

export function resolveEntityTranslation(
  entity: {
    name?: string;
    description?: string;
    translations?: EntityTranslations;
  } | null | undefined,
  field: keyof LocalizedEntityText,
  currentLocale: string,
  defaultLocale: string,
  fallbackLocale = 'en-GB'
): string {
  if (!entity) return '';

  const translations = entity.translations || {};
  const candidates = [
    canonicalizeLocaleTag(currentLocale),
    languageOnly(currentLocale),
    canonicalizeLocaleTag(defaultLocale),
    languageOnly(defaultLocale),
    canonicalizeLocaleTag(fallbackLocale),
    languageOnly(fallbackLocale),
  ].filter(Boolean);

  for (const candidate of Array.from(new Set(candidates))) {
    const direct = translations[candidate]?.[field];
    if (direct) return direct;

    const matchedKey = Object.keys(translations).find(
      (key) => canonicalizeLocaleTag(key).toLowerCase() === candidate.toLowerCase()
    );
    const matched = matchedKey ? translations[matchedKey]?.[field] : undefined;
    if (matched) return matched;
  }

  return String(entity[field] || '');
}
