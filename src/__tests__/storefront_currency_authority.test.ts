import { describe, expect, it } from 'vitest';
import { formatCurrency } from '../utils/formatters';

describe('storefront currency authority', () => {
  it('uses the configured storefront currency instead of upstream Money metadata', () => {
    expect(formatCurrency({ amount: 500, currency: 'EUR' }, 'GBP', 'en-GB')).toBe('£5.00');
    expect(formatCurrency({ amount: 500, currency: 'GBP' }, 'EUR', 'de-DE')).toBe('€5,00');
  });

  it('does not perform implicit FX conversion', () => {
    expect(formatCurrency({ amount: 123, currency: 'EUR' }, 'GBP', 'en-GB')).toBe('£1.23');
  });
});
