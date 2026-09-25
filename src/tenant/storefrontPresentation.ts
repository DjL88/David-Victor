/**
 * Presentation-only storefront presets. All presets must consume the same
 * routes, components and authoritative commerce models.
 */
export const STOREFRONT_PRESENTATION_PRESETS = ['CLASSIC', 'EDITORIAL', 'COMPACT'] as const;
export type StorefrontPresentationPreset = typeof STOREFRONT_PRESENTATION_PRESETS[number];

export interface StorefrontPresentationTokens {
  heroEmphasis: 'standard' | 'high' | 'low';
  discovery: 'balanced' | 'search-led' | 'category-led';
  cardDensity: 'comfortable' | 'compact';
  typeScale: 'standard' | 'expressive' | 'compact';
  radiusScale: number;
  merchandisingGapRem: number;
}

export const STOREFRONT_PRESENTATION_TOKENS: Readonly<Record<StorefrontPresentationPreset, Readonly<StorefrontPresentationTokens>>> = {
  CLASSIC: { heroEmphasis: 'standard', discovery: 'balanced', cardDensity: 'comfortable', typeScale: 'standard', radiusScale: 1, merchandisingGapRem: 1.5 },
  EDITORIAL: { heroEmphasis: 'high', discovery: 'search-led', cardDensity: 'comfortable', typeScale: 'expressive', radiusScale: 1.2, merchandisingGapRem: 2 },
  COMPACT: { heroEmphasis: 'low', discovery: 'category-led', cardDensity: 'compact', typeScale: 'compact', radiusScale: 0.8, merchandisingGapRem: 1 },
};

export function resolveStorefrontPresentationPreset(value?: string | null): StorefrontPresentationPreset {
  return STOREFRONT_PRESENTATION_PRESETS.includes(value as StorefrontPresentationPreset)
    ? value as StorefrontPresentationPreset
    : 'CLASSIC';
}

export function storefrontPresentationTokens(value?: string | null): Readonly<StorefrontPresentationTokens> {
  return STOREFRONT_PRESENTATION_TOKENS[resolveStorefrontPresentationPreset(value)];
}
