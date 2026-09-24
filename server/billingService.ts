import type { BillingAdjustment, BillingMeterEvent, BillingRule, DraftInvoice, InvoiceLineItem, TenantBillingProfile } from '../src/commerce/billingModels';
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
  adjustments?: BillingAdjustment[];
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

  const seenAdjustments = new Set<string>();
  for (const adjustment of params.adjustments || []) {
    if (adjustment.tenantId !== profile.tenantId || adjustment.periodId !== periodId) continue;
    if (seenAdjustments.has(adjustment.id)) continue;
    if (adjustment.amount.currency !== profile.currency) {
      throw new Error('Billing adjustment currency must match the tenant billing currency.');
    }
    seenAdjustments.add(adjustment.id);
    const rawAmount = Math.round(adjustment.amount.amount);
    const signedAmount =
      adjustment.kind === 'CREDIT' ? -Math.abs(rawAmount) : rawAmount;
    if (!signedAmount) continue;
    lines.push({
      id: `${periodId}:adjustment:${adjustment.id}`,
      description: adjustment.description,
      quantity: 1,
      amount: money(signedAmount, profile.currency),
      kind: adjustment.kind,
    });
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


function addUtcMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  const targetDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(targetDay, lastDay));
  return result;
}

/** Resolves the billing period containing atTime from the contract anchor. */
export function resolveBillingPeriod(profile: TenantBillingProfile, atTime: string | Date): { id: string; startsAt: string; endsAt: string } {
  const anchor = new Date(profile.anchorDate);
  const at = typeof atTime === 'string' ? new Date(atTime) : new Date(atTime.getTime());
  if (!Number.isFinite(anchor.getTime()) || !Number.isFinite(at.getTime())) throw new Error('Valid billing anchor and time are required.');
  if (at < anchor) throw new Error('Billing time cannot precede the contract anchor.');

  let start = new Date(anchor.getTime());
  let end: Date;
  if (profile.cadence === 'MONTHLY') {
    const monthDelta = (at.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + (at.getUTCMonth() - anchor.getUTCMonth());
    start = addUtcMonths(anchor, Math.max(0, monthDelta));
    if (start > at) start = addUtcMonths(start, -1);
    end = addUtcMonths(start, 1);
  } else {
    const days = profile.cadence === 'FOUR_WEEKLY' ? 28 : 7;
    const intervalMs = days * 24 * 60 * 60 * 1000;
    const periods = Math.floor((at.getTime() - anchor.getTime()) / intervalMs);
    start = new Date(anchor.getTime() + periods * intervalMs);
    end = new Date(start.getTime() + intervalMs);
  }

  const startsAt = start.toISOString();
  const endsAt = end.toISOString();
  return { id: `${startsAt.slice(0, 10)}_${endsAt.slice(0, 10)}`, startsAt, endsAt };
}
