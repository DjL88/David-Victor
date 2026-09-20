export interface GoogleFontFamily {
  family: string;
  category: 'sans-serif' | 'display' | 'serif' | 'monospace' | 'handwriting';
  weights: string[];
  popularPairing: string;
  previewText: string;
  recommendedFor: 'heading' | 'body' | 'both';
  isCurated?: boolean;
}

export const GOOGLE_FONTS_CATALOG: GoogleFontFamily[] = [
  {
    family: 'Plus Jakarta Sans',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700', '800'],
    popularPairing: 'Playfair Display',
    previewText: 'Artisan Goods & Fresh Essentials',
    recommendedFor: 'both',
    isCurated: true,
  },
  {
    family: 'Inter',
    category: 'sans-serif',
    weights: ['300', '400', '500', '600', '700'],
    popularPairing: 'Funnel Display',
    previewText: 'Clean modern precision typography',
    recommendedFor: 'body',
    isCurated: true,
  },
  {
    family: 'Funnel Display',
    category: 'display',
    weights: ['500', '600', '700', '800'],
    popularPairing: 'Inter',
    previewText: 'High-Impact Brand Display Headline',
    recommendedFor: 'heading',
    isCurated: true,
  },
  {
    family: 'Outfit',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700', '800'],
    popularPairing: 'Plus Jakarta Sans',
    previewText: 'Geometric elegance for retail',
    recommendedFor: 'both',
    isCurated: true,
  },
  {
    family: 'Poppins',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700'],
    popularPairing: 'Open Sans',
    previewText: 'Friendly and rounded brand character',
    recommendedFor: 'both',
    isCurated: true,
  },
  {
    family: 'DM Sans',
    category: 'sans-serif',
    weights: ['400', '500', '700'],
    popularPairing: 'Playfair Display',
    previewText: 'Sophisticated low-contrast readability',
    recommendedFor: 'both',
    isCurated: true,
  },
  {
    family: 'Playfair Display',
    category: 'serif',
    weights: ['400', '600', '700', '800'],
    popularPairing: 'Plus Jakarta Sans',
    previewText: 'Heritage luxury & artisanal grocer',
    recommendedFor: 'heading',
    isCurated: true,
  },
  {
    family: 'Lora',
    category: 'serif',
    weights: ['400', '500', '600', '700'],
    popularPairing: 'Inter',
    previewText: 'Contemporary calligraphy with brushed curves',
    recommendedFor: 'heading',
    isCurated: true,
  },
  {
    family: 'Fraunces',
    category: 'serif',
    weights: ['400', '600', '700', '800'],
    popularPairing: 'DM Sans',
    previewText: 'Expressive vintage warmth & personality',
    recommendedFor: 'heading',
    isCurated: true,
  },
  {
    family: 'Space Grotesk',
    category: 'display',
    weights: ['400', '500', '600', '700'],
    popularPairing: 'Inter',
    previewText: 'Futuristic technical storefront look',
    recommendedFor: 'heading',
    isCurated: true,
  },
  {
    family: 'Montserrat',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700', '800'],
    popularPairing: 'Lora',
    previewText: 'Urban architectural signage influence',
    recommendedFor: 'both',
    isCurated: true,
  },
  {
    family: 'Manrope',
    category: 'sans-serif',
    weights: ['400', '500', '600', '700', '800'],
    popularPairing: 'Fraunces',
    previewText: 'Open semi-geometric modernist sans',
    recommendedFor: 'both',
    isCurated: true,
  },
  {
    family: 'Cormorant Garamond',
    category: 'serif',
    weights: ['400', '600', '700'],
    popularPairing: 'Plus Jakarta Sans',
    previewText: 'Refined royal cellar & organic selection',
    recommendedFor: 'heading',
    isCurated: true,
  },
  {
    family: 'Cabinet Grotesk',
    category: 'display',
    weights: ['500', '700', '800'],
    popularPairing: 'Inter',
    previewText: 'Bold contemporary retail posters',
    recommendedFor: 'heading',
    isCurated: true,
  },
  {
    family: 'Croogla 4F',
    category: 'display',
    weights: ['400', '700'],
    popularPairing: 'Plus Jakarta Sans',
    previewText: 'bwydi geometric brand typography',
    recommendedFor: 'heading',
    isCurated: true,
  },
];

export function getGoogleFontStylesheetUrl(family: string, weights: string[] = ['400', '600', '700']): string {
  if (family.toLowerCase().includes('croogla')) {
    return 'https://db.onlinewebfonts.com/c/9645b9f58651aa6b35d5e34795cc30b6?family=Croogla4F';
  }
  const formattedFamily = family.replace(/\s+/g, '+');
  const weightsParam = weights.join(';');
  return `https://fonts.googleapis.com/css2?family=${formattedFamily}:wght@${weightsParam}&display=swap`;
}

export function injectGoogleFontLink(family: string, weights?: string[]): void {
  if (typeof document === 'undefined') return;
  const linkId = `google-font-${family.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  if (document.getElementById(linkId)) return;

  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = getGoogleFontStylesheetUrl(family, weights);
  document.head.appendChild(link);
}
