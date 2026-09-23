import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  getZonedDateParts,
  resolveStoreTimeZone,
  zonedLocalDateTimeToUtc,
} from '../utils/zonedTime';

describe('collection scheduling timezone handling', () => {
  it('converts British Summer Time collection slots to the correct UTC instant', () => {
    expect(
      zonedLocalDateTimeToUtc('2026-07-01', '15:00', 'Europe/London')?.toISOString()
    ).toBe('2026-07-01T14:00:00.000Z');
  });

  it('does not shift winter London collection slots', () => {
    expect(
      zonedLocalDateTimeToUtc('2026-12-01', '15:00', 'Europe/London')?.toISOString()
    ).toBe('2026-12-01T15:00:00.000Z');
  });

  it('round-trips a UTC instant to store-local wall clock time', () => {
    const parts = getZonedDateParts(
      new Date('2026-07-01T14:30:00.000Z'),
      'Europe/London'
    );
    expect(parts.dateString).toBe('2026-07-01');
    expect(parts.timeString).toBe('15:30');
  });

  it('uses a DST-aware timezone fallback for GB stores', () => {
    expect(resolveStoreTimeZone({ address: { country: 'GB' } })).toBe('Europe/London');
  });

  it('projects scheduled retail orders instead of forcing every order to ASAP', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'server/deliverect/DeliverectApiClient.ts'),
      'utf8'
    );

    expect(source).toContain('deliveryIsAsap: !isScheduledMoreThanThirtyMinutesAhead');
    expect(source).toContain('{ pickupTime: scheduledFulfillmentTime }');
    expect(source).not.toContain('deliveryIsAsap: true,\n      placedTime: now');
  });

  it('fails closed when scheduled collection cannot persist its selected slot', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/features/checkout/CheckoutModal.tsx'),
      'utf8'
    );

    expect(source).toContain('Please choose a collection time before placing your order.');
    expect(source).toContain('Scheduled collection is not available on the current integration.');
  });
});
