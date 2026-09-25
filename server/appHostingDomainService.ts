import { randomUUID } from 'node:crypto';
import { GoogleAuth } from 'google-auth-library';

export interface AppHostingDnsRecord {
  domainName: string;
  type: string;
  rdata: string;
  action: 'ADD' | 'REMOVE' | string;
}

export interface AppHostingDomainStatus {
  resourceName: string;
  hostname: string;
  hostState: string;
  ownershipState: string;
  certState: string;
  requiredDnsRecords: AppHostingDnsRecord[];
  issues: string[];
  reconciling: boolean;
  active: boolean;
}

type GoogleDomain = {
  name?: string;
  reconciling?: boolean;
  customDomainStatus?: {
    hostState?: string;
    ownershipState?: string;
    certState?: string;
    requiredDnsUpdates?: Array<{
      domainName?: string;
      desired?: Array<{
        domainName?: string;
        records?: Array<{
          domainName?: string;
          type?: string;
          rdata?: string;
          requiredAction?: string;
        }>;
      }>;
    }>;
    issues?: Array<{ message?: string }>;
  };
};

function cleanHostname(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .split(':')[0];
}

function config() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.APP_HOSTING_LOCATION || 'europe-west4';
  const backendId = process.env.APP_HOSTING_BACKEND_ID;
  if (!projectId || !backendId) {
    throw new Error('App Hosting domain provisioning is not configured.');
  }
  const parent = `projects/${projectId}/locations/${location}/backends/${backendId}`;
  return { projectId, location, backendId, parent };
}

export function normalizeAppHostingDomain(hostname: string, domain: GoogleDomain): AppHostingDomainStatus {
  const status = domain.customDomainStatus || {};
  const requiredDnsRecords: AppHostingDnsRecord[] = [];
  for (const update of status.requiredDnsUpdates || []) {
    for (const desired of update.desired || []) {
      for (const record of desired.records || []) {
        if (!record.type || !record.rdata) continue;
        requiredDnsRecords.push({
          domainName: record.domainName || desired.domainName || update.domainName || hostname,
          type: record.type,
          rdata: record.rdata,
          action: record.requiredAction || 'ADD',
        });
      }
    }
  }
  const hostState = status.hostState || 'HOST_STATE_UNSPECIFIED';
  const ownershipState = status.ownershipState || 'OWNERSHIP_STATE_UNSPECIFIED';
  const certState = status.certState || 'CERT_STATE_UNSPECIFIED';
  return {
    resourceName: domain.name || `${config().parent}/domains/${hostname}`,
    hostname,
    hostState,
    ownershipState,
    certState,
    requiredDnsRecords,
    issues: (status.issues || []).map((issue) => issue.message || '').filter(Boolean),
    reconciling: Boolean(domain.reconciling),
    active:
      hostState === 'HOST_ACTIVE' &&
      ownershipState === 'OWNERSHIP_ACTIVE' &&
      certState === 'CERT_ACTIVE',
  };
}

async function accessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tokenResult = await client.getAccessToken();
  const token = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token;
  if (!token) throw new Error('Unable to obtain Google access token for App Hosting.');
  return token;
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
}

export class AppHostingDomainService {
  static isConfigured(): boolean {
    return Boolean(
      (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) &&
      process.env.APP_HOSTING_BACKEND_ID
    );
  }

  static async get(hostnameValue: string): Promise<AppHostingDomainStatus> {
    const hostname = cleanHostname(hostnameValue);
    const { parent } = config();
    const response = await request(
      `https://firebaseapphosting.googleapis.com/v1/${parent}/domains/${encodeURIComponent(hostname)}`
    );
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      const error: any = new Error(`Unable to read App Hosting domain (HTTP ${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
      error.statusCode = response.status;
      throw error;
    }
    return normalizeAppHostingDomain(hostname, await response.json() as GoogleDomain);
  }

  static async create(hostnameValue: string): Promise<AppHostingDomainStatus> {
    const hostname = cleanHostname(hostnameValue);
    const { parent } = config();
    const endpoint = `https://firebaseapphosting.googleapis.com/v1/${parent}/domains?domainId=${encodeURIComponent(hostname)}&requestId=${randomUUID()}`;
    const response = await request(endpoint, {
      method: 'POST',
      body: JSON.stringify({ displayName: hostname }),
    });
    if (!response.ok && response.status !== 409) {
      const body = await response.text().catch(() => '');
      const error: any = new Error(`Unable to link domain to App Hosting (HTTP ${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
      error.statusCode = response.status;
      throw error;
    }

    // Creation is a long-running operation. The domain resource is normally
    // readable immediately; retry briefly so Admin can return exact DNS records.
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.get(hostname);
      } catch (error: any) {
        lastError = error;
        if (error?.statusCode !== 404) throw error;
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
    throw lastError || new Error('App Hosting domain creation is still pending.');
  }

  static async delete(hostnameValue: string): Promise<void> {
    const hostname = cleanHostname(hostnameValue);
    const { parent } = config();
    const response = await request(
      `https://firebaseapphosting.googleapis.com/v1/${parent}/domains/${encodeURIComponent(hostname)}`,
      { method: 'DELETE' }
    );
    if (!response.ok && response.status !== 404) {
      const body = await response.text().catch(() => '');
      const error: any = new Error(`Unable to remove App Hosting domain (HTTP ${response.status})${body ? `: ${body.slice(0, 300)}` : ''}`);
      error.statusCode = response.status;
      throw error;
    }
  }
}
