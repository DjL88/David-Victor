import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STOREFRONT_PRESENTATION_PRESET,
  STOREFRONT_PRESENTATION_PRESETS,
  resolveStorefrontPresentationPreset,
  storefrontPresentationTokens,
} from '../tenant/storefrontPresentation';

describe('storefront presentation presets', () => {
  it('exposes exactly three retailer-selectable presets', () => {
    expect(STOREFRONT_PRESENTATION_PRESETS).toEqual(['CLASSIC', 'EDITORIAL', 'COMPACT']);
  });

  it('keeps the existing storefront as the backwards-compatible default', () => {
    expect(DEFAULT_STOREFRONT_PRESENTATION_PRESET).toBe('CLASSIC');
    expect(resolveStorefrontPresentationPreset()).toBe('CLASSIC');
    expect(resolveStorefrontPresentationPreset(null)).toBe('CLASSIC');
    expect(resolveStorefrontPresentationPreset('unknown')).toBe('CLASSIC');
  });

  it('resolves only presentation tokens and never commerce truth', () => {
    for (const preset of STOREFRONT_PRESENTATION_PRESETS) {
      const tokens = storefrontPresentationTokens(preset);
      expect(Object.keys(tokens).sort()).toEqual([
        'cardDensity',
        'discovery',
        'heroEmphasis',
        'merchandisingGapRem',
        'radiusScale',
        'typeScale',
      ]);
      expect(tokens).not.toHaveProperty('currency');
      expect(tokens).not.toHaveProperty('locale');
      expect(tokens).not.toHaveProperty('products');
      expect(tokens).not.toHaveProperty('routes');
    }
  });
});
