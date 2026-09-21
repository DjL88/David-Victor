/**
 * Contract tests built from REAL payloads, not invented fixtures.
 *
 * These lock in the two facts that everything else depends on:
 *   1. Deliverect money is integer minor units.
 *   2. item.price is the UNIT price, so line total = price * quantity.
 *
 * If Deliverect ever changes either, these fail loudly rather than the
 * storefront quietly showing wrong prices.
 */

import { describe, it, expect } from 'vitest';
import { toMinorMoney, lineTotal } from './deliverectMoney';
import { splitInclusiveVat, buildTaxReceipt } from './DeliverectTaxOverlay';

describe('Deliverect money contract', () => {
  it('treats item.price as integer minor units', () => {
    // BWYDI-STG-1789971843742 — Victor's Butter 250g
    expect(toMinorMoney(210, 'price').amount).toBe(210);
    // BWYDI-STG-1789972369266 — Joe's Strawberries 227g
    expect(toMinorMoney(245, 'price').amount).toBe(245);
  });

  it('rejects fractional prices rather than rounding them', () => {
    expect(() => toMinorMoney(2.1, 'price')).toThrow(/fractional/i);
  });

  it('rejects non-numeric prices rather than defaulting to zero', () => {
    expect(() => toMinorMoney(undefined, 'price')).toThrow(/not a finite number/i);
    expect(() => toMinorMoney(null, 'price')).toThrow();
    expect(() => toMinorMoney('210', 'price')).toThrow();
  });
});

describe('unit price vs line total — the quantity-3 proof', () => {
  it('reproduces BWYDI-STG-1789978898793 exactly', () => {
    // Deliverect Triple Distilled Vodka 70cl, price 1615, quantity 3.
    // The order reported payment.amount 4845.
    const unit = toMinorMoney(1615, 'items[0].price');
    const total = lineTotal(unit, 3, 'items[0]');
    expect(total.amount).toBe(4845);
  });

  it('matches the live Uber Eats retail order line totals', () => {
    // Asda Leicester, order dbd4651e. Deliverect stored unit prices; Uber's
    // own breakdown gave the line totals. They agree.
    expect(lineTotal(toMinorMoney(1120, 'p'), 2, 'l').amount).toBe(2240); // Tukituki £22.40
    expect(lineTotal(toMinorMoney(435, 'p'), 2, 'l').amount).toBe(870); // Peroni  £8.70
    expect(lineTotal(toMinorMoney(210, 'p'), 1, 'l').amount).toBe(210); // Apple juice £2.10
  });

  it('rejects zero and negative quantities', () => {
    const unit = toMinorMoney(1615, 'price');
    expect(() => lineTotal(unit, 0, 'l')).toThrow();
    expect(() => lineTotal(unit, -1, 'l')).toThrow();
    expect(() => lineTotal(unit, 1.5, 'l')).toThrow();
  });
});

describe('VAT overlay against the Uber Eats mixed-rate order', () => {
  it('splits 20% inclusive VAT the same way Uber did', () => {
    // Apple juice line: gross £2.10, Uber reported net £1.75, VAT £0.35.
    expect(splitInclusiveVat(210, 0.2)).toEqual({ netMinor: 175, vatMinor: 35 });
    // Tukituki line: gross £22.40, Uber reported net £18.67, VAT £3.73.
    expect(splitInclusiveVat(2240, 0.2)).toEqual({ netMinor: 1867, vatMinor: 373 });
    // Peroni line: gross £8.70, Uber reported net £7.25, VAT £1.45.
    expect(splitInclusiveVat(870, 0.2)).toEqual({ netMinor: 725, vatMinor: 145 });
  });

  it('leaves zero-rated grocery lines untouched', () => {
    // Limes, rocket, grapes etc. were all rate 0 in the Uber breakdown.
    expect(splitInclusiveVat(170, 0)).toEqual({ netMinor: 170, vatMinor: 0 });
    expect(splitInclusiveVat(100, 0)).toEqual({ netMinor: 100, vatMinor: 0 });
  });

  it('tightly guarantees net + vat always equals gross', () => {
    for (let gross = 1; gross <= 5000; gross += 7) {
      const { netMinor, vatMinor } = splitInclusiveVat(gross, 0.2);
      expect(netMinor + vatMinor).toBe(gross);
    }
  });

  it('suppresses the receipt when any VAT rate is unknown', () => {
    const receipt = buildTaxReceipt([
      { plu: 'A', name: 'Known', unitPriceMinor: 210, quantity: 1, vatRate: 0.2 },
      { plu: 'B', name: 'Unknown', unitPriceMinor: 170, quantity: 1 },
    ]);
    expect(receipt.available).toBe(false);
    expect(receipt.unavailableReason).toMatch(/VAT rate missing/i);
  });

  it('suppresses the receipt when the breakdown does not reconcile', () => {
    const receipt = buildTaxReceipt(
      [{ plu: 'A', name: 'Vodka', unitPriceMinor: 1615, quantity: 3, vatRate: 0.2 }],
      { authoritativeTotalMinor: 9999 }
    );
    expect(receipt.available).toBe(false);
    expect(receipt.unavailableReason).toMatch(/does not match/i);
  });

  it('produces a reconciling receipt for the real vodka order', () => {
    const receipt = buildTaxReceipt(
      [{ plu: 'DLV1016', name: 'Deliverect Triple Distilled Vodka 70cl', unitPriceMinor: 1615, quantity: 3, vatRate: 0.2 }],
      { authoritativeTotalMinor: 4845 }
    );
    expect(receipt.available).toBe(true);
    expect(receipt.totalGross.amount).toBe(4845);
    // 4845 at 20% inclusive lands on an exact rounding boundary (4037.5).
    // Integer-scaled division resolves it to net 4038 / VAT 807.
    expect(receipt.totalNet.amount).toBe(4038);
    expect(receipt.totalVat.amount).toBe(807);
    expect(receipt.totalNet.amount + receipt.totalVat.amount).toBe(receipt.totalGross.amount);
  });
});
