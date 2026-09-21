import { CustomFont, TenantFontConfig, DEFAULT_FALLBACK_CHAINS } from '../commerce/fontModels';
import { extractCleanFontFamily } from '../commerce/googleFonts';

/**
 * Validates and safely injects font declarations into the DOM.
 * Only fonts in 'READY' state with valid URLs are injected.
 * Unvalidated arbitrary uploads are strictly rejected.
 */
export function applyTenantFonts(config?: TenantFontConfig): void {
  const styleElementId = 'tenant-custom-fonts-runtime';
  let styleEl = document.getElementById(styleElementId) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleElementId;
    document.head.appendChild(styleEl);
  }

  if (!config) {
    styleEl.textContent = '';
    return;
  }

  let cssRules: string[] = [];

  // Filter for approved, validated, CDN-published fonts only
  const readyFonts = (config.customFonts || []).filter(
    (font) => font.state === 'READY' && Boolean(font.url) && font.licenseConfirmed
  );

  readyFonts.forEach((font) => {
    // Escape font family name to prevent CSS injection
    const sanitizedFamily = font.family.replace(/[^a-zA-Z0-9\s-_]/g, '').trim();
    if (!sanitizedFamily) return;

    // Sanitize and validate font URL
    const sanitizedUrl = font.url.replace(/['"\\()<>]/g, '').trim();
    if (!/^https?:\/\//i.test(sanitizedUrl) && !sanitizedUrl.startsWith('/')) {
      return;
    }

    const sanitizedWeight = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'].includes(
      String(font.weight)
    )
      ? font.weight
      : '400';
    const sanitizedStyle = ['normal', 'italic', 'oblique'].includes(String(font.style))
      ? font.style
      : 'normal';

    const formatStr =
      font.format === 'woff2'
        ? "format('woff2')"
        : font.format === 'woff'
        ? "format('woff')"
        : font.format === 'otf'
        ? "format('opentype')"
        : "format('truetype')";

    cssRules.push(`
      @font-face {
        font-family: '${sanitizedFamily}';
        src: url('${sanitizedUrl}') ${formatStr};
        font-weight: ${sanitizedWeight};
        font-style: ${sanitizedStyle};
        font-display: swap;
      }
    `);
  });

  const sanitizedHeadingFamily = config.headingFontFamily ? extractCleanFontFamily(config.headingFontFamily) : '';
  const sanitizedBodyFamily = config.bodyFontFamily ? extractCleanFontFamily(config.bodyFontFamily) : '';

  // Construct fallback chains for heading and body
  const headingFont = sanitizedHeadingFamily
    ? `'${sanitizedHeadingFamily}', ${config.headingFallbackChain || DEFAULT_FALLBACK_CHAINS.modernSans}`
    : config.headingFallbackChain || DEFAULT_FALLBACK_CHAINS.modernSans;

  const bodyFont = sanitizedBodyFamily
    ? `'${sanitizedBodyFamily}', ${config.bodyFallbackChain || DEFAULT_FALLBACK_CHAINS.modernSans}`
    : config.bodyFallbackChain || DEFAULT_FALLBACK_CHAINS.modernSans;

  // Set CSS variables on :root
  cssRules.push(`
    :root {
      --font-heading: ${headingFont};
      --font-body: ${bodyFont};
      --font-carousel-title: ${headingFont};
    }
    h1, h2, h3, h4, h5, h6, .font-heading, [class*="font-heading"] {
      font-family: var(--font-heading) !important;
    }
    #main-promotional-super-carousel h1,
    #main-promotional-super-carousel h2,
    #main-promotional-super-carousel h3,
    .font-carousel-title {
      font-family: var(--font-carousel-title) !important;
    }
    body, p, input, button, select, .font-body {
      font-family: var(--font-body) !important;
    }
  `);

  styleEl.textContent = cssRules.join('\n');
}

/**
 * Simulates backend validation and WOFF2 optimization pipeline.
 * Transitions state: UPLOADED -> VALIDATING -> PROCESSING -> READY (or FAILED).
 */
export async function simulateBackendFontPipeline(
  font: Omit<CustomFont, 'id' | 'state' | 'createdAt' | 'updatedAt'>,
  onStateChange: (state: CustomFont['state'], fontObj?: CustomFont) => void
): Promise<CustomFont> {
  const fontId = `font_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let currentFont: CustomFont = {
    ...font,
    id: fontId,
    state: 'UPLOADED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  onStateChange('UPLOADED', currentFont);

  // Step 1: Validation
  await new Promise((r) => setTimeout(r, 600));
  currentFont = { ...currentFont, state: 'VALIDATING' };
  onStateChange('VALIDATING', currentFont);

  // Validate format and header signatures
  const validFormats = ['ttf', 'otf', 'woff', 'woff2'];
  if (!validFormats.includes(font.format.toLowerCase())) {
    currentFont = {
      ...currentFont,
      state: 'FAILED',
      validationErrors: [`Unsupported font format '${font.format}'. Only TTF, OTF, WOFF, WOFF2 supported.`],
    };
    onStateChange('FAILED', currentFont);
    return currentFont;
  }

  if (!font.licenseConfirmed) {
    currentFont = {
      ...currentFont,
      state: 'FAILED',
      validationErrors: ['Administrator must confirm font licensing permissions.'],
    };
    onStateChange('FAILED', currentFont);
    return currentFont;
  }

  // Step 2: Processing & WOFF2 Conversion
  await new Promise((r) => setTimeout(r, 800));
  currentFont = { ...currentFont, state: 'PROCESSING' };
  onStateChange('PROCESSING', currentFont);

  // Step 3: Published to CDN and Ready
  await new Promise((r) => setTimeout(r, 600));
  currentFont = {
    ...currentFont,
    state: 'READY',
    url: `https://cdn.platform.example/fonts/${font.tenantId}/${fontId}.woff2`,
    updatedAt: new Date().toISOString(),
  };
  onStateChange('READY', currentFont);

  return currentFont;
}
