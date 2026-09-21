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

export interface TenantIntegrationConfig {
  tenantId: string;
  environment: DeliverectEnvironmentName;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  deliverectAccountId?: string;
  allowedChannelLinkIds?: string[];
  /** Channel API scope/name used by POST /{channelName}/order/{channelLinkId}. */
  channelName?: string;
  /** Terminal Deliverect order-creation route. Exactly one route may run per order. */
  orderRoute: 'retail_quest' | 'commerce_checkout';
  tokenManager: OAuthTokenManager;
  isConfigured: boolean;
}

export class TenantSecretResolver {
  /**
   * Resolves a secret specifically scoped to a tenant.
   * Format: KEY_TENANTID (e.g. DELIVERECT_CLIENT_SECRET_brand_alpha)
   * Falls back to general environment key only if explicitly permitted (e.g. single-tenant staging).
   */
  static async resolveTenantSecret(tenantId: string, secretKeyName: string): Promise<string | null> {
    const cleanTenant = tenantId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const tenantSpecificKey = `${secretKeyName}_${cleanTenant}`;
    const directKey = `${secretKeyName}_${tenantId}`;

    // 1. Check direct tenant key & normalized tenant-specific secret
    const directSecret = await SecretManager.getSecret(directKey);
    if (directSecret && directSecret.trim().length > 0) {
      return directSecret.trim();
    }

    const tenantSecret = await SecretManager.getSecret(tenantSpecificKey);
    if (tenantSecret && tenantSecret.trim().length > 0) {
      return tenantSecret.trim();
    }

    // 2. Check general secret
    const genericSecret = await SecretManager.getSecret(secretKeyName);
    if (genericSecret && genericSecret.trim().length > 0) {
      return genericSecret.trim();
    }

    // 3. Fallback to process.env
    if (process.env[directKey]) return process.env[directKey]!;
    if (process.env[tenantSpecificKey]) return process.env[tenantSpecificKey]!;
    if (process.env[secretKeyName]) return process.env[secretKeyName]!;

    return null;
  }
}

export class IntegrationContext {
  private static contextCache = new Map<string, { config: TenantIntegrationConfig; cachedAt: number }>();
  private static readonly TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Resolves the full integration context for a given tenant.
   */
  static async getContext(tenantId: string): Promise<TenantIntegrationConfig> {
    if (!tenantId) {
      throw new BFFError('INVALID_INPUT', 'Cannot resolve Deliverect integration context without a valid tenant ID', 400);
    }

    const cached = this.contextCache.get(tenantId);
    if (cached && Date.now() - cached.cachedAt < this.TTL_MS) {
      return cached.config;
    }

    // 1. Load integration record from platform storage
    let integrationRecord: any = null;
    try {
      integrationRecord = await FirestorePlatformService.getIntegrationConfig(tenantId);
    } catch {
      // Integration may not exist yet
    }

    const environment: DeliverectEnvironmentName =
      (integrationRecord?.environment as DeliverectEnvironmentName) ||
      (process.env.DELIVERECT_ENV as DeliverectEnvironmentName) ||
      'staging';

    // 2. Resolve tenant credentials via TenantSecretResolver
    const clientId =
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DELIVERECT_CLIENT_ID')) ||
      process.env.DELIVERECT_CLIENT_ID ||
      '';

    const clientSecret =
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DELIVERECT_CLIENT_SECRET')) ||
      process.env.DELIVERECT_CLIENT_SECRET ||
      '';

    const webhookSecret =
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DELIVERECT_WEBHOOK_SECRET')) ||
      process.env.DELIVERECT_WEBHOOK_SECRET ||
      '';

    const isConfigured = Boolean(clientId && clientSecret);

    // 3. Obtain tenant-scoped OAuthTokenManager
    const tokenManager = OAuthTokenManager.getInstance(tenantId, {
      environment,
      clientId: clientId || `unconfigured-${tenantId}`,
      clientSecret,
    });

    let deliverectAccountId = integrationRecord?.deliverectAccountId;
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
      integrationRecord?.channelName ||
      process.env.DELIVERECT_CHANNEL_NAME ||
      undefined;
    const configuredOrderRoute = String(
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
      clientId,
      clientSecret,
      webhookSecret,
      deliverectAccountId,
      allowedChannelLinkIds: Array.isArray(integrationRecord?.allowedChannelLinkIds)
        ? integrationRecord.allowedChannelLinkIds.map(String)
        : [],
      channelName,
      orderRoute,
      tokenManager,
      isConfigured,
    };

    this.contextCache.set(tenantId, { config: context, cachedAt: Date.now() });
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
