/**
 * Server-Side Authoritative Runtime Mode Resolver
 *
 * Section 5: RUNTIME MODES
 * There are exactly three runtime modes:
 * - DEMO: Mocks allowed, deterministic demo data allowed, fake transactions allowed if clearly demo-labelled.
 * - STAGING: NO mock Commerce fallback, NO mock stores, NO fake stock, NO fake prices, NO fake ETAs, NO fake delivery fees, NO fake orders, NO fake payment authorisation, NO pretend integration success.
 * - PRODUCTION: Same rules as staging; everything must be genuine/authoritative.
 *
 * Startup mode initially equals UNKNOWN if not explicitly configured.
 * Staging/production must NEVER fail open to demo mode.
 */

export type ServerRuntimeMode = 'demo' | 'staging' | 'production' | 'unknown';

let overrideRuntimeMode: ServerRuntimeMode | null = null;

export function setServerRuntimeMode(mode: ServerRuntimeMode | null): void {
  overrideRuntimeMode = mode;
  if (mode) {
    process.env.APP_MODE = mode;
  } else {
    delete process.env.APP_MODE;
  }
}

export function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
}

export function getServerRuntimeMode(): ServerRuntimeMode {
  if (overrideRuntimeMode) {
    return overrideRuntimeMode;
  }
  const envMode = (process.env.APP_MODE || '').trim().toLowerCase();
  if (envMode === 'staging') return 'staging';
  if (envMode === 'production') return 'production';
  if (envMode === 'demo') return 'demo';

  // Support DELIVERECT_ENV as fallback if APP_MODE not explicitly defined AND live credentials exist
  const hasLiveDeliverectCredentials = Boolean(
    process.env.DELIVERECT_CLIENT_ID && process.env.DELIVERECT_CLIENT_SECRET
  );

  if (hasLiveDeliverectCredentials) {
    const deliverectEnv = (process.env.DELIVERECT_ENV || '').trim().toLowerCase();
    if (deliverectEnv === 'staging') return 'staging';
    if (deliverectEnv === 'production') return 'production';
  }

  // Missing or invalid runtime configuration MUST fail closed to 'unknown'
  // Demo mode is strictly opt-in through explicit APP_MODE=demo.
  return 'unknown';
}

export function isDemoMode(): boolean {
  return getServerRuntimeMode() === 'demo';
}

export function isStagingMode(): boolean {
  return getServerRuntimeMode() === 'staging';
}

export function isProductionMode(): boolean {
  return getServerRuntimeMode() === 'production';
}

export function isLiveMode(): boolean {
  const mode = getServerRuntimeMode();
  return mode === 'staging' || mode === 'production';
}

export function assertNoMockPermitted(operation: string): void {
  const mode = getServerRuntimeMode();
  if (mode !== 'demo') {
    const error: any = new Error(
      `[Runtime Security] Mock operation "${operation}" is strictly forbidden in runtime mode "${mode}". Real upstream integration is required.`
    );
    error.statusCode = 503;
    error.code = 'INTEGRATION_NOT_CONFIGURED';
    throw error;
  }
}

export function assertRuntimeConfigured(): void {
  const mode = getServerRuntimeMode();
  if (mode === 'unknown') {
    const error: any = new Error(
      'APP_MODE environment variable is required (must be "demo", "staging", or "production"). Missing runtime configuration fails closed to prevent mock leakage.'
    );
    error.statusCode = 503;
    error.code = 'RUNTIME_MODE_UNCONFIGURED';
    throw error;
  }
}
