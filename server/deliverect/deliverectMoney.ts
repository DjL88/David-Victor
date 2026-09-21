/**
 * Deliverect money contract — proven against real staging + production payloads.
 *
 * EVIDENCE (do not change these rules without new evidence):
 *
 * 1. All Deliverect monetary values are INTEGER MINOR UNITS.
 *      BWYDI-STG-1789971843742  VIC1011  price 210   -> £2.10
 *      BWYDI-STG-1789972369266  JOE1007  price 245   -> £2.45
 *    `decimalDigits` on the order states the exponent (2 for GBP).
 *    NEVER multiply by 100. NEVER divide by 100 before display formatting.
 *
 * 2. `item.price` is the UNIT price, NOT the line total.
 *      BWYDI-STG-1789978898793  DLV1016  price 1615  quantity 3
 *        payment.amount = 4845 = 1615 * 3                         [PROVEN]
 *    Cross-confirmed on a live Uber Eats retail order (Asda Leicester):
 *      plu 36700072  price 1120  quantity 2 -> Uber line total £22.40
 *      plu 48090202  price  435  quantity 2 -> Uber line total  £8.70
 *
 * 3. Deliverect is authoritative for basket/checkout arithmetic. Bwydi never
 *    computes a payable total. We derive line totals only for DISPLAY, and we
 *    reconcile them against Deliverect's own total; a mismatch is a hard error.
 *
 * 4. Tax is NOT present on the Commerce basket or the channel order.
 *    The Asda order carries `taxes: []` at order level with no per-line VAT.
 *    VAT lives on the catalogue product. See DeliverectTaxOverlay.ts — tax is
 *    a reporting overlay applied at order commit, never an input to the total.
 */

export interface Money {
  amount: number;
  currency: string;
  fractionalDigits?: number;
  formatted?: string;
}

const DEFAULT_CURRENCY = 'GBP';
const DEFAULT_FRACTIONAL_DIGITS = 2;

export class DeliverectMoneyError extends Error {
  readonly code = 'DELIVERECT_MONEY_CONTRACT_VIOLATION';
  readonly field: string;
  readonly received: unknown;

  constructor(field: string, received: unknown, detail?: string) {
    super(
      `Deliverect money contract violation at "${field}": expected a non-negative integer ` +
        `in minor units, received ${JSON.stringify(received)}.${detail ? ` ${detail}` : ''} ` +
        `Refusing to guess a monetary value.`
    );
    this.name = 'DeliverectMoneyError';
    this.field = field;
    this.received = received;
  }
}

/** Normalises a currency code, defaulting to GBP. Deliverect omits it on some models. */
export function normaliseCurrency(raw: unknown, fallback = DEFAULT_CURRENCY): string {
  if (typeof raw === 'string' && /^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  return fallback;
}

/** Reads `decimalDigits` from a Deliverect payload. Do not assume 2 — zero-decimal currencies exist. */
export function readFractionalDigits(raw: unknown): number {
  const value = (raw as any)?.decimalDigits;
  if (Number.isInteger(value) && value >= 0 && value <= 4) return value;
  return DEFAULT_FRACTIONAL_DIGITS;
}

/**
 * Converts a raw Deliverect integer into Money. Throws rather than coercing:
 * a silent 0 here becomes a wrong customer-facing price.
 *
 * `allowNegative` is required for discounts, which Deliverect sends as
 * `discountTotal: -1197` on the final order while the per-discount entries in
 * `discounts[]` are positive magnitudes.
 */
export function toMinorMoney(
  raw: unknown,
  field: string,
  options: { currency?: string; fractionalDigits?: number; allowNegative?: boolean } = {}
): Money {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new DeliverectMoneyError(field, raw, 'Value was not a finite number.');
  }
  if (!Number.isInteger(raw)) {
    throw new DeliverectMoneyError(
      field,
      raw,
      'Value was fractional. Deliverect sends minor units as integers; a fractional value means the upstream contract changed.'
    );
  }
  if (raw < 0 && !options.allowNegative) {
    throw new DeliverectMoneyError(field, raw, 'Negative amount is not permitted for this field.');
  }
  return {
    amount: raw,
    currency: normaliseCurrency(options.currency),
    fractionalDigits: options.fractionalDigits ?? DEFAULT_FRACTIONAL_DIGITS,
  };
}

/** Optional variant: returns undefined when the field is absent, throws when present but malformed. */
export function toOptionalMinorMoney(
  raw: unknown,
  field: string,
  options: { currency?: string; fractionalDigits?: number; allowNegative?: boolean } = {}
): Money | undefined {
  if (raw === null || raw === undefined) return undefined;
  return toMinorMoney(raw, field, options);
}

export function zeroMoney(currency = DEFAULT_CURRENCY, fractionalDigits = DEFAULT_FRACTIONAL_DIGITS): Money {
  return { amount: 0, currency: normaliseCurrency(currency), fractionalDigits };
}

/**
 * Line total = unit price * quantity. DISPLAY ONLY.
 * This never feeds a checkout amount; see getAuthoritativeTotalMinor().
 */
export function lineTotal(unitPrice: Money, quantity: number, field: string): Money {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DeliverectMoneyError(`${field}.quantity`, quantity, 'Quantity must be a positive integer.');
  }
  return { ...unitPrice, amount: unitPrice.amount * quantity };
}

export function addMoney(a: Money, b: Money, field = 'sum'): Money {
  if (a.currency !== b.currency) {
    throw new DeliverectMoneyError(field, [a.currency, b.currency], 'Cannot add different currencies.');
  }
  return { ...a, amount: a.amount + b.amount };
}

export function sumMoney(values: Money[], currency = DEFAULT_CURRENCY, field = 'sum'): Money {
  return values.reduce((acc, value) => addMoney(acc, value, field), zeroMoney(currency));
}

/** Minor units -> display string. The only place division by 10^n is legitimate. */
export function formatMoney(money: Money, locale = 'en-GB'): string {
  const digits = money.fractionalDigits ?? DEFAULT_FRACTIONAL_DIGITS;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(money.amount / Math.pow(10, digits));
  } catch {
    return `${money.currency} ${(money.amount / Math.pow(10, digits)).toFixed(digits)}`;
  }
}

export function withFormatted(money: Money, locale = 'en-GB'): Money {
  return { ...money, formatted: formatMoney(money, locale) };
}
