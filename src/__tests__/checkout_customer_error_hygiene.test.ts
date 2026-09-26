import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TRANSLATIONS } from '../i18n/translations';
import { safeCheckoutFailureMessage } from '../features/checkout/checkoutFailureTruth';

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

  it('ships localised unknown-status copy for every supported translation dictionary', () => {
    for (const [locale, dictionary] of Object.entries(TRANSLATIONS)) {
      const message = dictionary['checkout.statusUnknown'];
      expect(message, locale).toBeTruthy();
      expect(message.trim().length, locale).toBeGreaterThan(6);
    }
  });

  it('distinguishes explicit checkout failure from an unknown final outcome', () => {
    expect(safeCheckoutFailureMessage('order_failed', true)).toContain('could not be placed');
    expect(safeCheckoutFailureMessage('checkout_request_unknown')).toContain('could not confirm');
    expect(safeCheckoutFailureMessage('order_status_failed', true)).toContain('could not confirm');
    expect(safeCheckoutFailureMessage('payment_status_failed')).toContain('could not confirm');
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

  it('does not expose opaque confirmed-order ids or offer duplicate-attempt CTAs when outcome is unknown', () => {
    const source = readFileSync(
      new URL('../features/checkout/CheckoutModal.tsx', import.meta.url),
      'utf8'
    );

    expect(source).not.toMatch(/>\s*\{confirmedOrderId\}\s*</);
    expect(source).toContain("t('checkout.statusUnknown')");
    expect(source).toContain('setCheckoutOutcomeUncertain(true)');
    expect(source).toContain('{!checkoutOutcomeUncertain && (');
    expect(source).toContain("safeCheckoutFailureMessage('checkout_request_unknown', isCollection)");
  });
});
