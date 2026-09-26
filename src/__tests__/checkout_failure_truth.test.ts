import { describe, expect, it } from 'vitest';
import {
  checkoutFailureGuidance,
  safeCheckoutFailureMessage,
} from '../features/checkout/checkoutFailureTruth';

describe('checkout failure truth', () => {
  it('never promises a failed hosted checkout captured no charge', () => {
    const message = safeCheckoutFailureMessage('payment_status_failed');
    const guidance = checkoutFailureGuidance(false);

    expect(message).toContain('could not confirm');
    expect(guidance).toContain('Payment status may still be updating');
    expect(guidance).toContain('Check My Orders');
    expect(guidance.toLowerCase()).not.toContain('no charges');
    expect(guidance.toLowerCase()).not.toContain('not charged');
  });

  it('does not claim an unsuccessful collection definitely created no payment', () => {
    const message = safeCheckoutFailureMessage('order_status_failed', true);
    const guidance = checkoutFailureGuidance(true);

    expect(message).toContain('could not confirm');
    expect(guidance).toContain('Check My Orders');
    expect(guidance.toLowerCase()).not.toContain('no payment');
  });

  it('uses bounded customer-safe messages instead of upstream provider text', () => {
    expect(safeCheckoutFailureMessage('dispatch_check_failed')).toBe(
      'We could not verify courier availability. Please retry before continuing.'
    );
    expect(safeCheckoutFailureMessage('checkout_start_failed')).toBe(
      'We could not start checkout. Please retry.'
    );
  });
});
