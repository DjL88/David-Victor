export interface MoneyLike {
  amount: number;
  currency?: string;
}

export function formatCurrency(
  amount?: MoneyLike | number | null,
  currencySymbol: string = '£',
  locale: string = 'en-GB'
): string {
  // Normalize currency code to symbol
  let activeSymbol = currencySymbol;
  if (activeSymbol === 'GBP') activeSymbol = '£';
  else if (activeSymbol === 'EUR' || activeSymbol === 'E') activeSymbol = '€';
  else if (activeSymbol === 'USD') activeSymbol = '$';

  const isEuro =
    activeSymbol === '€' ||
    locale.toLowerCase().includes('de') ||
    locale.toLowerCase().includes('fr') ||
    locale.toLowerCase().includes('es') ||
    (typeof amount === 'object' && amount !== null && (amount.currency === 'EUR' || amount.currency === '€'));

  if (isEuro) activeSymbol = '€';

  let numValue = 0;
  if (amount === undefined || amount === null) {
    numValue = 0;
  } else if (typeof amount === 'object' && amount !== null && 'amount' in amount) {
    const rawVal = (amount as any).amount;
    if (typeof rawVal === 'number' && !isNaN(rawVal) && isFinite(rawVal)) {
      numValue = rawVal / 100;
    }
  } else if (typeof amount === 'number' && !isNaN(amount) && isFinite(amount)) {
    // If it's a decimal (e.g. 0.89, 1.50, 34.80), it is already in major units (pounds/euros/dollars).
    // If it's a small integer (< 50, e.g. 1, 2, 5, 20), it represents major units (£1.00, £5.00).
    // Only integers >= 50 (e.g. 89, 150, 1000) represent minor units (pence / cents) if passed as raw numbers.
    if (!Number.isInteger(amount) || Math.abs(amount) < 50) {
      numValue = amount;
    } else {
      numValue = amount / 100;
    }
  }

  // Comma decimal separator is only used for European locales that use commas (e.g. de, fr, es, it, nl)
  const isCommaDecimalLocale =
    locale.toLowerCase().startsWith('de') ||
    locale.toLowerCase().startsWith('fr') ||
    locale.toLowerCase().startsWith('es') ||
    locale.toLowerCase().startsWith('it') ||
    locale.toLowerCase().startsWith('nl');

  if (isEuro && isCommaDecimalLocale) {
    const formattedNum = numValue.toFixed(2).replace('.', ',');
    return `${activeSymbol}${formattedNum}`;
  }

  return `${activeSymbol}${numValue.toFixed(2)}`;
}

export function formatMoney(
  amount?: MoneyLike | number | null,
  currencySymbol: string = '£'
): string {
  return formatCurrency(amount, currencySymbol);
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
