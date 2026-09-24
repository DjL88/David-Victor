import { describe, expect, it } from 'vitest';
import { buildDraftInvoice, resolveBillingPeriod } from '../../server/billingService';
import type { TenantBillingProfile, BillingMeterEvent } from '../commerce/billingModels';

const profile: TenantBillingProfile = {
  tenantId: 'brand-alpha',
  identity: { legalName: 'Alpha Retail Ltd' },
  currency: 'GBP',
  cadence: 'MONTHLY',
  anchorDate: '2026-09-01T00:00:00.000Z',
  status: 'ACTIVE',
  updatedAt: '2026-09-01T00:00:00.000Z',
  rules: [
    { id: 'platform', type: 'FIXED_RECURRING', label: 'Platform fee', active: true, unitAmount: { amount: 10000, currency: 'GBP' }, effectiveFrom: '2026-01-01T00:00:00.000Z' },
    { id: 'order', type: 'PER_SUCCESSFUL_ORDER', label: 'Orders', active: true, unitAmount: { amount: 20, currency: 'GBP' }, effectiveFrom: '2026-01-01T00:00:00.000Z' },
    { id: 'location', type: 'PER_LOCATION', label: 'Active locations', active: true, unitAmount: { amount: 500, currency: 'GBP' }, effectiveFrom: '2026-01-01T00:00:00.000Z' },
    { id: 'share', type: 'REVENUE_SHARE', label: 'Revenue share', active: true, basisPoints: 250, revenueBasis: 'SETTLED_ORDER_TOTAL', effectiveFrom: '2026-01-01T00:00:00.000Z' },
  ],
};

function event(overrides: Partial<BillingMeterEvent>): BillingMeterEvent {
  return { idempotencyKey: 'evt-1', tenantId: 'brand-alpha', type: 'SUCCESSFUL_ORDER', occurredAt: '2026-09-10T12:00:00.000Z', sourceType: 'ORDER', sourceId: 'order-1', quantity: 1, ...overrides };
}

describe('commercial billing metering', () => {
  it('does not double-charge a retried event', () => {
    const same = event({});
    const invoice = buildDraftInvoice({ profile, periodId: '2026-09', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z', events: [same, { ...same }] });
    expect(invoice.lines.find((l) => l.ruleId === 'order')?.amount.amount).toBe(20);
  });

  it('supports fixed, per-location, per-order and percentage-share rules without inventing tax', () => {
    const events: BillingMeterEvent[] = [
      event({ idempotencyKey: 'order-1' }),
      event({ idempotencyKey: 'order-2', sourceId: 'order-2' }),
      event({ idempotencyKey: 'loc-1', type: 'LOCATION_ACTIVE', sourceType: 'LOCATION', sourceId: 'store-a' }),
      event({ idempotencyKey: 'loc-1-again', type: 'LOCATION_ACTIVE', sourceType: 'LOCATION', sourceId: 'store-a' }),
      event({ idempotencyKey: 'revenue-1', type: 'REVENUE_SETTLED', amount: { amount: 10000, currency: 'GBP' }, metadata: { revenueBasis: 'SETTLED_ORDER_TOTAL' } }),
    ];
    const invoice = buildDraftInvoice({ profile, periodId: '2026-09', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z', events, createdAt: '2026-10-01T00:00:00.000Z' });
    expect(invoice.lines.find((l) => l.ruleId === 'platform')?.amount.amount).toBe(10000);
    expect(invoice.lines.find((l) => l.ruleId === 'order')?.amount.amount).toBe(40);
    expect(invoice.lines.find((l) => l.ruleId === 'location')?.amount.amount).toBe(500);
    expect(invoice.lines.find((l) => l.ruleId === 'share')?.amount.amount).toBe(250);
    expect(invoice.subtotal.amount).toBe(10790);
    expect(invoice.tax).toBeUndefined();
    expect(invoice.total.amount).toBe(10790);
  });

  it('ignores events from another tenant or outside the billing period', () => {
    const invoice = buildDraftInvoice({ profile, periodId: '2026-09', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z', events: [event({ tenantId: 'brand-beta' }), event({ idempotencyKey: 'old', occurredAt: '2026-08-31T23:59:59.000Z' })] });
    expect(invoice.lines.some((l) => l.ruleId === 'order')).toBe(false);
  });

  it('does not apply a new commercial rate to usage before its effective date', () => {
    const changedProfile: TenantBillingProfile = {
      ...profile,
      rules: [{ id: 'new-rate', type: 'PER_SUCCESSFUL_ORDER', label: 'New order rate', active: true, unitAmount: { amount: 50, currency: 'GBP' }, effectiveFrom: '2026-09-15T00:00:00.000Z' }],
    };
    const invoice = buildDraftInvoice({ profile: changedProfile, periodId: '2026-09', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z', events: [event({ idempotencyKey: 'before', occurredAt: '2026-09-10T12:00:00.000Z' }), event({ idempotencyKey: 'after', sourceId: 'order-2', occurredAt: '2026-09-20T12:00:00.000Z' })] });
    expect(invoice.lines.find((l) => l.ruleId === 'new-rate')?.amount.amount).toBe(50);
  });

  it('only applies revenue share to the contractually selected revenue basis', () => {
    const invoice = buildDraftInvoice({ profile, periodId: '2026-09', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-01T00:00:00.000Z', events: [
      event({ idempotencyKey: 'total', type: 'REVENUE_SETTLED', amount: { amount: 10000, currency: 'GBP' }, metadata: { revenueBasis: 'SETTLED_ORDER_TOTAL' } }),
      event({ idempotencyKey: 'ex-vat', type: 'REVENUE_SETTLED', amount: { amount: 8000, currency: 'GBP' }, metadata: { revenueBasis: 'SETTLED_MERCHANDISE_EX_VAT' } }),
    ] });
    expect(invoice.lines.find((l) => l.ruleId === 'share')?.amount.amount).toBe(250);
  });
  it('resolves contract-anchored monthly, weekly and four-weekly periods', () => {
    expect(resolveBillingPeriod(profile, '2026-09-24T12:00:00.000Z')).toEqual({
      id: '2026-09-01_2026-10-01',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-10-01T00:00:00.000Z',
    });
    const weekly = { ...profile, cadence: 'WEEKLY' as const };
    expect(resolveBillingPeriod(weekly, '2026-09-15T12:00:00.000Z').startsAt).toBe('2026-09-15T00:00:00.000Z');
    const fourWeekly = { ...profile, cadence: 'FOUR_WEEKLY' as const };
    expect(resolveBillingPeriod(fourWeekly, '2026-09-29T00:00:00.000Z').startsAt).toBe('2026-09-29T00:00:00.000Z');
  });
});
