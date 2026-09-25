import crypto from 'crypto';
import type { Request } from 'express';
import { BFFError } from './errors';
import { FirestorePlatformService } from './firestoreService';
import { isDemoMode, isTestMode } from './runtimeMode';

export type TenantResolutionSource =
  | 'host'
  | 'admin'
  | 'preview-token'
  | 'preview-env'
  | 'test';

export interface TenantResolution {
  tenantId: string;
  source: TenantResolutionSource;
  host: string;
  usedOverride: boolean;
}

const DEFAULT_PREVIEW_SUFFIXES = [
  'hosted.app',
  'run.app',
  'web.app',
  'firebaseapp.com',
  'ai.studio',
  'googleusercontent.com',
];

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left || '', 'utf8');
  const b = Buffer.from(right || '', 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function firstHeaderValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || '').split(',')[0].trim();
}

export function normalizeHostname(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/\.$/, '');
}

export function hasTrustedEdgeProof(
  req: Pick<Request, 'headers'>,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const expected = String(env.TRUSTED_EDGE_SECRET || '');
  if (!expected) return false;
  const configuredHeader = String(env.TRUSTED_EDGE_HEADER || 'x-bwydi-edge-secret').toLowerCase();
  const supplied = firstHeaderValue(req.headers[configuredHeader] as string | string[] | undefined);
  return Boolean(supplied) && safeEqual(supplied, expected);
}

/**
 * Never trust X-Forwarded-Host from the public internet. It is only accepted
 * when the configured edge secret accompanies the request.
 */
export function getTrustedRequestHost(
  req: Pick<Request, 'headers' | 'hostname'>,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (hasTrustedEdgeProof(req, env)) {
    const forwarded = normalizeHostname(firstHeaderValue(req.headers['x-forwarded-host'] as string | string[] | undefined));
    if (forwarded) return forwarded;
  }

  const directHost = normalizeHostname(firstHeaderValue(req.headers.host as string | string[] | undefined));
  if (directHost) return directHost;
  return normalizeHostname(req.hostname || '');
}

export function getTrustedRequestProtocol(
  req: Pick<Request, 'headers' | 'protocol'>,
  env: NodeJS.ProcessEnv = process.env
): string {
  if (hasTrustedEdgeProof(req as any, env)) {
    const forwarded = firstHeaderValue(req.headers['x-forwarded-proto'] as string | string[] | undefined).toLowerCase();
    if (forwarded === 'https' || forwarded === 'http') return forwarded;
  }
  return req.protocol || 'https';
}

export function previewHostSuffixes(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = String(env.PREVIEW_HOST_SUFFIXES || '')
    .split(',')
    .map((value) => normalizeHostname(value.replace(/^\*\./, '')))
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_PREVIEW_SUFFIXES;
}

export function isManagedPreviewHost(
  hostname: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const host = normalizeHostname(hostname);
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1') return true;

  return previewHostSuffixes(env).some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

function requestedTenantOverride(req: Request): string | undefined {
  const header = firstHeaderValue(req.headers['x-tenant-id'] as string | string[] | undefined);
  const query = typeof req.query?.tenantId === 'string' ? req.query.tenantId.trim() : '';
  return header || query || undefined;
}

function hasPreviewToken(req: Request, env: NodeJS.ProcessEnv): boolean {
  const expected = String(env.PREVIEW_AUTH_TOKEN || '');
  const supplied = firstHeaderValue(req.headers['x-preview-auth-token'] as string | string[] | undefined);
  return Boolean(expected && supplied) && safeEqual(supplied, expected);
}

/**
 * Single public tenant resolver.
 *
 * Managed preview hosts are server-bound to PREVIEW_TENANT_ID: caller supplied
 * headers/query strings cannot switch brands. Custom hosts must have an exact
 * ACTIVE domain mapping. Explicit overrides are reserved for authenticated
 * platform admins, the configured preview token, or test harnesses.
 */
export async function resolveRequestTenant(
  req: Request,
  env: NodeJS.ProcessEnv = process.env
): Promise<TenantResolution> {
  const host = getTrustedRequestHost(req, env);
  const override = requestedTenantOverride(req);
  const admin = (req as any).adminUser;
  const isSuperAdmin = admin?.role === 'platformSuperAdmin' || admin?.isSuperAdmin === true;
  const simulatedPublicRequest =
    (req as any).simulatePublicRequest === true ||
    (isTestMode() && firstHeaderValue(req.headers['x-test-simulate-public'] as string | string[] | undefined) === 'true');
  const localTestHost = host === 'localhost' || host === '127.0.0.1';

  // App Hosting terminates custom domains at its CDN before invoking the
  // backend. Depending on the edge path, the original hostname is exposed as
  // X-Forwarded-Host, Firebase's X-FH-Requested-Host, or the browser-supplied
  // X-Storefront-Host used by this SPA. Every candidate is still fail-closed:
  // only an exact ACTIVE domain registry record may select a tenant.
  if (isManagedPreviewHost(host, env)) {
    const edgeCandidates = [
      firstHeaderValue(req.headers['x-forwarded-host'] as string | string[] | undefined),
      firstHeaderValue(req.headers['x-fh-requested-host'] as string | string[] | undefined),
      firstHeaderValue(req.headers['x-storefront-host'] as string | string[] | undefined),
    ].map(normalizeHostname).filter((candidate, index, all) =>
      Boolean(candidate) && candidate !== host && !isManagedPreviewHost(candidate, env) && all.indexOf(candidate) === index
    );

    for (const candidate of edgeCandidates) {
      const candidateTenant = await FirestorePlatformService.resolveTenantByHostname(candidate);
      if (candidateTenant) {
        return {
          tenantId: candidateTenant,
          source: 'host',
          host: candidate,
          // App Hosting cannot safely cache arbitrary Vary headers. Mark the
          // response private so one tenant's payload cannot bleed into another.
          usedOverride: true,
        };
      }
    }
  }

  if (admin && !isSuperAdmin && admin.tenantId) {
    return {
      tenantId: String(admin.tenantId),
      source: 'admin',
      host,
      usedOverride: false,
    };
  }

  // Local HTTP harnesses may select fixtures explicitly; remote managed
  // preview hosts never accept this shortcut.
  if (localTestHost && override && isTestMode() && !simulatedPublicRequest) {
    return { tenantId: override, source: 'test', host, usedOverride: true };
  }

  // Managed/preview infrastructure is pinned by server configuration. Do this
  // before considering caller-controlled overrides.
  if (isManagedPreviewHost(host, env)) {
    const previewTenantId = String(env.PREVIEW_TENANT_ID || '').trim();
    if (previewTenantId) {
      return {
        tenantId: previewTenantId,
        source: 'preview-env',
        host,
        usedOverride: false,
      };
    }

    // Local demo/test remains intentionally explicit and never applies to a
    // real hosted suffix.
    if ((host === 'localhost' || host === '127.0.0.1') && (isDemoMode() || isTestMode())) {
      return {
        tenantId: 'brand-alpha',
        source: 'test',
        host,
        usedOverride: false,
      };
    }

    throw new BFFError(
      'PREVIEW_TENANT_NOT_CONFIGURED',
      'This managed preview host has no configured tenant.',
      503
    );
  }

  if (override && isSuperAdmin) {
    return { tenantId: override, source: 'admin', host, usedOverride: true };
  }

  if (override && hasPreviewToken(req, env)) {
    return { tenantId: override, source: 'preview-token', host, usedOverride: true };
  }

  if (override && isTestMode() && !simulatedPublicRequest) {
    return { tenantId: override, source: 'test', host, usedOverride: true };
  }

  const resolved = await FirestorePlatformService.resolveTenantByHostname(host);
  if (resolved) {
    return { tenantId: resolved, source: 'host', host, usedOverride: false };
  }

  throw new BFFError(
    'TENANT_NOT_FOUND',
    `Tenant not found for domain "${host}".`,
    404
  );
}

export function applyTenantResolutionCacheHeaders(
  res: { setHeader(name: string, value: string): unknown; getHeader?(name: string): unknown },
  resolution?: TenantResolution
): void {
  res.setHeader('Vary', 'Host, X-Forwarded-Host, X-FH-Requested-Host, X-Storefront-Host');
  if (resolution?.usedOverride) {
    res.setHeader('Cache-Control', 'private, no-store');
  }
}
