import { beforeEach, describe, expect, it } from 'vitest';
import {
  deriveOrderCodePrefix,
  isoWeekKey,
  normalizeOrderCodePrefix,
  OrderReferenceService,
  toDisplayOrderReference,
} from '../../server/orderReferenceService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('compact order references', () => {
  beforeEach(() => {
    setServerRuntimeMode('demo');
    OrderReferenceService.resetForTest();
  });

  it('derives useful brand initials including camel case names', () => {
    expect(deriveOrderCodePrefix('LeitchTech')).toBe('LT');
    expect(deriveOrderCodePrefix('Daylesford Organic')).toBe('DO');
    expect(deriveOrderCodePrefix('Bwydi')).toBe('BW');
    expect(normalizeOrderCodePrefix(' l-t! ')).toBe('LT');
  });

  it('uses ISO year/week in the compact reference', () => {
    expect(isoWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2601');
    expect(isoWeekKey(new Date('2026-09-23T12:00:00Z'))).toBe('2639');
  });

  it('allocates short tenant-wide weekly references and is idempotent per basket', async () => {
    const first = await OrderReferenceService.reserve({
      tenantId: 'leitchtech',
      basketId: 'basket-1',
      brandName: 'LeitchTech',
      now: new Date('2026-09-23T12:00:00Z'),
    });
    const retry = await OrderReferenceService.reserve({
      tenantId: 'leitchtech',
      basketId: 'basket-1',
      brandName: 'LeitchTech',
      now: new Date('2026-09-23T12:00:00Z'),
    });
    const second = await OrderReferenceService.reserve({
      tenantId: 'leitchtech',
      basketId: 'basket-2',
      brandName: 'LeitchTech',
      now: new Date('2026-09-23T12:00:00Z'),
    });

    expect(first).toBe('LT26390001');
    expect(retry).toBe(first);
    expect(second).toBe('LT26390002');
    expect(first.length).toBe(10);
    expect(toDisplayOrderReference(first)).toBe('LT390001');
  });

  it('honours a configured 2-4 character prefix', async () => {
    const reference = await OrderReferenceService.reserve({
      tenantId: 'brand-a',
      basketId: 'basket-a',
      brandName: 'Ignored Brand',
      configuredPrefix: 'LTX',
      now: new Date('2026-09-23T12:00:00Z'),
    });
    expect(reference).toBe('LTX26390001');
  });
});
