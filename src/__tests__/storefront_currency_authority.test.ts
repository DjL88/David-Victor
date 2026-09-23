import { describe, expect, it } from 'vitest';
import { formatCurrency, formatStorefrontCurrency } from '../utils/formatters';

describe('storefront currency authority', () => {
  it('uses the configured storefront currency instead of upstream Money metadata', () => {
    expect(formatCurrency({ amount: 500, currency: 'EUR' }, 'GBP', 'en-GB')).toBe('£5.00');
    expect(formatCurrency({ amount: 500, currency: 'GBP' }, 'EUR', 'de-DE')).toBe('€5,00');
  });

  it('does not perform implicit FX conversion', () => {
    expect(formatCurrency({ amount: 123, currency: 'EUR' }, 'GBP', 'en-GB')).toBe('£1.23');
  });
  it('uses the tenant/account currency for combos, stories and marketing prices', () => {
    const eurTenant = { currency: 'EUR', currencySymbol: '€', locale: 'de-DE' };
    const usdTenant = { currency: 'USD', currencySymbol: '$', locale: 'en-US' };

    expect(formatStorefrontCurrency({ amount: 500, currency: 'GBP' }, eurTenant)).toBe('€5,00');
    expect(formatStorefrontCurrency({ amount: 500, currency: 'GBP' }, usdTenant)).toBe('$5.00');
    expect(formatStorefrontCurrency(125, eurTenant)).toBe('€1,25');
  });

  it('falls back to the source bundle currency only when tenant currency is unavailable', () => {
    expect(formatStorefrontCurrency(500, null, 'EUR')).toBe('€5.00');
  });

});
