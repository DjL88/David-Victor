import type { BillingMeterEvent, BillingRule, DraftInvoice, InvoiceLineItem, TenantBillingProfile } from '../src/commerce/billingModels';
import type { Money } from '../src/commerce/models';

function money(amount: number, currency: string): Money {
  return { amount: Math.round(amount), currency };
}

function ruleOverlapsPeriod(rule: BillingRule, startsAt: string, endsAt: string): boolean {
  return rule.active && rule.effectiveFrom < endsAt && (!rule.effectiveUntil || rule.effectiveUntil > startsAt);
}

function eventEligibleForRule(event: BillingMeterEvent, rule: BillingRule): boolean {
  if (event.occurredAt < rule.effectiveFrom) return false;
  if (rule.effectiveUntil && event.occurredAt >= rule.effectiveUntil) return false;
  return true;
}

/**
 * Pure billing calculator. Persistence stores meter events by idempotencyKey,
 * making ingestion create-only. This calculator defensively de-duplicates again so
 * webhook retries can never inflate an invoice.
 *
 * Usage is also constrained to each rule's effective window. This matters when a
 * commercial agreement changes mid-period: historic events must never be priced by
 * a new rule merely because that rule is active at invoice-generation time.
 */
export function buildDraftInvoice(params: {
  profile: TenantBillingProfile;
  periodId: string;
  startsAt: string;
  endsAt: string;
  events: BillingMeterEvent[];
  createdAt?: string;
}): DraftInvoice {
  const { profile, periodId, startsAt, endsAt } = params;
  const unique = new Map<string, BillingMeterEvent>();
  for (const event of params.events) {
    if (event.tenantId !== profile.tenantId) continue;
    if (event.occurredAt < startsAt || event.occurredAt >= endsAt) continue;
    if (!unique.has(event.idempotencyKey)) unique.set(event.idempotencyKey, event);
  }
  const events = [...unique.values()];
  const lines: InvoiceLineItem[] = [];

  for (const rule of profile.rules.filter((r) => ruleOverlapsPeriod(r, startsAt, endsAt))) {
    const eligibleEvents = events.filter((event) => eventEligibleForRule(event, rule));
    let quantity = 0;
    let amount = 0;
    if (rule.type === 'FIXED_RECURRING') {
      quantity = 1;
      amount = rule.unitAmount?.amount || 0;
    } else if (rule.type === 'PER_SUCCESSFUL_ORDER') {
      quantity = eligibleEvents.filter((e) => e.type === 'SUCCESSFUL_ORDER').reduce((sum, e) => sum + e.quantity, 0);
      amount = quantity * (rule.unitAmount?.amount || 0);
    } else if (rule.type === 'PER_LOCATION') {
      quantity = new Set(eligibleEvents.filter((e) => e.type === 'LOCATION_ACTIVE').map((e) => e.sourceId)).size;
      amount = quantity * (rule.unitAmount?.amount || 0);
    } else if (rule.type === 'PER_ACCOUNT') {
      quantity = new Set(eligibleEvents.filter((e) => e.type === 'ACCOUNT_ACTIVE').map((e) => e.sourceId)).size;
      amount = quantity * (rule.unitAmount?.amount || 0);
    } else if (rule.type === 'REVENUE_SHARE') {
      const eligible = eligibleEvents
        .filter((e) => e.type === 'REVENUE_SETTLED')
        .filter((e) => !rule.revenueBasis || e.metadata?.revenueBasis === rule.revenueBasis)
        .reduce((sum, e) => sum + (e.amount?.amount || 0), 0);
      quantity = eligible;
      amount = Math.round(eligible * (rule.basisPoints || 0) / 10_000);
    }
    if (!amount) continue;
    lines.push({ id: `${periodId}:${rule.id}`, ruleId: rule.id, description: rule.label, quantity, unitAmount: rule.unitAmount, amount: money(amount, profile.currency), kind: rule.type === 'FIXED_RECURRING' ? 'RECURRING' : 'USAGE' });
  }

  const subtotalAmount = lines.reduce((sum, line) => sum + line.amount.amount, 0);
  return {
    id: `draft:${profile.tenantId}:${periodId}`,
    tenantId: profile.tenantId,
    periodId,
    identitySnapshot: { ...profile.identity },
    currency: profile.currency,
    lines,
    subtotal: money(subtotalAmount, profile.currency),
    total: money(subtotalAmount, profile.currency),
    createdAt: params.createdAt || new Date().toISOString(),
  };
}
