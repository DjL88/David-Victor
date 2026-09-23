import { GoogleAuth } from 'google-auth-library';
import { getFirebaseConfig } from './firebase';

export interface FirebaseAuthDomainSyncResult {
  hostname: string;
  projectId: string;
  changed: boolean;
  authorizedDomains: string[];
}

export function normalizeAuthorizedDomain(hostname: string): string {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0];
}

export function isAuthorizableFirebaseDomain(hostname: string): boolean {
  const clean = normalizeAuthorizedDomain(hostname);
  if (!clean) return false;
  if (clean === 'localhost' || clean === '127.0.0.1') return false;
  if (!/^[a-z0-9.-]+$/.test(clean) || !clean.includes('.')) return false;
  return true;
}

/**
 * Keeps Firebase Authentication's authorizedDomains in sync with domains that
 * have already completed platform ownership verification.
 *
 * This must only be called after the domain lifecycle marks a hostname ACTIVE.
 * Adding a pending/unverified hostname here would weaken the domain-ownership boundary.
 */
export class FirebaseAuthDomainService {
  static async ensureAuthorizedDomain(hostname: string): Promise<FirebaseAuthDomainSyncResult> {
    const cleanHost = normalizeAuthorizedDomain(hostname);
    if (!isAuthorizableFirebaseDomain(cleanHost)) {
      throw new Error('A valid non-local hostname is required for Firebase Auth authorization.');
    }

    const config = getFirebaseConfig();
    const projectId =
      config?.projectId ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GOOGLE_CLOUD_PROJECT;

    if (!projectId) {
      throw new Error('Firebase project ID is not configured.');
    }

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const accessTokenResult = await client.getAccessToken();
    const accessToken =
      typeof accessTokenResult === 'string'
        ? accessTokenResult
        : accessTokenResult?.token;

    if (!accessToken) {
      throw new Error('Unable to obtain Google access token for Firebase Auth configuration.');
    }

    const configName = `projects/${projectId}/config`;
    const endpoint =
      `https://identitytoolkit.googleapis.com/admin/v2/${configName}`;

    const currentResponse = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!currentResponse.ok) {
      const body = await currentResponse.text().catch(() => '');
      throw new Error(
        `Unable to read Firebase Auth config (HTTP ${currentResponse.status})${body ? `: ${body.slice(0, 300)}` : ''}`
      );
    }

    const current = await currentResponse.json() as { authorizedDomains?: string[] };
    const authorizedDomains = Array.from(new Set(
      (current.authorizedDomains || [])
        .map(normalizeAuthorizedDomain)
        .filter(Boolean)
    ));

    if (authorizedDomains.includes(cleanHost)) {
      return {
        hostname: cleanHost,
        projectId,
        changed: false,
        authorizedDomains,
      };
    }

    const nextDomains = [...authorizedDomains, cleanHost].sort();
    const updateResponse = await fetch(
      `${endpoint}?updateMask=authorizedDomains`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: configName,
          authorizedDomains: nextDomains,
        }),
      }
    );

    if (!updateResponse.ok) {
      const body = await updateResponse.text().catch(() => '');
      throw new Error(
        `Unable to authorize domain in Firebase Auth (HTTP ${updateResponse.status})${body ? `: ${body.slice(0, 300)}` : ''}`
      );
    }

    return {
      hostname: cleanHost,
      projectId,
      changed: true,
      authorizedDomains: nextDomains,
    };
  }
}
