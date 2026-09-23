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
];

export const SUPPORTED_LOCALE_CODES = SUPPORTED_LOCALES.map((locale) => locale.code);

export function resolveEnabledLocales(
  enabledLocales: string[] | undefined,
  defaultLocale: string
): SupportedLocale[] {
  const requested = new Set(
    (enabledLocales?.length ? enabledLocales : [defaultLocale, ...SUPPORTED_LOCALE_CODES])
      .filter(Boolean)
  );
  requested.add(defaultLocale);

  const resolved = SUPPORTED_LOCALES.filter((locale) => requested.has(locale.code));
  return resolved.length
    ? resolved
    : SUPPORTED_LOCALES.filter((locale) => locale.code === 'en-GB');
}
