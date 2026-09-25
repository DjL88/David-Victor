import type { AdminClient } from '../commerce/AdminClient';

export const ALTIE_KNOWLEDGE_VERSION = '2026-09-25.1';

export const ALTIE_PRODUCT_KNOWLEDGE = {
  version: ALTIE_KNOWLEDGE_VERSION,
  adminAreas: [
    'Brands',
    'Team & Access',
    'Products & Stock',
    'Locations',
    'Deliverect Setup',
    'Connection Status',
    'Insights',
    'Branding',
    'Banners',
    'Stories',
    'Pages',
    'Search & Recommendations',
    'Product rules',
    'Courier settings',
    'Order scheduling',
    'Fees',
    'Languages & wording',
    'Feature switches',
    'Domains',
    'Media Health',
    'Audit History',
  ],
  facts: [
    'Deliverect menu/catalogue data is normalised into tenant and location-aware storefront data.',
    'Altie can use allow-listed catalogue, location, rule and permitted connection diagnostics.',
    'Product-rule writes are proposal-only; Branding is the only assistant path with a typed low-risk apply and rollback adapter today.',
    'Banners, Stories and Pages are tenant content/promotion surfaces; their current publication state is not a trusted Altie chat read today.',
    'Search supports typo aliases, synonyms, rewrites, pins, boosts/demotions and exclusions.',
    'Insights exists, but Altie has no trusted live sales, revenue or top-seller read today.',
    'The platform has checkout, picking/amendment/substitution, payment/finalisation, dispatch and customer tracking flows, but Altie has no general live-order lookup, refund or cancellation action today.',
    'Domains support tenant binding, ownership verification and hosting/TLS status.',
    'Assistant actions are server-authorized, role/capability checked and tenant-bound; autonomous production changes are disabled.',
  ],
} as const;

export interface AltieWorkspaceSnapshot {
  tenantId: string;
  checkedAt: string;
  tenant?: {
    brandName?: string;
    status?: string;
    country?: string;
    currency?: string;
    locale?: string;
    defaultDomain?: string;
    enabledFeatures: string[];
    disabledFeatures: string[];
  };
  readiness?: {
    status?: string;
    issueCount?: number;
    checkedAt?: string;
    commerceStores?: number;
    physicalLocations?: number;
    heldCatalogueReviews?: number;
  };
  connection?: {
    environment?: string;
    configured?: boolean;
    status?: string;
    connectionState?: string;
    renderableProductCount?: number;
    parsedProductCount?: number;
    lastSuccessfulSync?: string | null;
    lastCheckedAt?: string;
  };
  search?: {
    locale?: string;
    typoAliases?: number;
    synonyms?: number;
    queryRewrites?: number;
    pinnedProducts?: number;
    boostRules?: number;
    excludedProducts?: number;
    updatedAt?: string;
  };
  domains?: Array<{
    hostname: string;
    isPrimary: boolean;
    status?: string;
    tlsStatus?: string;
    providerHostState?: string;
    providerOwnershipState?: string;
    providerCertState?: string;
    issueCount: number;
  }>;
  fees?: {
    deliveryFeeMode?: string;
    serviceFeeMode?: string;
    serviceFeeEnabled?: boolean;
    smallOrderFeeEnabled?: boolean;
  };
  scheduling?: {
    acceptAsapOrdersOnly?: boolean;
    allowNextOpeningPreOrder?: boolean;
    allowSameDayScheduledPreOrder?: boolean;
  };
  unavailable: string[];
}

function sameTenant(expected: string, actual: unknown): boolean {
  return typeof actual === 'string' && actual.trim() === expected;
}

function safeCount(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

function safeNumber(value: unknown): number | undefined {
  return Number.isFinite(Number(value)) ? Number(value) : undefined;
}

export async function loadAltieWorkspaceSnapshot(
  client: AdminClient,
  tenantId: string
): Promise<AltieWorkspaceSnapshot> {
  const unavailable: string[] = [];
  const safe = async <T>(label: string, task: (() => Promise<T>) | undefined): Promise<T | undefined> => {
    if (!task) {
      unavailable.push(label);
      return undefined;
    }
    try {
      return await task();
    } catch {
      unavailable.push(label);
      return undefined;
    }
  };

  const [tenantRaw, readinessRaw, connectionRaw, searchRaw, domainsRaw, feesRaw, schedulingRaw] =
    await Promise.all([
      safe('tenant configuration', () => client.getBranding(tenantId)),
      safe('operational readiness', client.getOperationalReadiness ? () => client.getOperationalReadiness!(tenantId) : undefined),
      safe('connection health', client.getConnectionHealth ? () => client.getConnectionHealth!(tenantId) : undefined),
      safe('search configuration', client.getSearchConfig ? () => client.getSearchConfig!(tenantId) : undefined),
      safe('domains', client.listAllDomains ? () => client.listAllDomains!() : undefined),
      safe('fee policy', () => client.getFeePolicy(tenantId)),
      safe('scheduling policy', client.getSchedulingPolicy ? () => client.getSchedulingPolicy!(tenantId) : undefined),
    ]);

  const snapshot: AltieWorkspaceSnapshot = {
    tenantId,
    checkedAt: new Date().toISOString(),
    unavailable,
  };

  if (tenantRaw && sameTenant(tenantId, (tenantRaw as any).tenantId)) {
    const flags = (tenantRaw as any).featureFlags || {};
    snapshot.tenant = {
      brandName: (tenantRaw as any).brandName,
      status: (tenantRaw as any).status,
      country: (tenantRaw as any).country,
      currency: (tenantRaw as any).currency,
      locale: (tenantRaw as any).locale,
      defaultDomain: (tenantRaw as any).defaultDomain,
      enabledFeatures: Object.entries(flags).filter(([, value]) => value === true).map(([key]) => key),
      disabledFeatures: Object.entries(flags).filter(([, value]) => value === false).map(([key]) => key),
    };
  } else if (tenantRaw) {
    unavailable.push('tenant configuration');
  }

  if (readinessRaw && sameTenant(tenantId, (readinessRaw as any).tenantId)) {
    snapshot.readiness = {
      status: (readinessRaw as any).status,
      issueCount: Number.isFinite(Number((readinessRaw as any).issueCount)) ? Number((readinessRaw as any).issueCount) : undefined,
      checkedAt: (readinessRaw as any).checkedAt,
      commerceStores: safeNumber((readinessRaw as any).counts?.commerceStores),
      physicalLocations: safeNumber((readinessRaw as any).counts?.physicalLocations),
      heldCatalogueReviews: safeNumber((readinessRaw as any).counts?.heldCatalogueReviews),
    };
  } else if (readinessRaw) {
    unavailable.push('operational readiness');
  }

  const connectionTenant =
    (connectionRaw as any)?.resolvedTenant?.tenantId ||
    (connectionRaw as any)?.tenantId;
  if (connectionRaw && sameTenant(tenantId, connectionTenant)) {
    snapshot.connection = {
      environment: (connectionRaw as any)?.deliverect?.environment || (connectionRaw as any)?.deliverectEnvironment,
      configured: (connectionRaw as any)?.deliverect?.configured,
      status: (connectionRaw as any)?.deliverect?.status,
      connectionState: (connectionRaw as any)?.deliverect?.connectionState,
      renderableProductCount: Number.isFinite(Number((connectionRaw as any)?.products?.renderableProductCount))
        ? Number((connectionRaw as any).products.renderableProductCount)
        : undefined,
      parsedProductCount: Number.isFinite(Number((connectionRaw as any)?.products?.parsedProductCount))
        ? Number((connectionRaw as any).products.parsedProductCount)
        : undefined,
      lastSuccessfulSync: (connectionRaw as any)?.sync?.lastSuccessfulSync ?? (connectionRaw as any)?.lastSuccessfulSync ?? null,
      lastCheckedAt: (connectionRaw as any)?.sync?.lastCheckedAt,
    };
  } else if (connectionRaw) {
    unavailable.push('connection health');
  }

  if (searchRaw && sameTenant(tenantId, (searchRaw as any).tenantId)) {
    snapshot.search = {
      locale: (searchRaw as any).locale,
      typoAliases: safeCount((searchRaw as any).typoAliases),
      synonyms: safeCount((searchRaw as any).synonyms),
      queryRewrites: safeCount((searchRaw as any).queryRewrites),
      pinnedProducts: safeCount((searchRaw as any).pinnedProducts),
      boostRules: safeCount((searchRaw as any).boostRules),
      excludedProducts: safeCount((searchRaw as any).excludedProductPlus),
      updatedAt: (searchRaw as any).updatedAt,
    };
  } else if (searchRaw === null) {
    unavailable.push('search configuration');
  } else if (searchRaw) {
    unavailable.push('search configuration');
  }

  if (Array.isArray(domainsRaw)) {
    snapshot.domains = domainsRaw
      .filter((domain: any) => String(domain?.tenantId || '') === tenantId)
      .map((domain: any) => ({
        hostname: String(domain?.hostname || ''),
        isPrimary: domain?.isPrimary === true,
        status: domain?.status,
        tlsStatus: domain?.tlsStatus,
        providerHostState: domain?.providerHostState,
        providerOwnershipState: domain?.providerOwnershipState,
        providerCertState: domain?.providerCertState,
        issueCount: Array.isArray(domain?.provisioningIssues) ? domain.provisioningIssues.length : 0,
      }))
      .filter((domain) => Boolean(domain.hostname));
  }

  if (feesRaw) {
    snapshot.fees = {
      deliveryFeeMode: (feesRaw as any).deliveryFeeMode,
      serviceFeeMode: (feesRaw as any).serviceFeeMode,
      serviceFeeEnabled: (feesRaw as any).serviceFeeEnabled,
      smallOrderFeeEnabled: (feesRaw as any).smallOrderFeeEnabled,
    };
  }

  if (schedulingRaw) {
    snapshot.scheduling = {
      acceptAsapOrdersOnly: (schedulingRaw as any).acceptAsapOrdersOnly,
      allowNextOpeningPreOrder: (schedulingRaw as any).allowNextOpeningPreOrder,
      allowSameDayScheduledPreOrder: (schedulingRaw as any).allowSameDayScheduledPreOrder,
    };
  }

  snapshot.unavailable = Array.from(new Set(unavailable));
  return snapshot;
}

export function buildUnavailableLiveDataReply(message: string): string | null {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return null;

  const liveInsights =
    /\b(top|best|most|least)\s+(selling|sold)\b/.test(text) ||
    /\b(sales|revenue|gmv|takings|turnover)\b.*\b(today|yesterday|current|currently|now|this\s+(?:day|week|month|year)|how\s+much|total|top|best|most|least)\b/.test(text) ||
    /\b(today|yesterday|current|currently|now|this\s+(?:day|week|month|year))\b.*\b(sales|revenue|gmv|takings|turnover)\b/.test(text) ||
    (/\binsights\b/.test(text) && /\b(live|current|verify|verified|available|metrics|data)\b/.test(text));
  if (liveInsights) {
    return 'I don’t have a trusted live Insights read for sales, revenue or top-selling metrics in this chat, so I can’t state a current figure. I can explain the Insights area or take you there, but I won’t guess.';
  }

  const liveOrder =
    /\border\b/.test(text) &&
    (/\b(status|state|where|track|tracking|current|currently|paid|payment|picked|picking|dispatch|courier|delivered|cancelled|canceled|refund|refunded)\b/.test(text) ||
      /\b[A-Z]{1,6}\d{3,}\b/i.test(message));
  if (liveOrder) {
    return 'I don’t have a trusted general live-order lookup action in Altie yet, so I can’t verify that order’s current status from chat. I won’t infer an order, payment, picking, dispatch or refund state without a trusted read result.';
  }

  const liveContentPublish =
    /\b(banner|story|page|promotion|promo)\b/.test(text) &&
    /\b(live|published|active|visible)\b/.test(text) &&
    /\b(is|are|currently|now)\b/.test(text);
  if (liveContentPublish) {
    return 'I don’t have a trusted live publication-state read for that content item in this chat, so I can’t confirm whether it is currently live or visible. I can guide you to the relevant Admin area to verify it.';
  }

  return null;
}

export function isAltieCapabilityQuestion(message: string): boolean {
  const text = String(message || '').trim().toLowerCase();
  return (
    /\bwhat can (?:you|altie) do\b/.test(text) ||
    /\b(?:your|altie(?:'s)?) capabilities\b/.test(text) ||
    /\bwhat are you able to do\b/.test(text) ||
    /\bwhat do (?:you|altie) know about (?:the )?(?:app|platform|product)\b/.test(text) ||
    /\bwhat can (?:you|altie) verify live\b/.test(text)
  );
}

export function buildAltieCapabilityReply(): string {
  return 'I know the platform’s Admin areas and core catalogue/menu, location, Deliverect, order, rule, promotion, search, Insights, domain and publishing flows. For current tenant facts I only use authenticated workspace data or trusted read results. I can run safe reads where supported and guide or prepare reviewable changes; I won’t invent live sales/order state or bypass permissions and approvals.';
}

export function isWorkspaceSnapshotQuestion(message: string): boolean {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;
  return (
    /\b(tenant|brand)\b.*\b(config|configuration|configured|setup|status|overview|enabled|current)\b/.test(text) ||
    /\bwhat do (?:you|altie) know about (?:this|the) (?:brand|tenant)\b/.test(text) ||
    /\boverview of (?:this|the) (?:brand|tenant)\b/.test(text) ||
    /\b(what(?:'s| is) configured|what is enabled|current setup|operational status|readiness|are we ready|are we connected)\b/.test(text) ||
    /\b(domain|domains|tls|certificate)\b.*\b(status|configured|ready|live|verified|verification|current)\b/.test(text) ||
    /\b(deliverect|connection)\b.*\b(status|health|healthy|connected|configured|environment|sync)\b/.test(text) ||
    /\b(search)\b.*\b(config|configuration|configured|tuning|synonym|rewrite|pin|boost|exclude)\b/.test(text) ||
    /\b(fee|fees|scheduling|pre-?order|asap)\b.*\b(config|configuration|configured|policy|current|enabled)\b/.test(text) ||
    /\b(feature|features|feature flags?)\b.*\b(enabled|disabled|configured|current)\b/.test(text)
  );
}

function unavailableSuffix(snapshot: AltieWorkspaceSnapshot, relevant: string[] = snapshot.unavailable): string {
  const missing = Array.from(new Set(relevant.filter((item) => snapshot.unavailable.includes(item))));
  return missing.length ? ` I couldn’t verify: ${missing.join(', ')}.` : '';
}

export function summariseAltieWorkspaceSnapshot(
  snapshot: AltieWorkspaceSnapshot,
  message: string
): string {
  const text = String(message || '').toLowerCase();

  if (/\b(domain|domains|tls|certificate)\b/.test(text)) {
    if (!snapshot.domains) {
      return 'I couldn’t verify the current domain/TLS state from trusted tenant data, so I won’t guess.';
    }
    if (snapshot.domains.length === 0) {
      return 'I checked the current tenant domain mapping and no domains are listed for this brand.';
    }
    const domains = snapshot.domains.map((domain) => {
      const state = [domain.status, domain.tlsStatus ? `TLS ${domain.tlsStatus}` : null]
        .filter(Boolean)
        .join(', ');
      return `${domain.hostname}${domain.isPrimary ? ' (primary)' : ''}${state ? ` — ${state}` : ''}`;
    });
    return `I checked the current tenant domain mapping: ${domains.join('; ')}.${unavailableSuffix(snapshot, ['domains'])}`;
  }

  if (/\b(deliverect|connection|operational|readiness|ready|connected|sync)\b/.test(text)) {
    const parts: string[] = [];
    if (snapshot.connection) {
      parts.push(
        `Deliverect: ${snapshot.connection.status || snapshot.connection.connectionState || 'status unavailable'}${snapshot.connection.environment ? ` (${snapshot.connection.environment})` : ''}`
      );
      if (snapshot.connection.renderableProductCount !== undefined) {
        parts.push(`${snapshot.connection.renderableProductCount} renderable products`);
      }
      if (snapshot.connection.lastSuccessfulSync) {
        parts.push(`last successful sync ${snapshot.connection.lastSuccessfulSync}`);
      }
    }
    if (snapshot.readiness) {
      parts.push(
        `readiness ${snapshot.readiness.status || 'unknown'} with ${snapshot.readiness.issueCount ?? 'unknown'} issue(s)`
      );
    }
    if (parts.length === 0) {
      return 'I couldn’t verify current connection/readiness data from a trusted tenant source, so I won’t guess.';
    }
    return `I checked current tenant status: ${parts.join('; ')}.${unavailableSuffix(snapshot, ['connection health', 'operational readiness'])}`;
  }

  if (/\bsearch\b/.test(text)) {
    if (!snapshot.search) {
      return 'I couldn’t verify the current Search & Recommendations configuration for this tenant, so I won’t invent settings.';
    }
    const s = snapshot.search;
    return `Current search tuning has ${s.typoAliases ?? 'unknown'} typo aliases, ${s.synonyms ?? 'unknown'} synonym groups, ${s.queryRewrites ?? 'unknown'} rewrites, ${s.pinnedProducts ?? 'unknown'} pinned products, ${s.boostRules ?? 'unknown'} boost/demotion rules and ${s.excludedProducts ?? 'unknown'} exclusions${s.locale ? ` for ${s.locale}` : ''}.`;
  }

  if (/\bfee|fees\b/.test(text)) {
    if (!snapshot.fees) {
      return 'I couldn’t verify the current fee policy for this tenant, so I won’t guess.';
    }
    return `Current fee modes: delivery ${snapshot.fees.deliveryFeeMode || 'not reported'}; service fee ${snapshot.fees.serviceFeeMode || 'not reported'}.${unavailableSuffix(snapshot, ['fee policy'])}`;
  }

  if (/\b(scheduling|pre-?order|asap)\b/.test(text)) {
    if (!snapshot.scheduling) {
      return 'I couldn’t verify the current order-scheduling policy for this tenant, so I won’t guess.';
    }
    const s = snapshot.scheduling;
    return `Current scheduling policy: ASAP-only ${s.acceptAsapOrdersOnly === true ? 'on' : 'off'}; next-opening pre-orders ${s.allowNextOpeningPreOrder === true ? 'on' : 'off'}; same-day scheduled pre-orders ${s.allowSameDayScheduledPreOrder === true ? 'on' : 'off'}.`;
  }

  if (/\bfeature|features|feature flags?\b/.test(text)) {
    if (!snapshot.tenant) {
      return 'I couldn’t verify the current tenant feature flags, so I won’t guess.';
    }
    const enabled = snapshot.tenant.enabledFeatures;
    return enabled.length
      ? `I checked this tenant’s current feature flags. Enabled: ${enabled.join(', ')}.`
      : 'I checked this tenant’s current feature flags and none are explicitly enabled.';
  }

  const parts: string[] = [];
  if (snapshot.tenant) {
    parts.push(
      `${snapshot.tenant.brandName || snapshot.tenantId}${snapshot.tenant.status ? ` is ${snapshot.tenant.status}` : ''}${snapshot.tenant.locale ? ` using ${snapshot.tenant.locale}` : ''}${snapshot.tenant.currency ? `/${snapshot.tenant.currency}` : ''}`
    );
  }
  if (snapshot.readiness) {
    parts.push(`operational readiness ${snapshot.readiness.status || 'unknown'} with ${snapshot.readiness.issueCount ?? 'unknown'} issue(s)`);
  }
  if (snapshot.connection?.status) {
    parts.push(`Deliverect ${snapshot.connection.status}`);
  }
  if (snapshot.domains) {
    parts.push(`${snapshot.domains.length} mapped domain(s)`);
  }
  if (snapshot.search) {
    const tuningCounts = [
      snapshot.search.synonyms,
      snapshot.search.queryRewrites,
      snapshot.search.boostRules,
    ].filter((value): value is number => typeof value === 'number');
    parts.push(
      tuningCounts.length > 0
        ? `${tuningCounts.reduce((sum, value) => sum + value, 0)} known search-tuning records across synonym/rewrite/boost collections`
        : 'search tuning loaded, but record counts were not reported'
    );
  }

  if (parts.length === 0) {
    return 'I couldn’t verify current tenant configuration from the trusted Admin reads available to me, so I won’t invent an overview.';
  }

  return `Current tenant overview: ${parts.join('; ')}. I still don’t have trusted live sales/revenue or general order-status reads in chat.${unavailableSuffix(snapshot)}`;
}
