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

import { SecretManager } from '../secrets';

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
  }

  /**
   * Returns current cached token record if any.
   */
  getCachedToken(): TokenRecord | null {
    return this.cachedToken;
  }

  /**
   * Retrieves a valid bearer token, reusing the cached token if valid.
   * Prevents token stampede by sharing a single in-flight promise.
   */
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

    // If an exchange is already in progress, await the existing promise to prevent stampede
    if (this.inFlightTokenPromise) {
      return this.inFlightTokenPromise;
    }

    this.inFlightTokenPromise = this.requestFreshToken().finally(() => {
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
      };

      if (!data.access_token) {
        throw new Error('Deliverect OAuth response did not contain an access_token');
      }

      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 3600;
      this.cachedToken = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + expiresInSec * 1000,
      };

      return this.cachedToken.accessToken;
    } catch (err: any) {
      this.cachedToken = null;
      throw err;
    }
  }
}
