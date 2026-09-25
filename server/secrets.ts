/**
 * Google Secret Manager & Environment Configuration Abstraction
 * 
 * In production Google Cloud Run environments, sensitive secrets (e.g. DELIVERECT_CLIENT_SECRET,
 * WEBHOOK_HMAC_SECRET) can be resolved directly from Google Secret Manager or mounted
 * as environment secrets via Cloud Run container configuration.
 * 
 * Never expose secrets to the client browser or bundle them in VITE_* variables.
 */

import { BFFError } from './errors';

const secretCache = new Map<string, { value: string; cachedAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

let gcpSecretClient: any = null;

function getGcpSecretClient(): any {
  if (gcpSecretClient === null) {
    try {
      const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
      gcpSecretClient = new SecretManagerServiceClient();
    } catch (err: any) {
      gcpSecretClient = false; // Mark as unavailable to prevent retry loops
    }
  }
  return gcpSecretClient || null;
}

export class SecretManager {
  /**
   * Retrieves a secret by name.
   * Priority:
   * 1. In-memory cache (TTL: 10 mins)
   * 2. Direct environment variables (process.env)
   * 3. Google Secret Manager API (projects/{projectId}/secrets/{secretName}/versions/latest)
   */
  static async getSecret(secretName: string): Promise<string | null> {
    const cached = secretCache.get(secretName);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    // 1. Direct process.env resolution (e.g., from Cloud Run Secret Volume or Env Secret)
    const envVal = process.env[secretName];
    if (envVal && envVal.trim().length > 0) {
      secretCache.set(secretName, { value: envVal.trim(), cachedAt: Date.now() });
      return envVal.trim();
    }

    // 2. Google Secret Manager resolution
    let firebaseProjectId: string | null = null;
    try {
      if (process.env.FIREBASE_CONFIG) {
        firebaseProjectId = JSON.parse(process.env.FIREBASE_CONFIG).projectId || null;
      }
    } catch {
      // ignore
    }
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || firebaseProjectId;
    if (projectId) {
      const client = getGcpSecretClient();
      if (client) {
        try {
          const formattedName = `projects/${projectId}/secrets/${secretName}/versions/latest`;
          const [version] = await client.accessSecretVersion({ name: formattedName });
          const payload = version?.payload?.data?.toString('utf8');
          if (payload && payload.trim().length > 0) {
            const trimmed = payload.trim();
            secretCache.set(secretName, { value: trimmed, cachedAt: Date.now() });
            return trimmed;
          }
        } catch {
          // Fall through gracefully if secret does not exist in Secret Manager or permissions are missing
        }
      }
    }

    // In local demo or unit test environments, return null safely without crashing
    return null;
  }

  /**
   * Checks if a secret is configured in the environment or cache.
   */
  static async isConfigured(secretName: string): Promise<boolean> {
    const val = await this.getSecret(secretName);
    return val !== null && val.length > 0;
  }

  /**
   * Retrieves a required secret or throws a clear, safe server-side error.
   */
  static async getRequiredSecret(secretName: string): Promise<string> {
    const val = await this.getSecret(secretName);
    if (!val) {
      throw new BFFError(
        'INTERNAL_ERROR',
        `Required server secret "${secretName}" is not configured in this environment.`,
        500
      );
    }
    return val;
  }

  /**
   * Sets a secret in memory cache, with optional persistence to GCP Secret Manager.
   * Returns true if saved successfully (including GSM persistence if requested), or false if GSM persistence failed.
   */
  static async setSecret(secretName: string, value: string, persistToGcp: boolean = false): Promise<boolean> {
    const trimmed = value.trim();
    const previousCachedValue = secretCache.get(secretName);
    secretCache.set(secretName, { value: trimmed, cachedAt: Date.now() });

    if (persistToGcp) {
      let firebaseProjectId: string | null = null;
      try {
        if (process.env.FIREBASE_CONFIG) {
          firebaseProjectId = JSON.parse(process.env.FIREBASE_CONFIG).projectId || null;
        }
      } catch {
        // ignore
      }
      const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || firebaseProjectId;
      if (!projectId) {
        if (previousCachedValue) secretCache.set(secretName, previousCachedValue);
        else secretCache.delete(secretName);
        console.warn(`[SecretManager] GCP Project ID unavailable; cannot persist secret ${secretName} to Secret Manager.`);
        return false;
      }

      const client = getGcpSecretClient();
      if (!client) {
        if (previousCachedValue) secretCache.set(secretName, previousCachedValue);
        else secretCache.delete(secretName);
        console.warn(`[SecretManager] GCP Secret Manager client unavailable; cannot persist secret ${secretName}.`);
        return false;
      }

      try {
        const parent = `projects/${projectId}`;
        try {
          await client.addSecretVersion({
            parent: `${parent}/secrets/${secretName}`,
            payload: {
              data: Buffer.from(trimmed, 'utf8'),
            },
          });
        } catch (err: any) {
          if (err.code === 5 /* NOT_FOUND */) {
            const replicationLocations = String(
              process.env.SECRET_MANAGER_REPLICATION_LOCATIONS || ''
            )
              .split(',')
              .map((location) => location.trim())
              .filter((location) => /^[a-z][a-z0-9-]{1,62}$/.test(location));
            await client.createSecret({
              parent,
              secretId: secretName,
              secret: {
                replication: replicationLocations.length > 0
                  ? {
                      userManaged: {
                        replicas: replicationLocations.map((location) => ({ location })),
                      },
                    }
                  : { automatic: {} },
              },
            });
            await client.addSecretVersion({
              parent: `${parent}/secrets/${secretName}`,
              payload: {
                data: Buffer.from(trimmed, 'utf8'),
              },
            });
          } else {
            throw err;
          }
        }
        return true;
      } catch (err: any) {
        if (previousCachedValue) secretCache.set(secretName, previousCachedValue);
        else secretCache.delete(secretName);
        console.warn(`[SecretManager] Failed to persist secret ${secretName} to GCP:`, err.message);
        return false;
      }
    }

    return true;
  }

  /**
   * Clears the secret cache (used for testing or rotation).
   */
  static clearCache(): void {
    secretCache.clear();
  }
}
