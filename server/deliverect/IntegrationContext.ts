/**
 * Multi-Tenant Deliverect Integration Context & Tenant Secret Resolver
 * 
 * Section 7 & 8: Multi-tenant platform architecture.
 * Guarantees that every Deliverect integration operation (OAuth tokens, API calls,
 * webhook validation, Linked Accounts) is strictly resolved within its tenant boundary.
 * 
 * Prevents cross-tenant credential leakage and enforces runtime isolation.
 */

import { SecretManager } from '../secrets';
import { OAuthTokenManager, DeliverectEnvironmentName } from './OAuthTokenManager';
import { FirestorePlatformService } from '../firestoreService';
import { BFFError } from '../errors';
import { isDemoMode } from '../runtimeMode';
import { linkedAccountsAdapter } from './LinkedAccountsAdapter';
import type { RetailOrderEndpointConfig } from './retailOrderEndpoint';
import {
  assertTenantEnvironmentAllowed,
  normalizeIntegrationEnvironment,
  type TenantIntegrationProfile,
} from '../integrationProfile';

export interface TenantIntegrationConfig {
  tenantId: string;
  environment: DeliverectEnvironmentName;
  credentialMode: 'platform' | 'dedicated';
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  deliverectAccountId?: string;
  allowedChannelLinkIds?: string[];
  /** Channel API scope/name used by POST /{channelName}/order/{channelLinkId}. */
  channelName?: string;
  /** Terminal Deliverect order-creation route. Exactly one route may run per order. */
  orderRoute?: 'retail_quest' | 'commerce_checkout';
  retailOrder?: RetailOrderEndpointConfig;
  publicBaseUrl?: string;
  profileVersion?: number;
  dpay?: TenantIntegrationProfile['dpay'];
  tokenManager: OAuthTokenManager;
  isConfigured: boolean;
}

export class TenantSecretResolver {
  /**
   * Resolves a secret specifically scoped to a tenant.
   * Format: KEY_TENANTID (e.g. DELIVERECT_CLIENT_SECRET_brand_alpha)
   * Falls back to general environment key only if explicitly permitted (e.g. single-tenant staging).
   */
  static async resolveTenantSecret(
    tenantId: string,
    secretKeyName: string,
    mode: 'legacy' | 'platform' | 'dedicated' = 'legacy'
  ): Promise<string | null> {
    const cleanTenant = tenantId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const tenantSpecificKey = `${secretKeyName}_${cleanTenant}`;
    const directKey = `${secretKeyName}_${tenantId}`;

    // 1. Dedicated/legacy modes may use tenant-specific credentials.
    // Explicit platform mode intentionally ignores any old tenant secret versions.
    if (mode !== 'platform') {
      const directSecret = await SecretManager.getSecret(directKey);
      if (directSecret && directSecret.trim().length > 0) {
        return directSecret.trim();
      }

      const tenantSecret = await SecretManager.getSecret(tenantSpecificKey);
      if (tenantSecret && tenantSecret.trim().length > 0) {
        return tenantSecret.trim();
      }
    }

    // 2. Dedicated tenants must never silently inherit platform credentials.
    if (mode !== 'dedicated') {
      const genericSecret = await SecretManager.getSecret(secretKeyName);
      if (genericSecret && genericSecret.trim().length > 0) {
        return genericSecret.trim();
      }
    }

    // 3. Environment fallback follows the same isolation rule.
    if (mode !== 'platform' && process.env[directKey]) return process.env[directKey]!;
    if (mode !== 'platform' && process.env[tenantSpecificKey]) return process.env[tenantSpecificKey]!;
    if (mode !== 'dedicated' && process.env[secretKeyName]) return process.env[secretKeyName]!;

    return null;
  }
}

export class IntegrationContext {
  private static contextCache = new Map<string, { config: TenantIntegrationConfig; cachedAt: number }>();
  private static readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Resolves the full integration context for a given tenant.
   */
  static async getContext(
    tenantId: string,
    options?: { allowDraftProfile?: boolean }
  ): Promise<TenantIntegrationConfig> {
    if (!tenantId) {
      throw new BFFError('INVALID_INPUT', 'Cannot resolve Deliverect integration context without a valid tenant ID', 400);
    }

    const allowDraftProfile = options?.allowDraftProfile === true;
    const cached = this.contextCache.get(tenantId);
    if (!allowDraftProfile && cached && Date.now() - cached.cachedAt < this.TTL_MS) {
      return cached.config;
    }

    // 1. Load integration record from platform storage
    let integrationRecord: any = null;
    try {
      integrationRecord = await FirestorePlatformService.getIntegrationConfig(tenantId);
    } catch {
      // Integration may not exist yet
    }

    let environment: DeliverectEnvironmentName;
    try {
      environment = normalizeIntegrationEnvironment(
        integrationRecord?.activeEnv ||
          integrationRecord?.environment ||
          process.env.DELIVERECT_ENV ||
          'staging'
      );
      assertTenantEnvironmentAllowed(environment, process.env.ALLOWED_TENANT_ENVS);
    } catch (err: any) {
      throw new BFFError(
        'INTEGRATION_CONFIG_INVALID',
        err?.message || 'Tenant integration environment is not allowed in this deployment.',
        503
      );
    }

    let integrationProfile: TenantIntegrationProfile | null = null;
    try {
      integrationProfile = await FirestorePlatformService.getIntegrationProfile(
        tenantId,
        environment
      );
    } catch (err) {
      if (process.env.INTEGRATION_PROFILE_REQUIRED === 'true') throw err;
    }

    const effectiveProfile =
      integrationProfile?.status === 'ACTIVE' ||
      (allowDraftProfile && integrationProfile?.status === 'DRAFT')
        ? integrationProfile
        : null;
    if (process.env.INTEGRATION_PROFILE_REQUIRED === 'true' && !effectiveProfile) {
      throw new BFFError(
        'INTEGRATION_NOT_CONFIGURED',
        `Active integration profile "${tenantId}__${environment}" is required for this deployment.`,
        503
      );
    }

    // 2. Resolve credentials according to the tenant's explicit credential mode.
    // Existing tenants default to platform credentials for backwards compatibility.
    const configuredCredentialMode =
      effectiveProfile?.credentialMode || integrationRecord?.credentialMode;
    const resolutionMode: 'legacy' | 'platform' | 'dedicated' =
      configuredCredentialMode === 'dedicated'
        ? 'dedicated'
        : configuredCredentialMode === 'platform'
          ? 'platform'
          : 'legacy';
    const platformEnvironmentSuffix = environment.toUpperCase();
    const environmentPlatformClientId = resolutionMode === 'platform'
      ? await SecretManager.getSecret(`DELIVERECT_CLIENT_ID_${platformEnvironmentSuffix}`)
      : null;
    const environmentPlatformClientSecret = resolutionMode === 'platform'
      ? await SecretManager.getSecret(`DELIVERECT_CLIENT_SECRET_${platformEnvironmentSuffix}`)
      : null;

    const clientId =
      (effectiveProfile?.secretRefs?.deliverectClientId
        ? await SecretManager.getSecret(effectiveProfile.secretRefs.deliverectClientId)
        : environmentPlatformClientId || await TenantSecretResolver.resolveTenantSecret(
            tenantId,
            'DELIVERECT_CLIENT_ID',
            resolutionMode
          )) || '';

    const clientSecret =
      (effectiveProfile?.secretRefs?.deliverectClientSecret
        ? await SecretManager.getSecret(effectiveProfile.secretRefs.deliverectClientSecret)
        : environmentPlatformClientSecret || await TenantSecretResolver.resolveTenantSecret(
            tenantId,
            'DELIVERECT_CLIENT_SECRET',
            resolutionMode
          )) || '';

    const webhookSecret =
      (effectiveProfile?.secretRefs?.deliverectWebhookSecret
        ? await SecretManager.getSecret(effectiveProfile.secretRefs.deliverectWebhookSecret)
        : await SecretManager.getSecret(`deliverect-webhook-${tenantId}`)) || '';

    // Legacy records preserve their old resolution behaviour, but expose which
    // source won so Admin can migrate them explicitly on the next save.
    const credentialMode: 'platform' | 'dedicated' =
      configuredCredentialMode === 'dedicated'
        ? 'dedicated'
        : configuredCredentialMode === 'platform'
          ? 'platform'
          : Boolean(
              await SecretManager.getSecret(`DELIVERECT_CLIENT_ID_${tenantId}`) ||
              await SecretManager.getSecret(`DELIVERECT_CLIENT_ID_${tenantId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`)
            )
            ? 'dedicated'
            : 'platform';

    const isConfigured = Boolean(clientId && clientSecret);

    // 3. Obtain tenant-scoped OAuthTokenManager
    const tokenManager = OAuthTokenManager.getInstance(tenantId, {
      environment,
      clientId: clientId || `unconfigured-${tenantId}`,
      clientSecret,
    });

    // Account and channel ownership are mutable control-plane state. The Admin
    // assignment flow writes them to the tenant integration record after an
    // integration profile may already have been activated, so the integration
    // record must win over the profile snapshot. Otherwise runtime commerce can
    // stay pinned to an old account/empty channel list even though Admin shows
    // the newly saved assignment.
    let deliverectAccountId =
      integrationRecord?.deliverectAccountId || effectiveProfile?.deliverect?.accountId;
    if (!deliverectAccountId) {
      try {
        const mappings = await linkedAccountsAdapter.getTenantMappings(tenantId);
        deliverectAccountId = (mappings as any)?.integration?.deliverectAccountId || (mappings?.accounts?.[0] as any)?.deliverectAccountId;
      } catch {}
    }
    if (!deliverectAccountId && process.env.DELIVERECT_ACCOUNT_ID) {
      deliverectAccountId = process.env.DELIVERECT_ACCOUNT_ID;
    }

    const channelName =
      effectiveProfile?.deliverect?.channelName ||
      integrationRecord?.channelName ||
      process.env.DELIVERECT_CHANNEL_NAME ||
      undefined;
    const configuredOrderRoute = String(
      effectiveProfile?.deliverect?.orderRoute ||
      integrationRecord?.orderRoute ||
      process.env.DELIVERECT_ORDER_ROUTE ||
      'retail_quest'
    ).toLowerCase();
    const orderRoute: 'retail_quest' | 'commerce_checkout' =
      configuredOrderRoute === 'commerce_checkout'
        ? 'commerce_checkout'
        : 'retail_quest';

    const context: TenantIntegrationConfig = {
      tenantId,
      environment,
      credentialMode,
      clientId,
      clientSecret,
      webhookSecret,
      deliverectAccountId,
      allowedChannelLinkIds: Array.isArray(integrationRecord?.allowedChannelLinkIds)
        ? integrationRecord.allowedChannelLinkIds.map(String)
        : effectiveProfile
          ? effectiveProfile.allowedChannelLinkIds.map(String)
          : [],
      channelName,
      retailOrder: effectiveProfile?.deliverect?.retailOrder || integrationRecord?.retailOrder,
      orderRoute,
      publicBaseUrl: effectiveProfile?.publicBaseUrl,
      profileVersion: effectiveProfile?.version,
      dpay: effectiveProfile?.dpay,
      tokenManager,
      isConfigured,
    };

    // Draft contexts are only for Admin onboarding/diagnostics. Never place one
    // in the runtime cache where workers could accidentally consume it.
    if (!allowDraftProfile) {
      this.contextCache.set(tenantId, { config: context, cachedAt: Date.now() });
    }
    return context;
  }

  /**
   * Returns cached integration context if present and not expired.
   */
  static getCachedContext(tenantId: string): TenantIntegrationConfig | null {
    const cached = this.contextCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.TTL_MS) {
      return cached.config;
    }
    return null;
  }

  /**
   * Asserts that integration is configured for live staging/production use.
   * Throws 503 INTEGRATION_NOT_CONFIGURED if unconfigured.
   */
  static async assertConfigured(tenantId: string): Promise<TenantIntegrationConfig> {
    const context = await this.getContext(tenantId);
    if (!context.isConfigured && !isDemoMode()) {
      throw new BFFError(
        'INTEGRATION_NOT_CONFIGURED',
        `Deliverect integration is not configured for tenant "${tenantId}". Missing client credentials.`,
        503
      );
    }
    return context;
  }

  /**
   * Invalidate cached integration context for tenant (e.g. after credential update).
   */
  static invalidate(tenantId: string): void {
    this.contextCache.delete(tenantId);
    OAuthTokenManager.clearAll();
  }

  static clearAll(): void {
    this.contextCache.clear();
    OAuthTokenManager.clearAll();
  }
}
