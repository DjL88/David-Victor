/**
 * Domain Money Value Object (integer minor units)
 * Example: £10.00 = 1000 GBP, €52.37 = 5237 EUR
 *
 * Floating-point arithmetic is strictly prohibited for authoritative monetary state.
 */

export interface Money {
  readonly amount: number; // Integer minor units
  readonly currency: string; // ISO 4217 code (e.g. "GBP", "EUR")
  readonly fractionalDigits?: number;
  readonly formatted?: string;
}

export function createMoney(minorUnits: number, currency = 'GBP'): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Money amount must be an integer (minor units), received: ${minorUnits}`);
  }
  return Object.freeze({
    amount: minorUnits,
    currency: currency.toUpperCase(),
  });
}

export function fromMajorUnits(majorUnits: number, currency = 'GBP'): Money {
  const roundedMinor = Math.round(majorUnits * 100);
  return createMoney(roundedMinor, currency);
}

export function toMajorUnits(money: Money): number {
  return money.amount / 100;
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch in addMoney: ${a.currency} vs ${b.currency}`);
  }
  return createMoney(a.amount + b.amount, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch in subtractMoney: ${a.currency} vs ${b.currency}`);
  }
  return createMoney(a.amount - b.amount, a.currency);
}

export function compareMoney(a: Money, b: Money): number {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch in compareMoney: ${a.currency} vs ${b.currency}`);
  }
  return a.amount - b.amount;
}

export function isZeroMoney(money: Money): boolean {
  return money.amount === 0;
}

export function isPositiveMoney(money: Money): boolean {
  return money.amount > 0;
}

export function formatMoney(money: Money, locale = 'en-GB'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(toMajorUnits(money));
  } catch {
    const symbol = money.currency === 'GBP' ? '£' : money.currency === 'EUR' ? '€' : '$';
    return `${symbol}${(money.amount / 100).toFixed(2)}`;
  }
}

export const MoneyUtil = {
  create: createMoney,
  fromMinorUnits: createMoney,
  fromMajorUnits,
  toMajorUnits,
  add: addMoney,
  subtract: subtractMoney,
  compare: compareMoney,
  format: formatMoney,
  isZero: isZeroMoney,
  isPositive: isPositiveMoney,
};

