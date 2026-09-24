import { describe, expect, it } from 'vitest';
import { buildDraftInvoice } from '../../server/billingService';
import { validateBillingProfile } from '../../server/billingProfileStore';
import { hasAdminCapability } from '../admin/capabilities';
import { hasServerAdminCapability } from '../../server/admin/adminActionRegistry';
import {
  CreateBillingAdjustmentSchema,
  SaveBillingProfileSchema,
} from '../../server/api/schemas';
import type {
  BillingAdjustment,
  BillingMeterEvent,
  TenantBillingProfile,
} from '../commerce/billingModels';

const profile: TenantBillingProfile = {
  tenantId: 'tenant-a',
  identity: { legalName: 'Tenant A Retail Ltd' },
  currency: 'EUR',
  cadence: 'MONTHLY',
  anchorDate: '2026-09-01T00:00:00.000Z',
  status: 'ACTIVE',
  updatedAt: '2026-09-01T00:00:00.000Z',
  rules: [
    {
      id: 'platform',
      type: 'FIXED_RECURRING',
      label: 'Platform fee',
      active: true,
      unitAmount: { amount: 10000, currency: 'EUR' },
      effectiveFrom: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'order',
      type: 'PER_SUCCESSFUL_ORDER',
      label: 'Successful orders',
      active: true,
      unitAmount: { amount: 20, currency: 'EUR' },
      effectiveFrom: '2026-01-01T00:00:00.000Z',
    },
  ],
};

function event(id: string): BillingMeterEvent {
  return {
    idempotencyKey: id,
    tenantId: 'tenant-a',
    type: 'SUCCESSFUL_ORDER',
    occurredAt: '2026-09-15T12:00:00.000Z',
    sourceType: 'ORDER',
    sourceId: id,
    quantity: 1,
  };
}

describe('billing control plane', () => {
  it('keeps commercial write access platform-only while tenant admins can read their own billing', () => {
    expect(hasAdminCapability('platformSuperAdmin', 'billing.read')).toBe(true);
    expect(hasAdminCapability('platformSuperAdmin', 'billing.manage')).toBe(true);
    expect(hasAdminCapability('tenantAdmin', 'billing.read')).toBe(true);
    expect(hasAdminCapability('tenantAdmin', 'billing.manage')).toBe(false);

    expect(hasServerAdminCapability('platformSuperAdmin', 'billing.manage')).toBe(true);
    expect(hasServerAdminCapability('tenantAdmin', 'billing.manage')).toBe(false);
    expect(hasServerAdminCapability('marketingEditor', 'billing.read')).toBe(false);
  });

  it('applies immutable credits/adjustments exactly once and keeps currency explicit', () => {
    const credit: BillingAdjustment = {
      id: 'credit-1',
      tenantId: 'tenant-a',
      periodId: '2026-09',
      description: 'Service credit',
      amount: { amount: 500, currency: 'EUR' },
      kind: 'CREDIT',
      createdAt: '2026-09-20T00:00:00.000Z',
      createdBy: 'admin-1',
    };

    const invoice = buildDraftInvoice({
      profile,
      periodId: '2026-09',
      startsAt: '2026-09-01T00:00:00.000Z',
      endsAt: '2026-10-01T00:00:00.000Z',
      events: [event('order-1')],
      adjustments: [
        credit,
        { ...credit },
        {
          ...credit,
          id: 'other-tenant',
          tenantId: 'tenant-b',
        },
      ],
    });

    expect(invoice.lines.find((line) => line.id.includes('credit-1'))).toMatchObject({
      kind: 'CREDIT',
      amount: { amount: -500, currency: 'EUR' },
    });
    expect(invoice.lines.filter((line) => line.id.includes('credit-1'))).toHaveLength(1);
    expect(invoice.subtotal.amount).toBe(9520);
    expect(invoice.tax).toBeUndefined();
  });

  it('rejects cross-currency commercial adjustments instead of silently converting them', () => {
    expect(() =>
      buildDraftInvoice({
        profile,
        periodId: '2026-09',
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-10-01T00:00:00.000Z',
        events: [],
        adjustments: [
          {
            id: 'bad-currency',
            tenantId: 'tenant-a',
            periodId: '2026-09',
            description: 'Wrong currency',
            amount: { amount: 100, currency: 'GBP' },
            kind: 'ADJUSTMENT',
            createdAt: '2026-09-20T00:00:00.000Z',
            createdBy: 'admin-1',
          },
        ],
      })
    ).toThrow(/currency/i);
  });

  it('validates commercial contracts rather than accepting ambiguous or duplicate charge rules', () => {
    const stored = {
      ...profile,
      contractVersion: 1,
      agreedAt: '2026-09-01T00:00:00.000Z',
      agreedBy: 'platform-admin',
    };

    expect(() => validateBillingProfile(stored)).not.toThrow();

    expect(() =>
      validateBillingProfile({
        ...stored,
        rules: [stored.rules[0], { ...stored.rules[0] }],
      })
    ).toThrow(/Duplicate billing rule id/i);

    expect(() =>
      validateBillingProfile({
        ...stored,
        rules: [
          {
            id: 'share',
            type: 'REVENUE_SHARE',
            label: 'Revenue share',
            active: true,
            basisPoints: 250,
            revenueBasis: 'SETTLED_ORDER_TOTAL',
            unitAmount: { amount: 10, currency: 'EUR' },
            effectiveFrom: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    ).toThrow(/must not also define a unit amount/i);
  });

  it('validates API payloads with ISO currency and immutable adjustment identifiers', () => {
    expect(
      SaveBillingProfileSchema.safeParse({
        identity: { legalName: 'Tenant A Retail Ltd', billingEmail: 'billing@example.test' },
        currency: 'EUR',
        cadence: 'MONTHLY',
        anchorDate: '2026-09-01T00:00:00.000Z',
        rules: [],
        status: 'DRAFT',
        contractVersion: 1,
      }).success
    ).toBe(true);

    expect(
      SaveBillingProfileSchema.safeParse({
        identity: { legalName: 'Tenant A Retail Ltd' },
        currency: '€',
        cadence: 'MONTHLY',
        anchorDate: '2026-09-01T00:00:00.000Z',
        rules: [],
        status: 'DRAFT',
        contractVersion: 1,
      }).success
    ).toBe(false);

    expect(
      CreateBillingAdjustmentSchema.safeParse({
        id: 'credit-2026-09-001',
        periodId: '2026-09',
        description: 'Service credit',
        amount: { amount: 500, currency: 'EUR' },
        kind: 'CREDIT',
      }).success
    ).toBe(true);
  });
});
