import { OAuth2Client } from 'google-auth-library';
import { isDemoMode, isTestMode, getServerRuntimeMode } from './runtimeMode';

const oAuth2Client = new OAuth2Client();

export interface CloudTasksSecurityConfig {
  serviceAccountEmail: string;
  audience: string;
  appUrl: string;
}

export interface CloudTasksCapabilityHealth {
  mode: 'in-memory' | 'cloud-tasks';
  configured: boolean;
  projectConfigured: boolean;
  identityConfigured: boolean;
  audienceConfigured: boolean;
  appUrlConfigured: boolean;
  queues: {
    bulk: boolean;
    realtime: boolean;
  };
  missing: string[];
}

type TokenPayload = {
  iss?: string;
  aud?: string | string[];
  email?: string;
  email_verified?: boolean;
  sub?: string;
};

let tokenVerifierForTest:
  | ((token: string, audience: string) => Promise<TokenPayload>)
  | null = null;

export function setCloudTasksTokenVerifierForTest(
  verifier: ((token: string, audience: string) => Promise<TokenPayload>) | null
): void {
  tokenVerifierForTest = verifier;
}

function isLiveMode(): boolean {
  const mode = getServerRuntimeMode();
  if (mode === 'staging' || mode === 'production') return true;
  if (mode === 'demo' || isDemoMode()) return false;
  const envMode = String(process.env.APP_MODE || '').trim().toLowerCase();
  if (envMode === 'staging' || envMode === 'production') return true;
  return !isTestMode() && process.env.NODE_ENV !== 'test' && envMode !== 'demo';
}

function required(name: string, value: string): string {
  if (!value) throw new Error(`${name} is required for authenticated Cloud Tasks workers in live modes.`);
  return value;
}

/**
 * Single source of truth for Cloud Tasks worker identity and routing.
 * The OIDC audience is the canonical worker origin and therefore also the task
 * target origin. This deliberately avoids a second APP_URL secret that can
 * drift away from the audience while retaining exact audience verification.
 */
export function getCloudTasksSecurityConfig(): CloudTasksSecurityConfig {
  const serviceAccountEmail = String(process.env.CLOUD_TASKS_SA_EMAIL || '').trim();
  const audience = String(process.env.CLOUD_TASKS_AUDIENCE || '').trim().replace(/\/$/, '');
  const appUrl = String(process.env.APP_URL || audience).trim().replace(/\/$/, '');

  if (isLiveMode()) {
    const liveAudience = required('CLOUD_TASKS_AUDIENCE', audience);
    return {
      serviceAccountEmail: required('CLOUD_TASKS_SA_EMAIL', serviceAccountEmail),
      audience: liveAudience,
      appUrl: appUrl || liveAudience,
    };
  }

  return {
    serviceAccountEmail: serviceAccountEmail || 'demo-worker@project.iam.gserviceaccount.com',
    audience: audience || 'http://localhost:3000',
    appUrl: appUrl || audience || 'http://localhost:3000',
  };
}

export function assertCloudTasksSecurityConfigured(): void { void getCloudTasksSecurityConfig(); }

export function getCloudTasksCapabilityHealth(): CloudTasksCapabilityHealth {
  const live = isLiveMode();
  const projectConfigured = Boolean(
    String(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || '').trim()
  );
  const identityConfigured = Boolean(String(process.env.CLOUD_TASKS_SA_EMAIL || '').trim());
  const audienceConfigured = Boolean(String(process.env.CLOUD_TASKS_AUDIENCE || '').trim());
  const appUrlConfigured = Boolean(
    String(process.env.APP_URL || process.env.CLOUD_TASKS_AUDIENCE || '').trim()
  );
  const bulkQueueConfigured = Boolean(
    String(
      process.env.CHANNEL_MENU_TASKS_QUEUE ||
      process.env.CLOUD_TASKS_BULK_QUEUE ||
      process.env.CLOUD_TASKS_QUEUE ||
      ''
    ).trim()
  );
  const realtimeQueueConfigured = Boolean(
    String(
      process.env.CHANNEL_REALTIME_TASKS_QUEUE ||
      process.env.CLOUD_TASKS_REALTIME_QUEUE ||
      process.env.CLOUD_TASKS_QUEUE ||
      ''
    ).trim()
  );

  if (!live) {
    return {
      mode: 'in-memory',
      configured: true,
      projectConfigured,
      identityConfigured,
      audienceConfigured,
      appUrlConfigured,
      queues: {
        bulk: bulkQueueConfigured,
        realtime: realtimeQueueConfigured,
      },
      missing: [],
    };
  }

  const missing: string[] = [];
  if (!projectConfigured) missing.push('GOOGLE_CLOUD_PROJECT');
  if (!identityConfigured) missing.push('CLOUD_TASKS_SA_EMAIL');
  if (!audienceConfigured) missing.push('CLOUD_TASKS_AUDIENCE');
  if (!appUrlConfigured) missing.push('APP_URL_OR_CLOUD_TASKS_AUDIENCE');
  if (!bulkQueueConfigured) missing.push('CHANNEL_MENU_TASKS_QUEUE');
  if (!realtimeQueueConfigured) missing.push('CHANNEL_REALTIME_TASKS_QUEUE');

  return {
    mode: 'cloud-tasks',
    configured: missing.length === 0,
    projectConfigured,
    identityConfigured,
    audienceConfigured,
    appUrlConfigured,
    queues: {
      bulk: bulkQueueConfigured,
      realtime: realtimeQueueConfigured,
    },
    missing,
  };
}

function audienceMatches(actual: string | string[] | undefined, expected: string): boolean {
  if (typeof actual === 'string') return actual === expected;
  return Array.isArray(actual) && actual.includes(expected);
}

export async function verifyCloudTasksOidcToken(req: any): Promise<{ email: string; sub: string }> {
  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    const err: any = new Error('Unauthorized task worker request. Missing Bearer authorization header.');
    err.statusCode = 401; err.code = 'OIDC_AUTH_REQUIRED'; throw err;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) { const err: any = new Error('Unauthorized task worker request. Empty bearer token.'); err.statusCode=401; err.code='OIDC_AUTH_REQUIRED'; throw err; }
  if (isDemoMode() && token === 'demo-token') return { email:'demo-worker@project.iam.gserviceaccount.com', sub:'demo-worker' };
  const config = getCloudTasksSecurityConfig();
  try {
    let payload: TokenPayload | undefined;
    if (tokenVerifierForTest) payload = await tokenVerifierForTest(token, config.audience);
    else {
      const ticket = await oAuth2Client.verifyIdToken({ idToken: token, audience: config.audience });
      payload = ticket.getPayload() as TokenPayload | undefined;
    }
    if (!payload) { const err:any=new Error('Empty OIDC token payload.'); err.statusCode=401; err.code='OIDC_TOKEN_INVALID'; throw err; }
    return validatePayload(payload, config);
  } catch (err:any) {
    if (err.statusCode) throw err;
    const authErr:any=new Error(`Cloud Tasks OIDC token cryptographic verification failed: ${err.message}`); authErr.statusCode=401; authErr.code='OIDC_TOKEN_INVALID'; throw authErr;
  }
}

function validatePayload(payload: TokenPayload, config: CloudTasksSecurityConfig): { email: string; sub: string } {
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') { const err:any=new Error('Cloud Tasks OIDC token issuer is invalid.'); err.statusCode=401; err.code='OIDC_ISSUER_INVALID'; throw err; }
  if (!audienceMatches(payload.aud, config.audience)) { const err:any=new Error('Cloud Tasks OIDC audience does not match.'); err.statusCode=401; err.code='OIDC_AUDIENCE_MISMATCH'; throw err; }
  if (payload.email !== config.serviceAccountEmail) { const err:any=new Error('Cloud Tasks OIDC service account does not match.'); err.statusCode=401; err.code='OIDC_SERVICE_ACCOUNT_MISMATCH'; throw err; }
  if (payload.email_verified !== true) { const err:any=new Error('Cloud Tasks OIDC service-account email is not verified.'); err.statusCode=401; err.code='OIDC_EMAIL_NOT_VERIFIED'; throw err; }
  return { email: payload.email, sub: String(payload.sub || '') };
}
