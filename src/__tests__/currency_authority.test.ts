import { describe, expect, it } from 'vitest';
import { formatCurrency } from '../utils/formatters';

describe('storefront currency authority', () => {
  it('uses tenant settings when upstream Money metadata has another currency', () => {
    expect(formatCurrency({ amount: 500, currency: 'EUR' }, 'GBP')).toBe('£5.00');
    expect(formatCurrency({ amount: 500, currency: 'EUR' }, '£')).toBe('£5.00');
  });

  it('still respects Money currency when no storefront display currency is supplied', () => {
    expect(formatCurrency({ amount: 500, currency: 'EUR' })).toBe('€5.00');
  });
});
