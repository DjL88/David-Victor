import type { RetailOrderEndpointConfig } from './deliverect/retailOrderEndpoint';

export type IntegrationEnvironment = 'staging' | 'production';

export interface IntegrationProfileSecretRefs {
  deliverectClientId?: string;
  deliverectClientSecret?: string;
  deliverectWebhookSecret?: string;
  dpayCredential?: string;
  trustedEdgeSecret?: string;
}

export interface TenantIntegrationProfile {
  id: string;
  tenantId: string;
  environment: IntegrationEnvironment;
  status: 'DRAFT' | 'ACTIVE' | 'DISABLED';
  version: number;
  publicBaseUrl?: string;
  credentialMode: 'platform' | 'dedicated';
  allowedChannelLinkIds: string[];
  deliverect: {
    accountId?: string;
    channelName?: string;
    orderRoute?: 'retail_quest' | 'commerce_checkout';
    retailOrder?: RetailOrderEndpointConfig;
  };
  dpay?: {
    enabled: boolean;
    environment: IntegrationEnvironment;
    baseUrl?: string;
    /**
     * Explicit merchant policy for a picked total above the authorised ceiling.
     * MANUAL_ACTION_REQUIRED is the fail-closed default. AUTO_REAUTHORIZE may
     * only be selected when the tenant has deliberately enabled that provider flow.
     */
    excessAmountPolicy?: 'MANUAL_ACTION_REQUIRED' | 'AUTO_REAUTHORIZE';
  };
  secretRefs: IntegrationProfileSecretRefs;
  createdAt?: string;
  updatedAt?: string;
}

function cleanTenantSlug(tenantId: string): string {
  return String(tenantId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function integrationProfileId(
  tenantId: string,
  environment: IntegrationEnvironment
): string {
  const cleanTenant = String(tenantId || '').trim();
  if (!cleanTenant) throw new Error('Integration profile requires a tenantId.');
  return `${cleanTenant}__${environment}`;
}

export function integrationSecretPrefix(
  tenantId: string,
  environment: IntegrationEnvironment
): string {
  const slug = cleanTenantSlug(tenantId);
  if (!slug) throw new Error('Integration secret prefix requires a tenantId.');
  return `lt--${slug}--${environment}--`;
}

export function normalizeIntegrationEnvironment(
  value: unknown,
  fallback: IntegrationEnvironment = 'staging'
): IntegrationEnvironment {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'staging' || normalized === 'production') return normalized;
  throw new Error(`Unsupported integration environment "${normalized}".`);
}

export function parseAllowedTenantEnvironments(
  raw: string | undefined
): IntegrationEnvironment[] {
  if (!raw || !raw.trim()) return [];
  const environments = raw
    .split(',')
    .map((value) => normalizeIntegrationEnvironment(value))
    .filter((value, index, all) => all.indexOf(value) === index);
  return environments;
}

export function assertTenantEnvironmentAllowed(
  environment: IntegrationEnvironment,
  rawAllowed: string | undefined
): void {
  const allowed = parseAllowedTenantEnvironments(rawAllowed);
  if (allowed.length > 0 && !allowed.includes(environment)) {
    throw new Error(
      `Integration environment "${environment}" is not allowed in this deployment.`
    );
  }
}

export function validateIntegrationProfile(
  profile: TenantIntegrationProfile,
  expectedTenantId?: string,
  expectedEnvironment?: IntegrationEnvironment
): TenantIntegrationProfile {
  if (!profile || typeof profile !== 'object') {
    throw new Error('Integration profile is required.');
  }
  if (!profile.tenantId || profile.tenantId.trim().length === 0) {
    throw new Error('Integration profile tenantId is required.');
  }
  if (expectedTenantId && profile.tenantId !== expectedTenantId) {
    throw new Error('Integration profile tenant does not match the requested tenant.');
  }
  const environment = normalizeIntegrationEnvironment(profile.environment);
  if (expectedEnvironment && environment !== expectedEnvironment) {
    throw new Error('Integration profile environment does not match the requested environment.');
  }
  if (profile.id !== integrationProfileId(profile.tenantId, environment)) {
    throw new Error('Integration profile ID must be tenantId__environment.');
  }
  if (!Number.isInteger(profile.version) || profile.version < 1) {
    throw new Error('Integration profile version must be a positive integer.');
  }
  if (!['DRAFT', 'ACTIVE', 'DISABLED'].includes(profile.status)) {
    throw new Error('Integration profile status is invalid.');
  }
  if (!['platform', 'dedicated'].includes(profile.credentialMode)) {
    throw new Error('Integration profile credentialMode is invalid.');
  }
  if (!Array.isArray(profile.allowedChannelLinkIds)) {
    throw new Error('Integration profile allowedChannelLinkIds must be an array.');
  }
  if (profile.publicBaseUrl) {
    const parsed = new URL(profile.publicBaseUrl);
    if (parsed.protocol !== 'https:') {
      throw new Error('Integration profile publicBaseUrl must use HTTPS.');
    }
  }

  const secretNames = Object.values(profile.secretRefs || {}).filter(Boolean) as string[];
  const expectedSecretPrefix = integrationSecretPrefix(profile.tenantId, environment);
  for (const secretName of secretNames) {
    if (!/^[A-Za-z0-9_-]+$/.test(secretName)) {
      throw new Error('Integration profile contains an invalid Secret Manager reference.');
    }
    if (!secretName.startsWith(expectedSecretPrefix)) {
      throw new Error(
        `Integration profile secret "${secretName}" must be scoped to "${expectedSecretPrefix}*".`
      );
    }
  }

  if (profile.dpay) {
    const dpayEnvironment = normalizeIntegrationEnvironment(profile.dpay.environment);
    if (dpayEnvironment !== environment) {
      throw new Error('DPay environment must match the integration profile environment.');
    }
    if (profile.dpay.baseUrl) {
      const parsed = new URL(profile.dpay.baseUrl);
      if (parsed.protocol !== 'https:') {
        throw new Error('DPay baseUrl must use HTTPS.');
      }
    }
    if (
      profile.dpay.excessAmountPolicy &&
      !['MANUAL_ACTION_REQUIRED', 'AUTO_REAUTHORIZE'].includes(profile.dpay.excessAmountPolicy)
    ) {
      throw new Error('DPay excessAmountPolicy is invalid.');
    }
  }

  return {
    ...profile,
    environment,
    allowedChannelLinkIds: Array.from(
      new Set(profile.allowedChannelLinkIds.map(String).map((value) => value.trim()).filter(Boolean))
    ),
  };
}
