/**
 * Currency metadata and formatting helpers.
 *
 * Currency is display/arithmetic context only. These helpers NEVER perform FX
 * conversion: an integer amount is interpreted in the supplied currency's
 * minor units.
 */
export function normalizeCurrencyCode(currency?: string | null, fallback = 'GBP'): string {
  const candidate = String(currency || fallback).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(candidate) ? candidate : fallback.toUpperCase();
}

export function getCurrencyMinorUnitDigits(currency?: string | null): number {
  const code = normalizeCurrencyCode(currency);
  try {
    const digits = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: code,
    }).resolvedOptions().maximumFractionDigits;
    return Number.isInteger(digits) && digits >= 0 && digits <= 4 ? digits : 2;
  } catch {
    return 2;
  }
}

export function minorUnitFactor(currency?: string | null): number {
  return 10 ** getCurrencyMinorUnitDigits(currency);
}

export function minorToMajor(minorUnits: number, currency?: string | null): number {
  return minorUnits / minorUnitFactor(currency);
}

export function majorToMinor(majorUnits: number, currency?: string | null): number {
  return Math.round(majorUnits * minorUnitFactor(currency));
}

export function formatMinorCurrency(
  minorUnits: number,
  currency?: string | null,
  locale = 'en-GB'
): string {
  const code = normalizeCurrencyCode(currency);
  const safeMinor = Number.isFinite(minorUnits) ? minorUnits : 0;
  const major = minorToMajor(safeMinor, code);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
    }).format(major);
  } catch {
    const digits = getCurrencyMinorUnitDigits(code);
    return `${code} ${major.toFixed(digits)}`;
  }
}
