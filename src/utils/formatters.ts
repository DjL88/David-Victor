export interface MoneyLike {
  amount: number;
  currency?: string;
}

/**
 * Normalizes currency code / symbol
 */
function resolveCurrencySymbol(symbolOrCode: string = 'GBP'): string {
  const upper = (symbolOrCode || '').toUpperCase();
  if (upper === 'GBP' || symbolOrCode === '£') return '£';
  if (upper === 'EUR' || symbolOrCode === '€' || upper === 'E') return '€';
  if (upper === 'USD' || symbolOrCode === '$') return '$';
  return symbolOrCode || '£';
}

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
  if (amount === undefined || amount === null) {
    return 'Price unavailable';
  }

  let minorUnits: number;
  let currencyCode = currencySymbolOrCode;
  // When the caller supplies a currency/code (the storefront does this from
  // tenant Settings), that setting is the display authority. Upstream Money
  // metadata is still useful when no display currency was supplied.
  const hasExplicitDisplayCurrency = arguments.length >= 2;

  if (typeof amount === 'object' && amount !== null && 'amount' in amount) {
    const rawVal = (amount as any).amount;
    if (typeof rawVal !== 'number' || isNaN(rawVal) || !isFinite(rawVal)) {
      return 'Price unavailable';
    }
    minorUnits = !Number.isInteger(rawVal) ? Math.round(rawVal * 100) : Math.round(rawVal);
    if (!hasExplicitDisplayCurrency && (amount as any).currency) {
      currencyCode = (amount as any).currency;
    }
  } else if (typeof amount === 'number') {
    if (isNaN(amount) || !isFinite(amount)) {
      return 'Price unavailable';
    }
    minorUnits = !Number.isInteger(amount) ? Math.round(amount * 100) : Math.round(amount);
  } else {
    return 'Price unavailable';
  }

  const symbol = resolveCurrencySymbol(currencyCode);
  const majorValue = minorUnits / 100;

  const isEuro = symbol === '€' || currencyCode.toUpperCase() === 'EUR';
  const isCommaDecimalLocale =
    locale.toLowerCase().startsWith('de') ||
    locale.toLowerCase().startsWith('fr') ||
    locale.toLowerCase().startsWith('es') ||
    locale.toLowerCase().startsWith('it') ||
    locale.toLowerCase().startsWith('nl');

  if (isEuro && isCommaDecimalLocale) {
    const formattedNum = majorValue.toFixed(2).replace('.', ',');
    return `${symbol}${formattedNum}`;
  }

  return `${symbol}${majorValue.toFixed(2)}`;
}

export function formatMoney(
  amount?: MoneyLike | number | null,
  currency: string = 'GBP'
): string {
  return formatCurrency(amount, currency);
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
  currencySymbolOrCode: string = 'GBP'
): string {
  if (majorUnits === undefined || majorUnits === null || isNaN(majorUnits) || !isFinite(majorUnits)) {
    return 'Price unavailable';
  }
  const symbol = resolveCurrencySymbol(currencySymbolOrCode);
  return `${symbol}${majorUnits.toFixed(2)}`;
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
