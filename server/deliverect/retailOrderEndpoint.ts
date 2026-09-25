import { BFFError } from '../errors';

export interface RetailOrderEndpointConfig {
  baseUrl?: string;
  pathTemplate?: string;
  headers?: Record<string, string>;
}

export interface ResolvedRetailOrderEndpoint {
  url: string;
  headers: Record<string, string>;
  source: {
    baseUrl: 'tenant' | 'env' | 'default';
    pathTemplate: 'tenant' | 'env' | 'default';
    headers: 'tenant' | 'env' | 'default';
  };
}

// Deliverect Retail/Quest orders use the tenant's assigned generic-channel
// scope (currently "leitchtech") plus the retail version header. Keeping the
// channel name configurable avoids coupling other tenants to that scope.
const DEFAULT_TEMPLATE = '/{channelName}/order/{channelLinkId}';
const DEFAULT_HEADERS = { 'x-deliverect-version': 'retail' } as const;
const ALLOWED_HEADERS = new Set(['x-deliverect-version']);
const ALLOWED_VERSIONS = new Set(['retail', 'stable', 'rapid']);
const ALLOWED_PLACEHOLDERS = new Set(['channelName', 'channelLinkId', 'accountId']);

function invalid(message: string): never {
  throw new BFFError('INTEGRATION_CONFIG_INVALID', message, 500);
}

function validateBaseUrl(raw: string): string {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return invalid('Retail order base URL is invalid.'); }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname && parsed.pathname !== '/') ||
    !/(^|\.)deliverect\.(io|com)$/i.test(parsed.hostname)
  ) invalid('Retail order base URL must be an HTTPS Deliverect host with no path, query or credentials.');
  return parsed.origin;
}

export function validateRetailOrderPathTemplate(template: string): string {
  if (!template.startsWith('/') || template.includes('..') || template.includes('://') || template.includes('?') || template.includes('#')) {
    invalid('Retail order path template is invalid.');
  }
  for (const match of template.matchAll(/\{([^}]+)\}/g)) {
    if (!ALLOWED_PLACEHOLDERS.has(match[1])) invalid('Retail order path template contains an unsupported placeholder.');
  }
  if (/[{}]/.test(template.replace(/\{(?:channelName|channelLinkId|accountId)\}/g, ''))) {
    invalid('Retail order path template contains an invalid placeholder.');
  }
  return template;
}

export function validateRetailOrderHeaders(input?: Record<string, string>): Record<string, string> {
  if (!input) return {};
  if (Array.isArray(input) || typeof input !== 'object') invalid('Retail order headers must be an object.');
  const output: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(input)) {
    const name = rawName.toLowerCase();
    if (!ALLOWED_HEADERS.has(name)) invalid('Retail order header is not allowed.');
    const value = String(rawValue).toLowerCase();
    if (!ALLOWED_VERSIONS.has(value)) invalid('Retail order header value is invalid.');
    output[name] = value;
  }
  return output;
}

function envHeaders(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return invalid('DELIVERECT_RETAIL_ORDER_HEADERS must be valid JSON.'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') invalid('DELIVERECT_RETAIL_ORDER_HEADERS must be a JSON object.');
  return parsed as Record<string, string>;
}

export function resolveRetailOrderEndpoint(args: {
  environment: 'staging' | 'production' | string;
  tenantConfig?: RetailOrderEndpointConfig;
  env: NodeJS.ProcessEnv;
  channelName: string;
  channelLinkId: string;
  accountId?: string;
}): ResolvedRetailOrderEndpoint {
  const tenant = args.tenantConfig || {};
  const envBase = args.env.DELIVERECT_RETAIL_ORDER_BASE_URL;
  // The Deliverect environment itself is authoritative for the standard host.
  // Keep tenant/env overrides for endpoint experiments, but do not make a
  // deployment mechanism (App Hosting vs Cloud Run/AI Studio) responsible for
  // supplying the normal staging host.
  const environmentDefault =
    args.environment === 'production'
      ? 'https://api.deliverect.io'
      : args.environment === 'staging'
        ? 'https://api.staging.deliverect.io'
        : undefined;
  const baseRaw = tenant.baseUrl || envBase || environmentDefault;
  if (!baseRaw) throw new BFFError('INTEGRATION_NOT_CONFIGURED', 'Retail order base URL is not configured for this environment', 503);
  const baseUrl = validateBaseUrl(baseRaw);

  const envTemplate = args.env.DELIVERECT_RETAIL_ORDER_PATH_TEMPLATE;
  const template = validateRetailOrderPathTemplate(tenant.pathTemplate || envTemplate || DEFAULT_TEMPLATE);
  if (template.includes('{accountId}') && !args.accountId) invalid('Retail order path template requires an accountId.');

  const parsedEnvHeaders = envHeaders(args.env.DELIVERECT_RETAIL_ORDER_HEADERS);
  const hasTenantHeaders = tenant.headers !== undefined && Object.keys(tenant.headers).length > 0;
  const selectedHeaders = hasTenantHeaders
    ? tenant.headers
    : parsedEnvHeaders !== undefined
      ? parsedEnvHeaders
      : DEFAULT_HEADERS;
  const headers = validateRetailOrderHeaders(selectedHeaders);

  const values: Record<string, string | undefined> = {
    channelName: args.channelName,
    channelLinkId: args.channelLinkId,
    accountId: args.accountId,
  };
  const path = template.replace(/\{(channelName|channelLinkId|accountId)\}/g, (_all, key: string) =>
    encodeURIComponent(values[key] || '')
  );

  return {
    url: baseUrl + path,
    headers,
    source: {
      baseUrl: tenant.baseUrl ? 'tenant' : envBase ? 'env' : 'default',
      pathTemplate: tenant.pathTemplate ? 'tenant' : envTemplate ? 'env' : 'default',
      headers: hasTenantHeaders ? 'tenant' : parsedEnvHeaders !== undefined ? 'env' : 'default',
    },
  };
}
