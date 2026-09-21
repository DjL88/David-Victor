/**
 * DeliverectTaxOverlay
 *
 * Produces a VAT breakdown for a customer tax receipt.
 *
 * WHY AN OVERLAY
 * Deliverect does not return tax on the Commerce basket or on the channel
 * order. The live Asda retail order carried `taxes: []` at order level and no
 * per-line VAT, while Uber's own payload carried a full per-item breakdown
 * that Deliverect did not forward. VAT rates live on the catalogue product.
 *
 * So tax is REPORTING ONLY. It is computed from catalogue rates at commit time
 * and never participates in the payable total — Deliverect's payment.total
 * remains authoritative. If our computed gross disagrees with Deliverect's
 * total we emit the receipt WITHOUT a breakdown rather than printing numbers
 * that do not add up to what the customer paid.
 *
 * UK VAT IS TAX-INCLUSIVE: a shelf price of £2.10 at 20% contains £0.35 VAT
 * (210 - round(210 / 1.2) = 210 - 175 = 35). This matches the Uber payload
 * exactly for the same product, which is a useful cross-check.
 */

import type { Money } from './deliverectMoney';
import { normaliseCurrency, zeroMoney } from './deliverectMoney';

/** VAT rate as a decimal: 0.2 for UK standard, 0 for zero-rated. */
export type VatRate = number;

export interface TaxableLine {
  plu: string;
  name: string;
  /** Unit price in minor units, VAT-inclusive. */
  unitPriceMinor: number;
  quantity: number;
  /** From the catalogue. Undefined means unknown, which suppresses the receipt. */
  vatRate?: VatRate;
}

export interface TaxLineBreakdown {
  plu: string;
  name: string;
  quantity: number;
  vatRate: VatRate;
  gross: Money;
  net: Money;
  vat: Money;
}

export interface TaxRateSummary {
  vatRate: VatRate;
  gross: Money;
  net: Money;
  vat: Money;
}

export interface TaxReceipt {
  available: boolean;
  /** Populated when available is false. */
  unavailableReason?: string;
  currency: string;
  lines: TaxLineBreakdown[];
  /** One row per distinct rate — what a VAT receipt actually shows. */
  rateSummaries: TaxRateSummary[];
  totalGross: Money;
  totalNet: Money;
  totalVat: Money;
  computedAt: string;
}

/**
 * Splits a VAT-inclusive gross amount into net and VAT.
 *
 * net = round(gross / (1 + rate)); vat = gross - net.
 * Deriving VAT by subtraction guarantees net + vat === gross exactly, so the
 * receipt always reconciles to the amount charged.
 *
 * The division is done in scaled INTEGER arithmetic rather than float, because
 * real amounts land on exact rounding boundaries: £48.45 at 20% gives exactly
 * 4037.5, and float division of such values is not reliably representable.
 * Scaling keeps the boundary case deterministic (4845 -> net 4038, VAT 807).
 */
const RATE_SCALE = 100_000;

export function splitInclusiveVat(grossMinor: number, rate: VatRate): { netMinor: number; vatMinor: number } {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(`Invalid VAT rate: ${rate}`);
  }
  if (!Number.isInteger(grossMinor)) {
    throw new Error(`VAT split requires integer minor units, received ${grossMinor}`);
  }
  if (rate === 0) return { netMinor: grossMinor, vatMinor: 0 };

  const scaledRate = Math.round(rate * RATE_SCALE);
  const netMinor = Math.round((grossMinor * RATE_SCALE) / (RATE_SCALE + scaledRate));
  return { netMinor, vatMinor: grossMinor - netMinor };
}

export interface BuildTaxReceiptOptions {
  currency?: string;
  fractionalDigits?: number;
  /** Deliverect's authoritative payable total, for reconciliation. */
  authoritativeTotalMinor?: number;
  /**
   * Non-item amounts (bag fee, service charge) with their own rates.
   * The Asda order showed bagFee 40 at 0% while service fees ran at 20%.
   */
  additionalCharges?: Array<{ title: string; amountMinor: number; vatRate?: VatRate }>;
}

export function buildTaxReceipt(lines: TaxableLine[], options: BuildTaxReceiptOptions = {}): TaxReceipt {
  const currency = normaliseCurrency(options.currency);
  const fractionalDigits = options.fractionalDigits ?? 2;
  const money = (amount: number): Money => ({ amount, currency, fractionalDigits });
  const computedAt = new Date().toISOString();

  const emptyReceipt = (reason: string): TaxReceipt => ({
    available: false,
    unavailableReason: reason,
    currency,
    lines: [],
    rateSummaries: [],
    totalGross: zeroMoney(currency, fractionalDigits),
    totalNet: zeroMoney(currency, fractionalDigits),
    totalVat: zeroMoney(currency, fractionalDigits),
    computedAt,
  });

  if (!lines.length) return emptyReceipt('No lines supplied.');

  const missingRates = lines.filter((line) => typeof line.vatRate !== 'number');
  if (missingRates.length > 0) {
    return emptyReceipt(
      `VAT rate missing on ${missingRates.length} of ${lines.length} lines ` +
        `(${missingRates.slice(0, 5).map((l) => l.plu).join(', ')}). ` +
        `A partial VAT receipt would be misleading, so none is produced.`
    );
  }

  const breakdown: TaxLineBreakdown[] = lines.map((line) => {
    if (!Number.isInteger(line.unitPriceMinor) || line.unitPriceMinor < 0) {
      throw new Error(`Line ${line.plu} has a non-integer unit price: ${line.unitPriceMinor}`);
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Line ${line.plu} has an invalid quantity: ${line.quantity}`);
    }
    // VAT is computed on the LINE gross, not per unit, to avoid per-unit
    // rounding being multiplied up.
    const grossMinor = line.unitPriceMinor * line.quantity;
    const { netMinor, vatMinor } = splitInclusiveVat(grossMinor, line.vatRate as VatRate);
    return {
      plu: line.plu,
      name: line.name,
      quantity: line.quantity,
      vatRate: line.vatRate as VatRate,
      gross: money(grossMinor),
      net: money(netMinor),
      vat: money(vatMinor),
    };
  });

  const chargeRows: TaxLineBreakdown[] = (options.additionalCharges || []).map((charge) => {
    const rate = typeof charge.vatRate === 'number' ? charge.vatRate : 0;
    const { netMinor, vatMinor } = splitInclusiveVat(charge.amountMinor, rate);
    return {
      plu: '',
      name: charge.title,
      quantity: 1,
      vatRate: rate,
      gross: money(charge.amountMinor),
      net: money(netMinor),
      vat: money(vatMinor),
    };
  });

  const allRows = [...breakdown, ...chargeRows];

  const byRate = new Map<VatRate, { gross: number; net: number; vat: number }>();
  for (const row of allRows) {
    const bucket = byRate.get(row.vatRate) || { gross: 0, net: 0, vat: 0 };
    bucket.gross += row.gross.amount;
    bucket.net += row.net.amount;
    bucket.vat += row.vat.amount;
    byRate.set(row.vatRate, bucket);
  }

  const rateSummaries: TaxRateSummary[] = Array.from(byRate.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([vatRate, bucket]) => ({
      vatRate,
      gross: money(bucket.gross),
      net: money(bucket.net),
      vat: money(bucket.vat),
    }));

  const totalGrossMinor = allRows.reduce((sum, row) => sum + row.gross.amount, 0);
  const totalVatMinor = allRows.reduce((sum, row) => sum + row.vat.amount, 0);

  // Reconcile against what the customer actually paid.
  if (
    typeof options.authoritativeTotalMinor === 'number' &&
    options.authoritativeTotalMinor !== totalGrossMinor
  ) {
    return emptyReceipt(
      `VAT breakdown gross (${totalGrossMinor}) does not match the Deliverect authoritative total ` +
        `(${options.authoritativeTotalMinor}). This usually means a discount or charge was not supplied to the ` +
        `overlay. Suppressing the receipt rather than issuing one that does not reconcile.`
    );
  }

  return {
    available: true,
    currency,
    lines: allRows,
    rateSummaries,
    totalGross: money(totalGrossMinor),
    totalNet: money(totalGrossMinor - totalVatMinor),
    totalVat: money(totalVatMinor),
    computedAt,
  };
}

/**
 * Reads a VAT rate off a catalogue product. Deliverect exposes this in more
 * than one shape depending on menu type, so probe the known keys and return
 * undefined rather than defaulting to 20% — a wrong default silently
 * overstates VAT on zero-rated groceries, which is most of a grocery basket.
 */
export function readCatalogueVatRate(product: Record<string, any> | undefined): VatRate | undefined {
  if (!product) return undefined;
  const candidates = [
    product.vatRate,
    product.taxRate,
    product.tax,
    product.vat,
    product.taxPercentage,
    product.vatPercentage,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      // Deliverect may send 20 or 0.2. Values above 1 are treated as percentages.
      return candidate > 1 ? candidate / 100 : candidate;
    }
  }
  return undefined;
}
