/**
 * Unified Runtime Context & Environment Resolver
 *
 * Runtime Modes:
 * - UNKNOWN: Initial state upon cold start. No commerce request may instantiate a mock.
 * - DEMO: Mock adapters permitted for local visualization & testing.
 * - STAGING: Zero mock fallback. Connects to api.staging.deliverect.com.
 * - PRODUCTION: Zero mock fallback. Connects to api.deliverect.com.
 */

export type RuntimeMode = 'UNKNOWN' | 'DEMO' | 'STAGING' | 'PRODUCTION';

export interface RuntimeConfig {
  readonly mode: RuntimeMode;
  readonly isDemo: boolean;
  readonly isStaging: boolean;
  readonly isProduction: boolean;
  readonly allowsMockFallback: boolean;
  readonly resolvedAt: string;
}

let activeRuntimeMode: RuntimeMode = 'UNKNOWN';

export function getRuntimeMode(): RuntimeMode {
  return activeRuntimeMode;
}

export function setRuntimeMode(mode: RuntimeMode): void {
  activeRuntimeMode = mode;
}

export function isMockPermitted(): boolean {
  return activeRuntimeMode === 'DEMO';
}

export function isDemoMode(): boolean {
  return (process.env.APP_MODE || '').toLowerCase() === 'demo' || activeRuntimeMode === 'DEMO';
}

export function assertNoMockAllowed(operation: string): void {
  if (activeRuntimeMode !== 'DEMO') {
    const error: any = new Error(
      `[Runtime Security] Mock operation "${operation}" is strictly forbidden in runtime mode "${activeRuntimeMode}". Live Deliverect staging/production integration is required.`
    );
    error.status = 503;
    error.code = 'MOCK_FORBIDDEN_IN_NON_DEMO';
    throw error;
  }
}

export function parseRuntimeMode(input?: string): RuntimeMode {
  const normalized = (input || '').trim().toUpperCase();
  if (normalized === 'DEMO') return 'DEMO';
  if (normalized === 'STAGING') return 'STAGING';
  if (normalized === 'PRODUCTION') return 'PRODUCTION';
  return 'UNKNOWN';
}

export function resolveServerRuntimeMode(): RuntimeMode {
  const envMode = process.env.APP_MODE;
  if (envMode) {
    return parseRuntimeMode(envMode);
  }
  // Default on server when APP_MODE is not explicitly set is UNKNOWN or DEMO in dev
  if (process.env.NODE_ENV === 'production') {
    return 'PRODUCTION';
  }
  return 'DEMO';
}
