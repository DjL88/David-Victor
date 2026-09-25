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

/**
 * Deliverect publishes translation maps keyed by language/locale code.
 * Canonicalize locale tags while retaining region-specific variants.
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
