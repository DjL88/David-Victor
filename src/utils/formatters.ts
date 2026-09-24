import { formatMinorCurrency, minorUnitFactor, normalizeCurrencyCode } from '../domain/currency';

export interface MoneyLike {
  amount: number;
  currency?: string;
}

/**
 * Normalizes currency code / symbol
 */


/**
 * Formats an authoritative commerce price in integer minor units (e.g. 25 = £0.25, 500 = £5.00).
 * A missing price (undefined, null, NaN) returns "Price unavailable", NEVER £0.00.
 *
 * Specific verified test cases:
 * - 25 minor units  -> "£0.25"
 * - 50 minor units  -> "£0.50"
 * - 89 minor units  -> "£0.89"
 * - 100 minor units -> "£1.00"
 * - 500 minor units -> "£5.00"
 * - 2500 minor units -> "£25.00"
 * - undefined / null / NaN -> "Price unavailable"
 */
export function formatCurrency(
  amount?: MoneyLike | number | null,
  currencySymbolOrCode: string = 'GBP',
  locale: string = 'en-GB'
): string {
  if (amount === undefined || amount === null) return 'Price unavailable';

  const rawVal = typeof amount === 'object' ? amount.amount : amount;
  if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) return 'Price unavailable';

  // The configured display currency is authoritative. This changes context,
  // never value: no FX conversion occurs here.
  const currencyCode = normalizeCurrencyCode(currencySymbolOrCode);
  const factor = minorUnitFactor(currencyCode);
  const minorUnits = Number.isInteger(rawVal) ? Math.round(rawVal) : Math.round(rawVal * factor);
  return formatMinorCurrency(minorUnits, currencyCode, locale);
}

export function formatMoney(
  amount?: MoneyLike | number | null,
  currency: string = 'GBP'
): string {
  return formatCurrency(amount, currency);
}
export interface StorefrontCurrencyConfig {
  currency?: string;
  currencySymbol?: string;
  locale?: string;
}

/**
 * Formats storefront money using the tenant/account display currency as the
 * authoritative source. Upstream product/bundle Money metadata is retained for
 * provenance but must not override the configured storefront currency.
 */
export function formatStorefrontCurrency(
  amount?: MoneyLike | number | null,
  config?: StorefrontCurrencyConfig | null,
  fallbackCurrency: string = 'GBP'
): string {
  const displayCurrency =
    config?.currency ||
    config?.currencySymbol ||
    fallbackCurrency;
  return formatCurrency(amount, displayCurrency, config?.locale || 'en-GB');
}


export function formatPrice(
  price?: MoneyLike | number | null,
  currency: string = 'GBP'
): string {
  return formatCurrency(price, currency);
}

/**
 * Separate explicit converter for legacy major-unit fields (e.g. £2.50 represented as floating number 2.50).
 * DO NOT use for commerce prices (which are integer minor units).
 * A missing value returns "Price unavailable", NEVER £0.00.
 */
export function formatLegacyMajorUnits(
  majorUnits?: number | null,
  currencySymbolOrCode: string = 'GBP',
  locale: string = 'en-GB'
): string {
  if (majorUnits === undefined || majorUnits === null || !Number.isFinite(majorUnits)) {
    return 'Price unavailable';
  }
  const currencyCode = normalizeCurrencyCode(currencySymbolOrCode);
  const minor = Math.round(majorUnits * minorUnitFactor(currencyCode));
  return formatMinorCurrency(minor, currencyCode, locale);
}

/**
 * Separate explicit converter for legacy pounds values.
 * A missing value returns "Price unavailable", NEVER £0.00.
 */
export function formatPounds(pounds?: number | null): string {
  return formatLegacyMajorUnits(pounds, 'GBP');
}

export function formatDistance(meters?: number | null): string {
  if (meters === undefined || meters === null || isNaN(meters) || !isFinite(meters)) {
    return '0m';
  }
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  const miles = meters / 1609.34;
  return `${(miles || 0).toFixed(1)} mi`;
}

export function formatEta(minutes?: number | null): string {
  if (!minutes || isNaN(minutes) || !isFinite(minutes)) return '20–30 min';
  return `${minutes}–${minutes + 10} min`;
}

export function truncate(str: string, maxLen: number): string {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trim() + '…';
}
