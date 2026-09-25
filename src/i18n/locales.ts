import { canonicalizeLocaleTag } from './entityTranslations';

export interface SupportedLocale {
  code: string;
  label: string;
  flag: string;
  languageName: string;
}

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  { code: 'en-GB', label: 'English (UK)', flag: '🇬🇧', languageName: 'English' },
  { code: 'en-US', label: 'English (US)', flag: '🇺🇸', languageName: 'English' },
  { code: 'es-ES', label: 'Español', flag: '🇪🇸', languageName: 'Spanish' },
  { code: 'fr-FR', label: 'Français', flag: '🇫🇷', languageName: 'French' },
  { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪', languageName: 'German' },
  { code: 'cy-GB', label: 'Cymraeg', flag: '🏴', languageName: 'Welsh' },
];

export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES.map((locale) => locale.code);

export function isSupportedLocale(code: string): boolean {
  const canonical = canonicalizeLocaleTag(code);
  return SUPPORTED_LOCALE_CODES.some(
    (supported) => supported.toLowerCase() === canonical.toLowerCase()
  );
}

export function normaliseSupportedLocale(code: string | undefined, fallback = 'en-GB'): string {
  const canonical = canonicalizeLocaleTag(code);
  const matched = SUPPORTED_LOCALE_CODES.find(
    (supported) => supported.toLowerCase() === canonical.toLowerCase()
  );
  if (matched) return matched;

  const canonicalFallback = canonicalizeLocaleTag(fallback);
  return SUPPORTED_LOCALE_CODES.find(
    (supported) => supported.toLowerCase() === canonicalFallback.toLowerCase()
  ) || 'en-GB';
}

export function resolveEnabledLocales(
  enabledLocales: string[] | undefined,
  defaultLocale: string
): SupportedLocale[] {
  const safeDefault = normaliseSupportedLocale(defaultLocale);
  const requested = new Set(
    (enabledLocales?.length ? enabledLocales : [safeDefault, ...SUPPORTED_LOCALE_CODES])
      .filter((code): code is string => Boolean(code) && isSupportedLocale(code))
  );
  requested.add(safeDefault);

  const resolved = SUPPORTED_LOCALES.filter((locale) => requested.has(locale.code));
  return resolved.length
    ? resolved
    : SUPPORTED_LOCALES.filter((locale) => locale.code === 'en-GB');
}
