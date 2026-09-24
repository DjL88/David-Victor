import type { Money } from './models';

export type BillingCadence = 'WEEKLY' | 'FOUR_WEEKLY' | 'MONTHLY';
export type BillingRuleType = 'FIXED_RECURRING' | 'PER_LOCATION' | 'PER_ACCOUNT' | 'PER_SUCCESSFUL_ORDER' | 'REVENUE_SHARE';

export interface BillingIdentity {
  legalName: string;
  legalAddress?: string;
  vatRegistrationNumber?: string;
  billingEmail?: string;
}

export interface BillingRule {
  id: string;
  type: BillingRuleType;
  label: string;
  active: boolean;
  /** Fixed/per-unit amount in integer minor units. */
  unitAmount?: Money;
  /** Revenue share in basis points: 250 = 2.5%. */
  basisPoints?: number;
  /** Explicit basis prevents ambiguous percentage contracts. */
  revenueBasis?: 'SETTLED_MERCHANDISE_EX_VAT' | 'SETTLED_ORDER_TOTAL';
  effectiveFrom: string;
  effectiveUntil?: string;
}

export interface TenantBillingProfile {
  tenantId: string;
  identity: BillingIdentity;
  currency: string;
  cadence: BillingCadence;
  anchorDate: string;
  rules: BillingRule[];
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED';
  updatedAt: string;
}

export type MeterEventType = 'SUCCESSFUL_ORDER' | 'LOCATION_ACTIVE' | 'ACCOUNT_ACTIVE' | 'REVENUE_SETTLED';

export interface BillingMeterEvent {
  /** Stable deterministic key; the same upstream event must never create a second charge. */
  idempotencyKey: string;
  tenantId: string;
  type: MeterEventType;
  occurredAt: string;
  sourceType: 'ORDER' | 'LOCATION' | 'ACCOUNT' | 'ADJUSTMENT';
  sourceId: string;
  quantity: number;
  amount?: Money;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface BillingPeriod {
  id: string;
  tenantId: string;
  startsAt: string;
  endsAt: string;
  status: 'OPEN' | 'DRAFT_INVOICE' | 'FINALIZED';
}

export interface InvoiceLineItem {
  id: string;
  ruleId?: string;
  description: string;
  quantity: number;
  unitAmount?: Money;
  amount: Money;
  kind: 'USAGE' | 'RECURRING' | 'CREDIT' | 'ADJUSTMENT';
}

export interface DraftInvoice {
  id: string;
  tenantId: string;
  periodId: string;
  identitySnapshot: BillingIdentity;
  currency: string;
  lines: InvoiceLineItem[];
  subtotal: Money;
  /** Tax remains absent until an authoritative tax configuration/calculation exists. */
  tax?: Money;
  total: Money;
  createdAt: string;
}
