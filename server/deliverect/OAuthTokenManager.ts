/**
 * Deliverect OAuth Token Manager
 *
 * Implements client_credentials flow with environment-aware endpoints:
 * - Staging: https://api.staging.deliverect.com/oauth/token with audience https://api.staging.deliverect.com
 * - Production: https://api.deliverect.com/oauth/token with audience https://api.deliverect.com
 *
 * Requirements:
 * - Server only: tokens never exposed to the client.
 * - In-memory caching until expires_at with 60s safety buffer.
 * - Prevents token stampede via in-flight promise memoization.
 * - Throws genuine upstream errors on invalid credentials; ZERO demo fallback.
 */

import { createHash, randomUUID } from 'node:crypto';
import { SecretManager } from '../secrets';
import { getFirestoreDb } from '../firebase';

export const DELIVERECT_ENVIRONMENTS = {
  staging: {
    baseUrl: 'https://api.staging.deliverect.com',
    tokenUrl: 'https://api.staging.deliverect.com/oauth/token',
    audience: 'https://api.staging.deliverect.com',
  },
  production: {
    baseUrl: 'https://api.deliverect.com',
    tokenUrl: 'https://api.deliverect.com/oauth/token',
    audience: 'https://api.deliverect.com',
  },
} as const;

export type DeliverectEnvironmentName = keyof typeof DELIVERECT_ENVIRONMENTS;

export interface TokenRecord {
  accessToken: string;
  tokenType: string;
  expiresAt: number; // Unix timestamp in ms
  /** Space-delimited OAuth scopes returned by Deliverect/Auth0. */
  scope?: string;
}

export class OAuthTokenManager {
  private static instances = new Map<string, OAuthTokenManager>();

  static getInstance(
    tenantOrOptions?: string | {
      environment?: DeliverectEnvironmentName;
      clientId?: string;
      clientSecret?: string;
    },
    maybeOptions?: {
      environment?: DeliverectEnvironmentName;
      clientId?: string;
      clientSecret?: string;
    }
  ): OAuthTokenManager {
    const opts = typeof tenantOrOptions === 'object' && tenantOrOptions !== null
      ? tenantOrOptions
      : maybeOptions;

    const tenantId = typeof tenantOrOptions === 'string' ? tenantOrOptions : undefined;
    const cleanTenant = tenantId ? tenantId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() : '';
    const tenantCid = cleanTenant ? process.env[`DELIVERECT_CLIENT_ID_${cleanTenant}`] : undefined;
    const tenantSec = cleanTenant ? process.env[`DELIVERECT_CLIENT_SECRET_${cleanTenant}`] : undefined;

    const env = (opts?.environment || process.env.DELIVERECT_ENV || 'staging').toLowerCase() as DeliverectEnvironmentName;
    const cid = opts?.clientId || tenantCid || process.env.DELIVERECT_CLIENT_ID || '';
    const sec = opts?.clientSecret || tenantSec || process.env.DELIVERECT_CLIENT_SECRET || '';
    const key = `${tenantId ? `${tenantId}:` : ''}${env}:${cid || 'default'}`;

    let instance = this.instances.get(key);
    if (!instance || (sec && instance.clientSecret !== sec)) {
      instance = new OAuthTokenManager({
        environment: env,
        clientId: cid,
        clientSecret: sec,
      });
      this.instances.set(key, instance);
    }
    return instance;
  }

  static clearInstances(): void {
    this.instances.clear();
  }

  static clearAll(): void {
    this.instances.clear();
  }

  private environment: DeliverectEnvironmentName;
  private clientId: string;
  private clientSecret: string;

  private cachedToken: TokenRecord | null = null;
  private inFlightTokenPromise: Promise<string> | null = null;
  private readonly cacheOwnerId = randomUUID();

  private get sharedCacheKey(): string {
    // Key by the complete credential/audience identity without persisting either
    // credential. Rotating a secret therefore cannot accidentally reuse a token
    // minted for the previous credential set.
    return createHash('sha256')
      .update([this.environment, this.config.audience, this.clientId, this.clientSecret].join('|'))
      .digest('hex');
  }

  private async claimSharedToken(): Promise<{ token: TokenRecord | null; claimed: boolean }> {
    const db = getFirestoreDb();
    if (!db) return { token: null, claimed: true };

    const ref = db.collection('integrationOAuthTokenCache').doc(this.sharedCacheKey);
    const now = Date.now();
    const leaseMs = 15_000;

    try {
      return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists ? snap.data() : undefined;
      const expiresAt = Number(data?.expiresAt || 0);
      if (data?.accessToken && now < expiresAt - 60_000) {
        return {
          token: {
            accessToken: String(data.accessToken),
            tokenType: String(data.tokenType || 'Bearer'),
            expiresAt,
            scope: data.scope ? String(data.scope) : undefined,
          },
          claimed: false,
        };
      }

      const leaseUntil = Number(data?.leaseUntil || 0);
      const leaseOwner = String(data?.leaseOwner || '');
      if (leaseUntil > now && leaseOwner && leaseOwner !== this.cacheOwnerId) {
        return { token: null, claimed: false };
      }

      tx.set(ref, {
        environment: this.environment,
        audience: this.config.audience,
        clientIdHash: createHash('sha256').update(this.clientId).digest('hex'),
        leaseOwner: this.cacheOwnerId,
        leaseUntil: now + leaseMs,
        updatedAt: new Date(now).toISOString(),
      }, { merge: true });
      return { token: null, claimed: true };
      });
    } catch (err) {
      // OAuth remains available if the shared cache is temporarily degraded;
      // the local in-flight guard still prevents a per-instance stampede.
      console.warn('[OAuthTokenManager] Shared token cache unavailable; using local refresh guard:', err);
      return { token: null, claimed: true };
    }
  }

  private async awaitSharedTokenOrClaim(): Promise<TokenRecord | null> {
    // A lease is deliberately short. Waiting instances poll the shared record
    // rather than creating an OAuth stampede across Cloud Run instances.
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const state = await this.claimSharedToken();
      if (state.token) return state.token;
      if (state.claimed) return null;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    // The lease has expired (or its owner died); the next transaction can claim it.
    const finalState = await this.claimSharedToken();
    return finalState.token;
  }

  private async publishSharedToken(token: TokenRecord): Promise<void> {
    const db = getFirestoreDb();
    if (!db) return;
    const ref = db.collection('integrationOAuthTokenCache').doc(this.sharedCacheKey);
    await ref.set({
      environment: this.environment,
      audience: this.config.audience,
      clientIdHash: createHash('sha256').update(this.clientId).digest('hex'),
      accessToken: token.accessToken,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt,
      scope: token.scope || null,
      leaseOwner: null,
      leaseUntil: 0,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }

  private async releaseSharedLease(): Promise<void> {
    const db = getFirestoreDb();
    if (!db) return;
    const ref = db.collection('integrationOAuthTokenCache').doc(this.sharedCacheKey);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data()?.leaseOwner === this.cacheOwnerId) {
        tx.set(ref, { leaseOwner: null, leaseUntil: 0, updatedAt: new Date().toISOString() }, { merge: true });
      }
    });
  }

  constructor(options?: {
    environment?: DeliverectEnvironmentName;
    clientId?: string;
    clientSecret?: string;
  }) {
    const rawEnv = (options?.environment || process.env.DELIVERECT_ENV || 'staging').toLowerCase();
    this.environment = rawEnv === 'production' ? 'production' : 'staging';
    this.clientId = options?.clientId || process.env.DELIVERECT_CLIENT_ID || '';
    this.clientSecret = options?.clientSecret || process.env.DELIVERECT_CLIENT_SECRET || '';
  }

  get config() {
    return DELIVERECT_ENVIRONMENTS[this.environment];
  }

  get isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Clears the in-memory token cache (useful upon receiving a 401 from an upstream API call).
   */
  invalidateCache(): void {
    this.cachedToken = null;
    void this.deleteSharedToken().catch((err) => {
      console.warn('[OAuthTokenManager] Shared token invalidation failed:', err);
    });
  }

  /** Admin diagnostics can await this to guarantee the next scope reading is
   * minted after a Deliverect client grant has changed. */
  async invalidateCacheAndWait(): Promise<void> {
    this.cachedToken = null;
    await this.deleteSharedToken();
  }

  private async deleteSharedToken(): Promise<void> {
    const db = getFirestoreDb();
    if (db && this.clientId && this.clientSecret) {
      await db.collection('integrationOAuthTokenCache').doc(this.sharedCacheKey).delete();
    }
  }

  /**
   * Returns current cached token record if any.
   */
  getCachedToken(): TokenRecord | null {
    return this.cachedToken;
  }

  /**
   * Returns granted OAuth scopes, refreshing the token first when necessary.
   * Deliverect Channel API credentials include a scope in the form
   * genericChannel:<channel_scope>.
   */
  async getGrantedScopes(): Promise<string[]> {
    await this.getAccessToken();
    const rawScope = String(this.cachedToken?.scope || '').trim();
    if (!rawScope) return [];
    return Array.from(
      new Set(
        rawScope
          .split(/\s+/)
          .map((scope) => scope.trim())
          .filter(Boolean)
      )
    );
  }

  /**
   * Returns all channel names granted by genericChannel:<channel_scope>.
   * The Channel Create Order URL uses only the suffix, in lowercase.
   */
  async getChannelScopeNames(): Promise<string[]> {
    const scopes = await this.getGrantedScopes();
    return Array.from(
      new Set(
        scopes
          .map((scope) => {
            const match = scope.match(/^genericChannel:(.+)$/i);
            return match ? match[1].trim().toLowerCase() : '';
          })
          .filter(Boolean)
      )
    );
  }

  /**
   * Retrieves a valid bearer token, reusing the cached token if valid.
   * Prevents token stampede by sharing a single in-flight promise.
   */
  async getAuthorizationHeader(): Promise<string> {
    const token = await this.getAccessToken();
    return `Bearer ${token}`;
  }

  async getAccessToken(): Promise<string> {
    if (!this.clientId) {
      this.clientId = (await SecretManager.getSecret('DELIVERECT_CLIENT_ID')) || '';
    }
    if (!this.clientSecret) {
      this.clientSecret = (await SecretManager.getSecret('DELIVERECT_CLIENT_SECRET')) || '';
    }

    if (!this.isConfigured) {
      const error: any = new Error(
        `Deliverect OAuth is not configured. Missing DELIVERECT_CLIENT_ID or DELIVERECT_CLIENT_SECRET for environment "${this.environment}".`
      );
      error.status = 503;
      error.code = 'INTEGRATION_NOT_CONFIGURED';
      throw error;
    }

    // Safety window: refresh 60 seconds before expiry
    const now = Date.now();
    if (this.cachedToken && now < this.cachedToken.expiresAt - 60_000) {
      return this.cachedToken.accessToken;
    }

    // Prevent both in-process and cross-instance token stampedes. In live
    // Firestore-backed deployments, one instance claims a short refresh lease
    // and every other instance reuses the published token.
    if (this.inFlightTokenPromise) {
      return this.inFlightTokenPromise;
    }

    const shared = await this.awaitSharedTokenOrClaim();
    if (shared) {
      this.cachedToken = shared;
      return shared.accessToken;
    }

    // A second caller in this process may have reached the shared lease while
    // the first caller was awaiting Firestore.
    if (this.inFlightTokenPromise) {
      return this.inFlightTokenPromise;
    }

    this.inFlightTokenPromise = this.requestFreshToken()
      .then(async (token) => {
        if (this.cachedToken) {
          await this.publishSharedToken(this.cachedToken).catch((err) => {
            console.warn('[OAuthTokenManager] Could not publish shared token cache:', err);
          });
        }
        return token;
      })
      .catch(async (err) => {
        await this.releaseSharedLease().catch(() => undefined);
        throw err;
      })
      .finally(() => {
        this.inFlightTokenPromise = null;
      });

    return this.inFlightTokenPromise;
  }

  async getValidToken(): Promise<string> {
    return this.getAccessToken();
  }

  private async requestFreshToken(): Promise<string> {
    const { tokenUrl, audience } = this.config;

    console.log(`[OAuthTokenManager] Requesting fresh token from upstream (${this.environment}): ${tokenUrl}`);
    console.log(`[OAuthTokenManager] Params: audience="${audience}", clientId="${this.clientId ? `${this.clientId.slice(0, 4)}...${this.clientId.slice(-4)}` : '(none)'}"`);

    try {
      console.log('[Platform OAuth] DELIVERECT_OAUTH_REQUEST_SENT: true');
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          audience,
          grant_type: 'client_credentials',
        }),
      });

      console.log('[Platform OAuth] DELIVERECT_OAUTH_HTTP_STATUS:', response.status);
      console.log(`[OAuthTokenManager] Upstream OAuth response: HTTP ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error(`[OAuthTokenManager] Upstream OAuth rejection (HTTP ${response.status}): ${errorText}`);
        const error: any = new Error(
          `Deliverect OAuth token request failed (${response.status}): ${errorText || response.statusText}`
        );
        error.status = response.status;
        error.code = response.status === 401 ? 'INTEGRATION_AUTH_FAILED' : 'UPSTREAM_AUTH_ERROR';
        throw error;
      }

      const data = (await response.json()) as {
        access_token: string;
        token_type?: string;
        expires_in: number;
        scope?: string | string[];
      };

      const decodeJwtScope = (accessToken: string): string => {
        try {
          const parts = accessToken.split('.');
          if (parts.length !== 3) return '';
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8')
          );
          const jwtScope =
            payload?.scope ||
            payload?.scp ||
            (Array.isArray(payload?.permissions)
              ? payload.permissions.join(' ')
              : '');
          return Array.isArray(jwtScope)
            ? jwtScope.join(' ')
            : String(jwtScope || '');
        } catch {
          return '';
        }
      };

      const normalizedScope = Array.isArray(data.scope)
        ? data.scope.join(' ')
        : String(data.scope || decodeJwtScope(data.access_token) || '').trim();

      // Scope is capability metadata, not a credential. Logging it is safe and
      // tells us whether this client can use Commerce only or also Retail Channel
      // APIs required for Quest itemUnavailableActions.
      console.log(
        '[Platform OAuth] DELIVERECT_OAUTH_SCOPE:',
        normalizedScope || 'not_returned'
      );

      if (!data.access_token) {
        throw new Error('Deliverect OAuth response did not contain an access_token');
      }

      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
      this.cachedToken = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + expiresInSec * 1000,
        scope: normalizedScope || undefined,
      };

      return this.cachedToken.accessToken;
    } catch (err: any) {
      this.cachedToken = null;
      throw err;
    }
  }
}
