import { Money } from './money';

export type MarketRuleStatus = 'CONFIRMED_LAW' | 'REGULATOR_GUIDANCE' | 'PRODUCT_POLICY';
export type MarketCapability =
  | 'PRICE_DISPLAY' | 'UNIT_PRICING' | 'LEVY' | 'DEPOSIT_RETURN' | 'AGE_GATE'
  | 'SALE_HOURS' | 'PROMOTION_RESTRICTION' | 'QUANTITY_CAP' | 'MANDATORY_WARNING'
  | 'ADDRESS_FORMAT' | 'MEASUREMENT' | 'LEGAL_COPY' | 'PRIVACY_COPY' | 'COOKIE_COPY'
  | 'RECEIPT_COPY' | 'DATA_RETENTION' | 'DATA_RESIDENCY';

export interface MarketRuleProvenance {
  jurisdiction: string;
  sourceTitle: string;
  sourceUrl: string;
  effectiveDate: string;
  reviewedDate: string;
  status: MarketRuleStatus;
  capability: MarketCapability;
  testEvidence: string[];
}

export interface MarketRule {
  id: string;
  version: number;
  provenance: MarketRuleProvenance;
  where: {
    country: string;
    regions?: string[];
    productTags?: string[];
    fulfilmentTypes?: Array<'delivery' | 'pickup'>;
  };
  when?: { days?: number[]; startTime?: string; endTime?: string };
  action:
    | { type: 'DISPLAY_TAX_INCLUSIVE' }
    | { type: 'REQUIRE_UNIT_PRICE'; measures: string[] }
    | { type: 'APPLY_CONFIGURED_CHARGE'; chargeKey: string; minimum?: Money }
    | { type: 'REQUIRE_AGE_GATE'; minimumAge?: number }
    | { type: 'RESTRICT_SALE' }
    | { type: 'RESTRICT_DELIVERY' }
    | { type: 'DISABLE_PROMOTION' }
    | { type: 'QUANTITY_CAP'; maximum: number }
    | { type: 'REQUIRE_WARNING'; wordingKey: string };
  explanation: string;
}

export interface MarketPack {
  id: string;
  version: number;
  jurisdiction: string;
  locales: { default: string; supported: string[]; fallbacks: Record<string, string[]> };
  currency: { code: string; minorUnits: number };
  timezone: string;
  measurementSystem: 'metric' | 'imperial' | 'mixed';
  addressFormat: string[];
  legalWordingHooks: string[];
  dataPolicyHooks: string[];
  rules: MarketRule[];
}

export function validateMarketPack(pack: MarketPack): string[] {
  const errors: string[] = [];
  if (!pack.id || pack.version < 1 || !pack.jurisdiction) errors.push('pack identity/version/jurisdiction required');
  if (!/^[A-Z]{3}$/.test(pack.currency.code)) errors.push('currency must be ISO-style 3-letter code');
  if (!Number.isInteger(pack.currency.minorUnits) || pack.currency.minorUnits < 0 || pack.currency.minorUnits > 4) errors.push('currency minorUnits must be 0..4');
  if (!pack.locales.supported.includes(pack.locales.default)) errors.push('default locale must be supported');
  for (const rule of pack.rules) {
    const p = rule.provenance;
    if (!rule.id || rule.version < 1) errors.push('rule identity/version required');
    if (!p.jurisdiction || !p.sourceTitle || !/^https:\/\//.test(p.sourceUrl)) errors.push(`${rule.id}: source provenance required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate) || !/^\d{4}-\d{2}-\d{2}$/.test(p.reviewedDate)) errors.push(`${rule.id}: effective/reviewed dates required`);
    if (!p.capability || p.testEvidence.length === 0) errors.push(`${rule.id}: capability and test evidence required`);
    if (p.status === 'CONFIRMED_LAW' && !p.sourceUrl) errors.push(`${rule.id}: confirmed law cannot be source-less`);
  }
  return errors;
}

export function assertMarketPack(pack: MarketPack): MarketPack {
  const errors = validateMarketPack(pack);
  if (errors.length) throw new Error(`Invalid market pack: ${errors.join('; ')}`);
  return pack;
}
