import { DeliverectIntegration } from '../../src/domain/models';
import { OAuthTokenManager, DeliverectEnvironmentName } from './OAuthTokenManager';
import { LinkedAccountsAdapter } from './LinkedAccountsAdapter';
import { FirestorePlatformService } from '../firestoreService';
import { IntegrationContext, TenantSecretResolver } from './IntegrationContext';
import { getFirestoreDb } from '../firebase';
import { isDemoMode } from '../runtimeMode';
import { SecretManager } from '../secrets';

export interface DiagnosticResult {
  success: boolean;
  status: 'UNCONFIGURED' | 'CHECKING' | 'OAUTH_VERIFIED' | 'ACCOUNT_MAPPED' | 'COMMERCE_VERIFIED' | 'CONNECTED' | 'DEGRADED' | 'ERROR';
  connectionState: 'HEALTHY' | 'DISCONNECTED';
  message: string;
  latencyMs: number;
  environment: DeliverectEnvironmentName;
  accountsCount?: number;
  locationsCount?: number;
  storesCount?: number;
  timestamp: string;
}

export interface OAuthDiagnosticResult {
  success: boolean;
  status: 'OAUTH_VERIFIED' | 'UNCONFIGURED' | 'ERROR';
  connectionState: 'HEALTHY' | 'DISCONNECTED';
  message: string;
  latencyMs: number;
  environment: DeliverectEnvironmentName;
  tokenAcquired: boolean;
  tokenAudience: string;
  tokenExpiresIn: number;
  httpStatus?: number;
  timestamp: string;
}

export class ConnectionDiagnostics {
  /**
   * Platform-scoped partner Deliverect OAuth diagnostic.
   * Tests only the documented Commerce staging OAuth contract:
   * https://api.staging.deliverect.com/oauth/token with audience https://api.staging.deliverect.com
   * 
   * On success: returns status: 'OAUTH_VERIFIED'.
   * Does NOT mark any Bwydi tenant as connected.
   * Redacts all credentials and secrets.
   */
  static async testPlatformOAuth(options?: {
    environment?: DeliverectEnvironmentName;
    clientId?: string;
    clientSecret?: string;
    actor?: { uid: string; name: string; role: string };
  }): Promise<OAuthDiagnosticResult> {
    const startTime = Date.now();
    const env: DeliverectEnvironmentName =
      options?.environment ||
      (process.env.DELIVERECT_ENV as DeliverectEnvironmentName) ||
      'staging';

    const clientId =
      options?.clientId ||
      (await SecretManager.getSecret(`DELIVERECT_CLIENT_ID_${env.toUpperCase()}`)) ||
      (await SecretManager.getSecret('DELIVERECT_CLIENT_ID')) ||
      process.env.DELIVERECT_CLIENT_ID ||
      '';

    const clientSecret =
      options?.clientSecret ||
      (await SecretManager.getSecret(`DELIVERECT_CLIENT_SECRET_${env.toUpperCase()}`)) ||
      (await SecretManager.getSecret('DELIVERECT_CLIENT_SECRET')) ||
      process.env.DELIVERECT_CLIENT_SECRET ||
      '';

    console.log(`[Platform OAuth] Initiating partner Deliverect OAuth test (env: ${env}). Has clientId: ${Boolean(clientId)}, Has clientSecret: ${Boolean(clientSecret)}`);

    if (!clientId || !clientSecret) {
      console.warn(`[Platform OAuth] UNCONFIGURED. Missing partner DELIVERECT_CLIENT_ID or DELIVERECT_CLIENT_SECRET for environment "${env}".`);
      return {
        success: false,
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
        message: `Missing Deliverect partner credentials. Configure DELIVERECT_CLIENT_ID and DELIVERECT_CLIENT_SECRET for "${env}".`,
        latencyMs: Date.now() - startTime,
        environment: env,
        tokenAcquired: false,
        tokenAudience: env === 'production' ? 'https://api.deliverect.com' : 'https://api.staging.deliverect.com',
        tokenExpiresIn: 0,
        httpStatus: 400,
        timestamp: new Date().toISOString(),
      };
    }

    const maskedClientId = clientId.length >= 8 ? `${clientId.slice(0, 4)}...${clientId.slice(-4)}` : '****';
    console.log(`[Platform OAuth] Requesting token from Deliverect upstream (${env}) using client ID: ${maskedClientId}`);

    const tokenManager = OAuthTokenManager.getInstance(undefined, {
      environment: env,
      clientId,
      clientSecret,
    });

    try {
      const token = await tokenManager.getAccessToken();
      const latencyMs = Date.now() - startTime;
      const cached = tokenManager.getCachedToken();

      console.log(`[Platform OAuth] Handshake SUCCEEDED in ${latencyMs}ms. Token acquired.`);

      return {
        success: true,
        status: 'OAUTH_VERIFIED',
        connectionState: 'HEALTHY',
        message: `Deliverect partner OAuth verified (${latencyMs}ms). Token successfully acquired and cached for ${env}.`,
        latencyMs,
        environment: env,
        tokenAcquired: Boolean(token),
        tokenAudience: tokenManager.config.audience,
        tokenExpiresIn: cached ? Math.max(0, Math.floor((cached.expiresAt - Date.now()) / 1000)) : 3600,
        httpStatus: 200,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const httpStatus = err.status || (err.code === 'INTEGRATION_AUTH_FAILED' ? 401 : 502);

      console.error(`[Platform OAuth] Handshake FAILED in ${latencyMs}ms (HTTP ${httpStatus}): ${err.message}`);

      return {
        success: false,
        status: 'ERROR',
        connectionState: 'DISCONNECTED',
        message: httpStatus === 401
          ? `Deliverect OAuth token request rejected (HTTP 401 Unauthorized). Upstream rejected partner credentials for environment "${env}".`
          : `Deliverect OAuth token exchange failed (HTTP ${httpStatus}): ${err.message}`,
        latencyMs,
        environment: env,
        tokenAcquired: false,
        tokenAudience: tokenManager.config.audience,
        tokenExpiresIn: 0,
        httpStatus,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Genuine OAuth token acquisition diagnostic:
   * Uses configured staging client ID / secret to obtain and cache an OAuth token.
   * Returns safe diagnostic information with zero secrets exposed.
   * Does NOT require linked accounts discovery to succeed.
   */
  static async testOAuthOnly(
    tenantId: string,
    options?: {
      environment?: DeliverectEnvironmentName;
      clientId?: string;
      clientSecret?: string;
      actor?: { uid: string; name: string; role: string };
    }
  ): Promise<OAuthDiagnosticResult> {
    const startTime = Date.now();
    let draftContext: Awaited<ReturnType<typeof IntegrationContext.getContext>> | null = null;
    try {
      draftContext = await IntegrationContext.getContext(tenantId, {
        allowDraftProfile: true,
      });
    } catch {
      // An unconfigured tenant should produce the safe UNCONFIGURED result below,
      // rather than turning an onboarding check into a 500 response.
    }

    const env: DeliverectEnvironmentName =
      options?.environment ||
      draftContext?.environment ||
      (process.env.DELIVERECT_ENV as DeliverectEnvironmentName) ||
      'staging';

    const clientId =
      options?.clientId ||
      draftContext?.clientId ||
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DELIVERECT_CLIENT_ID')) ||
      process.env.DELIVERECT_CLIENT_ID ||
      '';

    const clientSecret =
      options?.clientSecret ||
      draftContext?.clientSecret ||
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DELIVERECT_CLIENT_SECRET')) ||
      process.env.DELIVERECT_CLIENT_SECRET ||
      '';

    const integrationId = `int_${tenantId}`;

    console.log(`[ConnectionDiagnostics] testOAuthOnly initiated for tenant "${tenantId}" (env: ${env}). Has clientId: ${Boolean(clientId)}, Has clientSecret: ${Boolean(clientSecret)}`);

    if (!clientId || !clientSecret) {
      console.warn(`[ConnectionDiagnostics] OAuth UNCONFIGURED for tenant "${tenantId}". Missing DELIVERECT_CLIENT_ID or DELIVERECT_CLIENT_SECRET for environment "${env}".`);
      const result: OAuthDiagnosticResult = {
        success: false,
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
        message: `Missing Deliverect credentials for tenant "${tenantId}". Configure DELIVERECT_CLIENT_ID and DELIVERECT_CLIENT_SECRET for "${env}".`,
        latencyMs: Date.now() - startTime,
        environment: env,
        tokenAcquired: false,
        tokenAudience: env === 'production' ? 'https://api.deliverect.com' : 'https://api.staging.deliverect.com',
        tokenExpiresIn: 0,
        timestamp: new Date().toISOString(),
      };
      await this.persistDiagnostic(tenantId, integrationId, {
        success: false,
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
        message: result.message,
        latencyMs: result.latencyMs,
        environment: env,
        timestamp: result.timestamp,
      }, options?.actor);
      return result;
    }

    console.log(`[ConnectionDiagnostics] Requesting OAuth token from Deliverect upstream (${env}) for tenant "${tenantId}" using client ID: ${clientId.slice(0, 4)}...${clientId.slice(-4)}`);

    const tokenManager = OAuthTokenManager.getInstance(tenantId, {
      environment: env,
      clientId,
      clientSecret,
    });

    try {
      const token = await tokenManager.getAccessToken();
      const latencyMs = Date.now() - startTime;
      const cached = tokenManager.getCachedToken();

      console.log(`[ConnectionDiagnostics] Deliverect OAuth handshake SUCCEEDED in ${latencyMs}ms for tenant "${tenantId}". Token acquired.`);

      const result: OAuthDiagnosticResult = {
        success: true,
        status: 'OAUTH_VERIFIED',
        connectionState: 'HEALTHY',
        message: `Deliverect OAuth verified (${latencyMs}ms). Token successfully acquired and cached for ${env}.`,
        latencyMs,
        environment: env,
        tokenAcquired: Boolean(token),
        tokenAudience: tokenManager.config.audience,
        tokenExpiresIn: cached ? Math.max(0, Math.floor((cached.expiresAt - Date.now()) / 1000)) : 3600,
        timestamp: new Date().toISOString(),
      };

      await this.persistDiagnostic(tenantId, integrationId, {
        success: true,
        status: 'OAUTH_VERIFIED',
        connectionState: 'HEALTHY',
        message: result.message,
        latencyMs,
        environment: env,
        timestamp: result.timestamp,
      }, options?.actor);

      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isAuthFail = err.code === 'INTEGRATION_AUTH_FAILED' || err.status === 401;

      console.error(`[ConnectionDiagnostics] Deliverect OAuth handshake FAILED in ${latencyMs}ms for tenant "${tenantId}": ${err.message}`);

      const result: OAuthDiagnosticResult = {
        success: false,
        status: 'ERROR',
        connectionState: 'DISCONNECTED',
        message: isAuthFail
          ? `Deliverect OAuth token request rejected (401 Unauthorized). Upstream rejected client credentials for environment "${env}".`
          : `Deliverect OAuth token exchange failed: ${err.message}`,
        latencyMs,
        environment: env,
        tokenAcquired: false,
        tokenAudience: tokenManager.config.audience,
        tokenExpiresIn: 0,
        timestamp: new Date().toISOString(),
      };

      await this.persistDiagnostic(tenantId, integrationId, {
        success: false,
        status: 'ERROR',
        connectionState: 'DISCONNECTED',
        message: result.message,
        latencyMs,
        environment: env,
        timestamp: result.timestamp,
      }, options?.actor);

      return result;
    }
  }
  /**
   * Executes the authentic 5-step connection verification sequence:
   * 1. Resolve tenant and integration record.
   * 2. Inspect credential availability.
   * 3. Acquire OAuth bearer token via OAuthTokenManager.
   * 4. Call Deliverect upstream API to verify locations and channel links.
   * 5. Record real diagnostic result in Firestore with tamper-evident audit logging.
   *
   * NO secrets or tokens are ever exposed or returned.
   */
  static async runDiagnostic(
    tenantId: string,
    options?: {
      environment?: DeliverectEnvironmentName;
      clientId?: string;
      clientSecret?: string;
      deliverectAccountId?: string;
      channelLinkId?: string;
      actor?: { uid: string; name: string; role: string };
    }
  ): Promise<DiagnosticResult> {
    const startTime = Date.now();
    const env: DeliverectEnvironmentName =
      options?.environment ||
      (process.env.DELIVERECT_ENV as DeliverectEnvironmentName) ||
      'staging';

    // Step 1 & 2: Resolve credentials scoped to this tenant
    const clientId =
      options?.clientId ||
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DELIVERECT_CLIENT_ID')) ||
      process.env.DELIVERECT_CLIENT_ID ||
      '';

    const clientSecret =
      options?.clientSecret ||
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DELIVERECT_CLIENT_SECRET')) ||
      process.env.DELIVERECT_CLIENT_SECRET ||
      '';

    const integrationId = `int_${tenantId}`;

    // If credentials not configured:
    if (!clientId || !clientSecret) {
      // In demo mode without credentials, report clean unconfigured/standalone state
      const result: DiagnosticResult = {
        success: false,
        status: 'UNCONFIGURED',
        connectionState: 'DISCONNECTED',
        message: `Deliverect integration is not configured for tenant "${tenantId}". Missing DELIVERECT_CLIENT_ID or DELIVERECT_CLIENT_SECRET for environment "${env}".`,
        latencyMs: Date.now() - startTime,
        environment: env,
        timestamp: new Date().toISOString(),
      };

      await this.persistDiagnostic(tenantId, integrationId, result, options?.actor);
      return result;
    }

    const tokenManager = OAuthTokenManager.getInstance(tenantId, {
      environment: env,
      clientId,
      clientSecret,
    });

    // Step 3: Attempt OAuth Token Acquisition
    let token: string;
    try {
      token = await tokenManager.getAccessToken();
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const isAuthFail = err.code === 'INTEGRATION_AUTH_FAILED' || err.status === 401;
      const result: DiagnosticResult = {
        success: false,
        status: 'ERROR',
        connectionState: 'DISCONNECTED',
        message: isAuthFail
          ? `Deliverect OAuth token request rejected (401 Unauthorized). Upstream rejected client credentials for environment "${env}".`
          : `Deliverect OAuth token exchange failed: ${err.message}`,
        latencyMs,
        environment: env,
        timestamp: new Date().toISOString(),
      };

      await this.persistDiagnostic(tenantId, integrationId, result, options?.actor);
      return result;
    }

    // Step 4: Verify Linked Accounts & Channel Links upstream
    const linkedAccountsAdapter = new LinkedAccountsAdapter({
      environment: env,
      clientId,
      clientSecret,
      tokenManager,
    });

    try {
      const syncResult = await linkedAccountsAdapter.fetchFromUpstream(tenantId, integrationId);
      const latencyMs = Date.now() - startTime;

      const locationsCount = syncResult.locations.length;
      const storesCount = syncResult.stores.length;
      const accountsCount = syncResult.accounts.length;

      const isDegraded = locationsCount === 0 && storesCount === 0;

      const result: DiagnosticResult = {
        success: !isDegraded,
        status: isDegraded ? 'DEGRADED' : 'CONNECTED',
        connectionState: isDegraded ? 'DISCONNECTED' : 'HEALTHY',
        message: isDegraded
          ? `Connected to Deliverect OAuth, but zero physical locations or channel links were found for account mapping.`
          : `Live Deliverect connection verified (${latencyMs}ms). Authoritative channel mapped: ${accountsCount} account(s), ${locationsCount} location(s), ${storesCount} store(s).`,
        latencyMs,
        environment: env,
        accountsCount,
        locationsCount,
        storesCount,
        timestamp: new Date().toISOString(),
      };

      await this.persistDiagnostic(tenantId, integrationId, result, options?.actor);
      return result;
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const result: DiagnosticResult = {
        success: false,
        status: 'ERROR',
        connectionState: 'DISCONNECTED',
        message: `Upstream Deliverect API call failed: ${err.message}`,
        latencyMs,
        environment: env,
        timestamp: new Date().toISOString(),
      };

      await this.persistDiagnostic(tenantId, integrationId, result, options?.actor);
      return result;
    }
  }

  private static async persistDiagnostic(
    tenantId: string,
    integrationId: string,
    diagnostic: DiagnosticResult,
    actor?: { uid: string; name: string; role: string }
  ): Promise<void> {
    const db = getFirestoreDb();

    const integrationUpdate: Partial<DeliverectIntegration> = {
      integrationId,
      tenantId,
      environment: diagnostic.environment,
      status: diagnostic.status,
      connectionState: diagnostic.connectionState,
      lastCheckedAt: diagnostic.timestamp,
      diagnosticMessage: diagnostic.message,
    };

    if (db) {
      try {
        await db.collection('integrations').doc(tenantId).set(integrationUpdate, { merge: true });
      } catch (err) {
        console.warn(`[ConnectionDiagnostics] Failed to persist integration to Firestore:`, err);
      }
    }

    // Also update via platform service in-memory store
    try {
      await FirestorePlatformService.updateIntegrationConfig(tenantId, {
        environment: diagnostic.environment,
        status: diagnostic.status === 'CONNECTED'
          ? 'connected'
          : diagnostic.status === 'ERROR' || diagnostic.status === 'DEGRADED' || diagnostic.status === 'CHECKING'
            ? 'error'
            : diagnostic.status,
        lastSyncAt: diagnostic.timestamp,
      });
    } catch {
      // Ignored in test fallback
    }

    // Emit structured audit log
    try {
      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: actor?.uid || 'system',
        userName: actor?.name || 'Integration Diagnostics Engine',
        userRole: (actor?.role as any) || 'platformSuperAdmin',
        tenantId,
        category: 'Integration',
        action: diagnostic.success ? 'TEST_CONNECTION_SUCCESS' : 'TEST_CONNECTION_FAILED',
        details: `Diagnostic status: ${diagnostic.status} (${diagnostic.latencyMs}ms). ${diagnostic.message}`,
      });
    } catch {
      // Audit log fallback
    }
  }
}
