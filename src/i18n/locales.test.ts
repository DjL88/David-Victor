import { describe, expect, it } from 'vitest';
import { resolveEnabledLocales, SUPPORTED_LOCALES } from './locales';

describe('resolveEnabledLocales', () => {
  it('keeps the tenant default language enabled', () => {
    const locales = resolveEnabledLocales(['fr-FR'], 'en-GB');
    expect(locales.map((item) => item.code)).toEqual(['en-GB', 'fr-FR']);
  });

  it('uses all supported locales when a tenant has not configured language availability yet', () => {
    const locales = resolveEnabledLocales(undefined, 'en-GB');
    expect(locales.map((item) => item.code)).toEqual(SUPPORTED_LOCALES.map((item) => item.code));
  });

  it('ignores unsupported locale codes', () => {
    const locales = resolveEnabledLocales(['cy-GB', 'de-DE'], 'de-DE');
    expect(locales.map((item) => item.code)).toEqual(['de-DE']);
  });
});
