import type { DraftInvoice, TenantBillingProfile } from '../src/commerce/billingModels';
import { listBillingMeterEvents } from './billingMeterStore';
import { listBillingAdjustments } from './billingAdjustmentStore';
import { buildDraftInvoice, resolveBillingPeriod } from './billingService';

export interface BillingInsightsSnapshot {
  period: { id: string; startsAt: string; endsAt: string };
  eventCount: number;
  successfulOrders: number;
  activeLocations: number;
  activeAccounts: number;
  settledRevenueMinor: number;
  adjustmentCount: number;
  creditsMinor: number;
  adjustmentsMinor: number;
  estimatedInvoice: DraftInvoice;
}

/** Read-only commercial snapshot for Admin/Insights; it never creates a charge or final invoice. */
export async function buildBillingInsightsSnapshot(profile: TenantBillingProfile, atTime = new Date()): Promise<BillingInsightsSnapshot> {
  const period = resolveBillingPeriod(profile, atTime);
  const [events, adjustments] = await Promise.all([
    listBillingMeterEvents({ tenantId: profile.tenantId, startsAt: period.startsAt, endsAt: period.endsAt }),
    listBillingAdjustments({ tenantId: profile.tenantId, periodId: period.id }),
  ]);
  const unique = new Map(events.map((event) => [event.idempotencyKey, event]));
  const deduped = [...unique.values()];
  const successfulOrders = deduped.filter((event) => event.type === 'SUCCESSFUL_ORDER').reduce((sum, event) => sum + event.quantity, 0);
  const activeLocations = new Set(deduped.filter((event) => event.type === 'LOCATION_ACTIVE').map((event) => event.sourceId)).size;
  const activeAccounts = new Set(deduped.filter((event) => event.type === 'ACCOUNT_ACTIVE').map((event) => event.sourceId)).size;
  const settledRevenueMinor = deduped.filter((event) => event.type === 'REVENUE_SETTLED').reduce((sum, event) => sum + (event.amount?.amount || 0), 0);
  const creditsMinor = adjustments
    .filter((adjustment) => adjustment.kind === 'CREDIT')
    .reduce((sum, adjustment) => sum - Math.abs(adjustment.amount.amount), 0);
  const adjustmentsMinor = adjustments
    .filter((adjustment) => adjustment.kind === 'ADJUSTMENT')
    .reduce((sum, adjustment) => sum + adjustment.amount.amount, 0);
  return {
    period,
    eventCount: deduped.length,
    successfulOrders,
    activeLocations,
    activeAccounts,
    settledRevenueMinor,
    adjustmentCount: adjustments.length,
    creditsMinor,
    adjustmentsMinor,
    estimatedInvoice: buildDraftInvoice({
      profile,
      periodId: period.id,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      events: deduped,
      adjustments,
    }),
  };
}
