import type { NextFunction, Request, Response } from 'express';

const PREVIEW_PROXY_ENV_KEYS = [
  'PREVIEW_BFF_URL',
  'PUBLISHED_BFF_URL',
  'STABLE_BFF_URL',
] as const;

export function isAiStudioPreviewHost(hostname: string): boolean {
  const host = String(hostname || '').trim().toLowerCase().split(':')[0];
  // Only the ephemeral AI Studio development Cloud Run host needs the
  // published-BFF proxy. A published *.ai.studio storefront is itself the
  // stable backend target and must serve /api/v1 locally; proxying it would
  // point the deployment back at itself.
  return host.startsWith('ais-') && host.endsWith('.run.app');
}

export function resolvePreviewBffBaseUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const raw = PREVIEW_PROXY_ENV_KEYS
    .map((key) => env[key])
    .find((value) => typeof value === 'string' && value.trim().length > 0);

  if (!raw) return null;

  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' && !(env.NODE_ENV === 'test' && url.protocol === 'http:')) {
      return null;
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function requestHost(req: Request): string {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  return (forwarded || req.get('host') || '').toLowerCase().split(':')[0];
}

function forwardedHeaders(
  req: Request,
  env: NodeJS.ProcessEnv = process.env
): Record<string, string> {
  const headers: Record<string, string> = {};
  const allow = [
    'authorization',
    'content-type',
    'accept',
    'x-tenant-id',
    'x-request-id',
    'cache-control',
    'if-none-match',
  ];

  for (const key of allow) {
    const value = req.headers[key];
    if (typeof value === 'string' && value.length > 0) headers[key] = value;
  }

  // Bootstrap runs before the browser knows the active tenant, so ensure the
  // published BFF receives the explicitly configured preview tenant when the
  // request itself does not yet carry X-Tenant-ID.
  if (!headers['x-tenant-id'] && env.PREVIEW_TENANT_ID) {
    headers['x-tenant-id'] = env.PREVIEW_TENANT_ID.trim();
  }

  headers['x-bwydi-preview-proxy'] = 'ai-studio';
  return headers;
}

function requestBody(req: Request): Buffer | string | undefined {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  const rawBody = (req as any).rawBody;
  if (Buffer.isBuffer(rawBody) && rawBody.length > 0) return rawBody;

  if (req.body === undefined || req.body === null) return undefined;
  if (typeof req.body === 'string') return req.body;
  return JSON.stringify(req.body);
}

/**
 * AI Studio preview runs under a Google-managed sandbox service identity which
 * may not have access to the staging Firestore database. Rather than granting
 * that sandbox database IAM, preview can proxy BFF calls to the already
 * published backend by setting PREVIEW_BFF_URL (or PUBLISHED_BFF_URL).
 *
 * Browser requests remain same-origin to the preview, while authentication,
 * tenant headers and JSON bodies are forwarded server-to-server.
 */
export async function aiStudioPreviewBffProxy(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const host = requestHost(req);
  if (!isAiStudioPreviewHost(host)) {
    next();
    return;
  }

  const baseUrl = resolvePreviewBffBaseUrl();
  if (!baseUrl) {
    next();
    return;
  }

  let target: URL;
  try {
    target = new URL(req.originalUrl, baseUrl);
  } catch {
    res.status(500).json({
      error: 'AI Studio preview backend proxy URL is invalid.',
      code: 'PREVIEW_BFF_URL_INVALID',
    });
    return;
  }

  // Protect against accidental self-proxy loops.
  if (target.hostname.toLowerCase() === host) {
    // A self-target means this request is already on the configured stable
    // backend. Fall through to the local v1 router instead of taking the whole
    // storefront/admin offline.
    next();
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardedHeaders(req),
      body: requestBody(req),
      redirect: 'manual',
      signal: controller.signal,
    });

    for (const header of [
      'content-type',
      'cache-control',
      'etag',
      'last-modified',
      'x-request-id',
    ]) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    res.setHeader('x-bwydi-preview-backend', new URL(baseUrl).hostname);
    const body = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).send(body);
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    res.status(502).json({
      error: aborted
        ? 'Published BFF timed out while serving AI Studio preview.'
        : 'Published BFF could not be reached from AI Studio preview.',
      code: aborted ? 'PREVIEW_BFF_TIMEOUT' : 'PREVIEW_BFF_UNREACHABLE',
    });
  } finally {
    clearTimeout(timeout);
  }
}
