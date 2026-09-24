import type { BillingMeterEvent, BillingRule, DraftInvoice, InvoiceLineItem, TenantBillingProfile } from '../src/commerce/billingModels';
import type { Money } from '../src/commerce/models';

function money(amount: number, currency: string): Money {
  return { amount: Math.round(amount), currency };
}

function activeRule(rule: BillingRule, at: string): boolean {
  return rule.active && rule.effectiveFrom <= at && (!rule.effectiveUntil || rule.effectiveUntil > at);
}

/**
 * Pure billing calculator. Persistence should store meter events by idempotencyKey,
 * making ingestion create-only. This calculator defensively de-duplicates again so
 * webhook retries can never inflate an invoice.
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

  for (const rule of profile.rules.filter((r) => activeRule(r, endsAt))) {
    let quantity = 0;
    let amount = 0;
    if (rule.type === 'FIXED_RECURRING') {
      quantity = 1;
      amount = rule.unitAmount?.amount || 0;
    } else if (rule.type === 'PER_SUCCESSFUL_ORDER') {
      quantity = events.filter((e) => e.type === 'SUCCESSFUL_ORDER').reduce((sum, e) => sum + e.quantity, 0);
      amount = quantity * (rule.unitAmount?.amount || 0);
    } else if (rule.type === 'PER_LOCATION') {
      quantity = new Set(events.filter((e) => e.type === 'LOCATION_ACTIVE').map((e) => e.sourceId)).size;
      amount = quantity * (rule.unitAmount?.amount || 0);
    } else if (rule.type === 'PER_ACCOUNT') {
      quantity = new Set(events.filter((e) => e.type === 'ACCOUNT_ACTIVE').map((e) => e.sourceId)).size;
      amount = quantity * (rule.unitAmount?.amount || 0);
    } else if (rule.type === 'REVENUE_SHARE') {
      const eligible = events.filter((e) => e.type === 'REVENUE_SETTLED').reduce((sum, e) => sum + (e.amount?.amount || 0), 0);
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
