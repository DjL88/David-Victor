import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from '../i18n/translations';
import { SUPPORTED_LOCALE_CODES } from '../i18n/locales';

describe('globalisation content closeout', () => {
  const platformKeys = [
    'tracking.collected',
    'tracking.liveCourier',
    'tracking.track',
    'tracking.progressLabel',
    'cms.add',
    'cms.exploreOffer',
    'cms.locateStores',
    'cms.noStories',
    'cms.productFallback',
    'cms.categoryFallback',
    'cms.storyFallback',
  ] as const;

  it('has dictionaries for every advertised locale or an intentional dialect fallback', () => {
    for (const locale of SUPPORTED_LOCALE_CODES) {
      if (locale === 'en-US') {
        expect(TRANSLATIONS['en-GB']).toBeDefined();
      } else {
        expect(TRANSLATIONS[locale]).toBeDefined();
      }
    }
  });

  it('translates newly shared tracker and CMS platform chrome', () => {
    for (const locale of ['en-GB', 'es-ES', 'fr-FR', 'de-DE']) {
      for (const key of platformKeys) {
        expect(TRANSLATIONS[locale]?.[key]).toBeTruthy();
      }
    }
  });
});
