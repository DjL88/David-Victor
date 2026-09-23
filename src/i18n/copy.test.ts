import { describe, expect, it } from 'vitest';
import { resolveStorefrontCopy } from './copy';
import { TRANSLATIONS } from './translations';

describe('resolveStorefrontCopy', () => {
  it('uses US English retail terminology without duplicating the full dictionary', () => {
    expect(resolveStorefrontCopy({
      key: 'header.basket',
      currentLocale: 'en-US',
      defaultLocale: 'en-GB',
      fallbackLocale: 'en-GB',
      dictionaries: TRANSLATIONS,
    })).toBe('Cart');

    expect(resolveStorefrontCopy({
      key: 'nav.home',
      currentLocale: 'en-US',
      defaultLocale: 'en-GB',
      fallbackLocale: 'en-GB',
      dictionaries: TRANSLATIONS,
    })).toBe('Home');
  });

  it('lets the brand override system wording for an exact locale', () => {
    expect(resolveStorefrontCopy({
      key: 'header.basket',
      currentLocale: 'en-US',
      defaultLocale: 'en-GB',
      fallbackLocale: 'en-GB',
      tenantOverrides: {
        'en-US': { 'header.basket': 'Bag' },
      },
      dictionaries: TRANSLATIONS,
    })).toBe('Bag');
  });

  it('falls back to the tenant default wording before the platform fallback', () => {
    expect(resolveStorefrontCopy({
      key: 'nav.account',
      currentLocale: 'en-US',
      defaultLocale: 'en-GB',
      fallbackLocale: 'en-GB',
      tenantOverrides: {
        'en-GB': { 'nav.account': 'My profile' },
      },
      dictionaries: TRANSLATIONS,
    })).toBe('My profile');
  });
});
