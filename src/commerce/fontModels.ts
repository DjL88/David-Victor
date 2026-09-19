/**
 * Custom Font Management Domain Model
 * Supports TTF, OTF, WOFF, and WOFF2 formats with backend processing stages.
 */

export type CustomFontFormat = 'ttf' | 'otf' | 'woff' | 'woff2';

export type FontProcessingState =
  | 'UPLOADED'
  | 'VALIDATING'
  | 'PROCESSING'
  | 'READY'
  | 'FAILED';

export interface CustomFont {
  id: string;
  tenantId: string;
  family: string;
  weight: string; // '400', '500', '600', '700', '800'
  style: 'normal' | 'italic';
  format: CustomFontFormat;
  fileName: string;
  fileSize: number; // in bytes
  url?: string; // Published WOFF2 CDN asset URL when READY
  state: FontProcessingState;
  validationErrors?: string[];
  licenseConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantFontConfig {
  headingFontId?: string;
  headingFontFamily?: string;
  headingFallbackChain: string; // e.g. "system-ui, -apple-system, sans-serif"
  bodyFontId?: string;
  bodyFontFamily?: string;
  bodyFallbackChain: string; // e.g. "'Plus Jakarta Sans', system-ui, sans-serif"
  customFonts: CustomFont[];
}

export const DEFAULT_FALLBACK_CHAINS = {
  modernSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  editorialSerif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  grotesqueDisplay: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
};
