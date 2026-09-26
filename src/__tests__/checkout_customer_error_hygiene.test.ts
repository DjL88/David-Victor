import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from '../i18n/translations';

describe('checkout customer error hygiene', () => {
  it('ships bounded promo failure copy for every supported translation dictionary', () => {
    for (const [locale, dictionary] of Object.entries(TRANSLATIONS)) {
      const message = dictionary['checkout.promoFailure'];
      expect(message, locale).toBeTruthy();
      expect(message.toLowerCase(), locale).not.toContain('provider');
      expect(message.toLowerCase(), locale).not.toContain('session');
      expect(message.toLowerCase(), locale).not.toContain('http');
    }
  });

  it('does not render the hosted payment session id or raw promo exception text', () => {
    const source = readFileSync(
      new URL('../features/checkout/CheckoutModal.tsx', import.meta.url),
      'utf8'
    );

    expect(source).not.toContain('Session: {sessionId}');
    expect(source).not.toMatch(/setPromoError\s*\(\s*err\.message/);
    expect(source).toContain("setPromoError(t('checkout.promoFailure'))");
  });

  it('keeps uncertain checkout outcomes unknown and hides opaque hydration ids', () => {
    const source = readFileSync(
      new URL('../features/checkout/CheckoutModal.tsx', import.meta.url),
      'utf8'
    );

    expect(source).toContain('Order status uncertain');
    expect(source).toContain('Payment status uncertain');
    expect(source).toContain('!failureOutcomeUnknown && (');
    expect(source).toContain('You can safely close this view and check My Orders');
    expect(source).not.toContain('{confirmedOrderId}</p>');
  });
});
