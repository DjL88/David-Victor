import { initializeApp as initAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth, Auth as AdminAuth } from 'firebase-admin/auth';
import { getStorage as getAdminStorage, Storage as AdminStorage } from 'firebase-admin/storage';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initWebApp, getApps as getWebApps, FirebaseApp as WebApp } from 'firebase/app';
import { getFirestore as getWebFirestore, Firestore as WebFirestore } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';
import { getServerRuntimeMode, isDemoMode } from './runtimeMode';
import { SecretManager } from './secrets';

let adminAppInstance: AdminApp | null = null;
let authInstance: AdminAuth | null = null;
let storageInstance: AdminStorage | null = null;
let firestoreInstance: AdminFirestore | null = null;
let webAppInstance: WebApp | null = null;
let webFirestoreInstance: WebFirestore | null = null;

export interface FirebaseAppletConfig {
  projectId: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  oAuthClientId?: string;
}

export type ServerFirestore = AdminFirestore;

export function getFirebaseConfig(): FirebaseAppletConfig | null {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Firebase] Could not read firebase-applet-config.json:', err);
  }
  return null;
}

export function getFirebaseAdminApp(): AdminApp | null {
  if (adminAppInstance) return adminAppInstance;
  const config = getFirebaseConfig();
  const projectId = config?.projectId || process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) return null;

  const existing = getAdminApps();
  if (existing.length > 0) {
    adminAppInstance = existing[0];
    return adminAppInstance;
  }

  try {
    adminAppInstance = initAdminApp({
      projectId,
      storageBucket: config?.storageBucket || process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
    });
    return adminAppInstance;
  } catch (err) {
    console.warn('[Firebase Admin] AdminApp init skipped:', err);
    return null;
  }
}

export function getFirestoreDb(): AdminFirestore | null {
  if ((process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') && !process.env.TEST_LIVE_FIRESTORE) {
    return null;
  }
  if (isFirestorePermissionDenied()) {
    return null;
  }
  if (firestoreInstance) return firestoreInstance;

  const app = getFirebaseAdminApp();
  if (!app) return null;

  const config = getFirebaseConfig();
  const dbId = config?.firestoreDatabaseId || process.env.FIRESTORE_DATABASE_ID;

  try {
    if (dbId && dbId !== '(default)') {
      firestoreInstance = getAdminFirestore(app, dbId);
    } else {
      firestoreInstance = getAdminFirestore(app);
    }
    try {
      firestoreInstance.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings may only be configured before operations
    }
    return firestoreInstance;
  } catch (err) {
    console.warn('[Firebase Admin] Firestore initialization error:', err);
    return null;
  }
}

let firestorePermissionDeniedDetected = false;
let firestorePermissionDeniedAt: number | null = null;
let lastFirestorePermissionError: string | null = null;
let firestorePermissionDiagnosticsLogged = false;

const FIRESTORE_PERMISSION_RETRY_MS = (() => {
  const configured = Number(process.env.FIRESTORE_PERMISSION_RETRY_MS || 60_000);
  return Number.isFinite(configured) && configured >= 5_000 ? configured : 60_000;
})();

function safeFirestoreErrorDetails(err: any): Record<string, unknown> {
  return {
    code: err?.code ?? null,
    status: err?.status ?? null,
    message: err?.message ?? String(err || ''),
    details: err?.details ?? null,
  };
}

async function getCloudRunRuntimeIdentity(): Promise<string | null> {
  // Cloud Run exposes the service identity through the metadata server. Only
  // attempt this in Cloud Run so local/test environments never make a metadata
  // network call.
  if (!process.env.K_SERVICE && !process.env.K_REVISION) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
        {
          headers: { 'Metadata-Flavor': 'Google' },
          signal: controller.signal,
        }
      );
      if (!response.ok) return null;
      return (await response.text()).trim() || null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function logFirestorePermissionDiagnostics(err?: any): Promise<void> {
  if (firestorePermissionDiagnosticsLogged) return;
  firestorePermissionDiagnosticsLogged = true;

  const config = getFirebaseConfig();
  const projectId =
    config?.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    null;
  const databaseId =
    config?.firestoreDatabaseId ||
    process.env.FIRESTORE_DATABASE_ID ||
    '(default)';
  const runtimeIdentity = await getCloudRunRuntimeIdentity();

  console.error(
    '[Firestore IAM Diagnostics]',
    JSON.stringify({
      projectId,
      databaseId,
      runtimeIdentity,
      cloudRunService: process.env.K_SERVICE || null,
      cloudRunRevision: process.env.K_REVISION || null,
      error: safeFirestoreErrorDetails(err),
    })
  );
}

function refreshFirestorePermissionState(now: number = Date.now()): void {
  if (
    firestorePermissionDeniedDetected &&
    firestorePermissionDeniedAt &&
    now - firestorePermissionDeniedAt >= FIRESTORE_PERMISSION_RETRY_MS
  ) {
    firestorePermissionDeniedDetected = false;
    firestorePermissionDeniedAt = null;
    firestorePermissionDiagnosticsLogged = false;
    console.info('[Firestore IAM] Permission-denied cooldown expired; Firestore access will be retried.');
  }
}

export function isFirestorePermissionDenied(): boolean {
  refreshFirestorePermissionState();
  return firestorePermissionDeniedDetected;
}

export function getFirestorePermissionStatus(): {
  denied: boolean;
  lastError: string | null;
  deniedAt: string | null;
  retryAfterMs: number;
  retryInMs: number;
} {
  refreshFirestorePermissionState();
  const now = Date.now();
  const retryInMs =
    firestorePermissionDeniedDetected && firestorePermissionDeniedAt
      ? Math.max(0, FIRESTORE_PERMISSION_RETRY_MS - (now - firestorePermissionDeniedAt))
      : 0;

  return {
    denied: firestorePermissionDeniedDetected,
    lastError: lastFirestorePermissionError,
    deniedAt: firestorePermissionDeniedAt ? new Date(firestorePermissionDeniedAt).toISOString() : null,
    retryAfterMs: FIRESTORE_PERMISSION_RETRY_MS,
    retryInMs,
  };
}

export function isFirestorePermissionDeniedError(err: any): boolean {
  if (!err) return false;
  return (
    err.code === 7 ||
    err.code === 'PERMISSION_DENIED' ||
    err.code === 'permission-denied' ||
    err.status === 'PERMISSION_DENIED' ||
    (typeof err.message === 'string' && (
      err.message.includes('PERMISSION_DENIED') ||
      err.message.includes('Missing or insufficient permissions') ||
      err.message.includes('permission-denied')
    ))
  );
}

export function getFirestorePermissionErrorMessage(): string | null {
  return lastFirestorePermissionError;
}

export function markFirestorePermissionDenied(err?: any): void {
  const firstDetection = !firestorePermissionDeniedDetected;
  firestorePermissionDeniedDetected = true;
  firestorePermissionDeniedAt = Date.now();
  lastFirestorePermissionError =
    err?.message ||
    'Firestore returned PERMISSION_DENIED. Inspect [Firestore IAM Diagnostics] for the actual runtime identity and Google error.';

  if (firstDetection) {
    console.warn(
      `[Firestore IAM] Firestore returned PERMISSION_DENIED. Access is paused for ${Math.round(FIRESTORE_PERMISSION_RETRY_MS / 1000)}s before an automatic retry; see [Firestore IAM Diagnostics] for the actual Google error and runtime identity.`
    );
    void logFirestorePermissionDiagnostics(err);
  }
}

export function getWebFirestoreDb(): WebFirestore | null {
  if (webFirestoreInstance) return webFirestoreInstance;
  const config = getFirebaseConfig();
  if (!config || !config.apiKey) return null;

  try {
    const existing = getWebApps();
    webAppInstance = existing.length > 0 ? existing[0] : initWebApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
    });
    const dbId = config.firestoreDatabaseId;
    webFirestoreInstance = dbId && dbId !== '(default)' ? getWebFirestore(webAppInstance, dbId) : getWebFirestore(webAppInstance);
    return webFirestoreInstance;
  } catch (err) {
    console.warn('[Firebase Web] Firestore initialization warning:', err);
    return null;
  }
}

let isMockAuthForTest = false;
type AdminMembershipResolverForTest = (docId: string) => Promise<Record<string, any> | null> | Record<string, any> | null;
let adminMembershipResolverForTest: AdminMembershipResolverForTest | null = null;

export function setMockAdminMembershipResolverForTest(resolver: AdminMembershipResolverForTest | null): void {
  adminMembershipResolverForTest = resolver;
}

export function setMockAdminAuthForTest(mock: AdminAuth | null): void {
  authInstance = mock;
  isMockAuthForTest = Boolean(mock);
  if (!mock) adminMembershipResolverForTest = null;
}

const TENANT_ADMIN_ROLES = new Set<AuthenticatedAdmin['role']>([
  'tenantAdmin',
  'marketingEditor',
  'operationsEditor',
  'viewer',
]);

function normalizeAdminRole(rawRole: unknown): AuthenticatedAdmin['role'] | null {
  const role = String(rawRole || '').trim();
  if (role === 'PLATFORM_SUPER_ADMIN') return 'platformSuperAdmin';
  if (role === 'TENANT_ADMIN') return 'tenantAdmin';
  if (
    role === 'platformSuperAdmin' ||
    role === 'tenantAdmin' ||
    role === 'marketingEditor' ||
    role === 'operationsEditor' ||
    role === 'viewer'
  ) {
    return role;
  }
  return null;
}

function isActiveMembership(data: Record<string, any> | null | undefined): boolean {
  return String(data?.status || '').toLowerCase() === 'active';
}

async function readAdminMembership(
  docId: string,
  db: AdminFirestore | null
): Promise<Record<string, any> | null> {
  if (adminMembershipResolverForTest) {
    return (await adminMembershipResolverForTest(docId)) || null;
  }
  if (!db) return null;
  const doc = await db.collection('tenantMemberships').doc(docId).get();
  return doc.exists ? (doc.data() as Record<string, any>) : null;
}

function membershipClaimsMatch(
  decoded: Record<string, any>,
  role: AuthenticatedAdmin['role'],
  tenantId: string,
  isPlatform: boolean
): boolean {
  const hasCachedClaims =
    decoded.platformSuperAdmin === true ||
    typeof decoded.role === 'string' ||
    typeof decoded.tenantId === 'string';

  // Claims are only a cache. A membership can be authoritative before its
  // first cache write, but any existing cached claim must agree exactly.
  if (!hasCachedClaims) return true;

  const claimedRole = normalizeAdminRole(decoded.role);
  if (isPlatform) {
    return claimedRole === 'platformSuperAdmin' && decoded.platformSuperAdmin === true;
  }
  return (
    decoded.platformSuperAdmin !== true &&
    claimedRole === role &&
    String(decoded.tenantId || '') === tenantId
  );
}

function claimsForMembership(
  role: AuthenticatedAdmin['role'],
  tenantId: string,
  isPlatform: boolean
): Record<string, unknown> {
  return isPlatform
    ? { role: 'platformSuperAdmin', platformSuperAdmin: true }
    : { role, tenantId };
}

export function getFirebaseAdminAuth(): AdminAuth | null {
  if (authInstance) return authInstance;
  const app = getFirebaseAdminApp();
  if (!app) return null;

  try {
    authInstance = getAdminAuth(app);
    return authInstance;
  } catch (err) {
    console.warn('[Firebase Admin] Auth initialization warning:', err);
    return null;
  }
}

export const getFirebaseAuth = getFirebaseAdminAuth;

export function getFirebaseStorage(): AdminStorage | null {
  if (storageInstance) return storageInstance;
  const app = getFirebaseAdminApp();
  if (!app) return null;

  try {
    storageInstance = getAdminStorage(app);
    return storageInstance;
  } catch (err) {
    console.warn('[Firebase Admin] Storage initialization warning:', err);
    return null;
  }
}

/**
 * Verified Admin User Identity
 */
export interface AuthenticatedAdmin {
  uid: string;
  email: string;
  role: 'platformSuperAdmin' | 'tenantAdmin' | 'marketingEditor' | 'operationsEditor' | 'viewer';
  tenantId: string;
  name: string;
  isSuperAdmin: boolean;
}

export interface AdminAuthResult {
  authenticated: boolean;
  authorized: boolean;
  user: AuthenticatedAdmin | null;
  code?: string;
  message?: string;
  email?: string;
}

/**
 * Hardened Admin Session Verification with Status & Code Reporting
 * Verifies real Firebase Auth ID tokens cryptographically via Firebase Admin SDK.
 * Staging and Production strictly reject dev_token_* identities.
 * Supports PLATFORM_SUPERADMIN_EMAILS allowlist for first-admin bootstrap.
 */
export async function verifyAdminSessionWithStatus(
  authHeader?: string,
  tenantHeader?: string
): Promise<AdminAuthResult> {
  const hasAuth = Boolean(authHeader && authHeader.trim().length > 0);
  console.log('[Auth] AUTH_HEADER_PRESENT:', hasAuth);

  if (!hasAuth) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      code: 'AUTH_REQUIRED',
      message: 'No authorization header provided.',
    };
  }

  const token = authHeader!.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      code: 'EMPTY_TOKEN',
      message: 'Authorization token is empty.',
    };
  }

  const appMode = getServerRuntimeMode();
  const demoActive = isDemoMode();

  // Demo tokens remain isolated to explicit demo mode.
  if (token.startsWith('dev_token_')) {
    if (!demoActive) {
      console.warn('[RBAC Security] Dev token rejected in non-demo mode:', appMode);
      return {
        authenticated: false,
        authorized: false,
        user: null,
        code: 'DEV_TOKEN_NOT_ALLOWED',
        message: 'Dev tokens are strictly forbidden in staging and production.',
      };
    }

    const lowerToken = token.toLowerCase();
    const rolePart: AuthenticatedAdmin['role'] =
      lowerToken.includes('superadmin') || token.includes('platformSuperAdmin')
        ? 'platformSuperAdmin'
        : lowerToken.includes('marketing')
        ? 'marketingEditor'
        : lowerToken.includes('operations')
        ? 'operationsEditor'
        : lowerToken.includes('viewer')
        ? 'viewer'
        : 'tenantAdmin';

    const user: AuthenticatedAdmin = {
      uid: `usr_${token}`,
      email: lowerToken.includes('superadmin') ? 'superadmin@example.com' : 'admin@retailer.com',
      role: rolePart,
      tenantId: tenantHeader || 'brand-alpha',
      name: rolePart === 'platformSuperAdmin' ? 'Platform SuperAdmin' : 'Brand Administrator',
      isSuperAdmin: rolePart === 'platformSuperAdmin',
    };

    console.log('[Auth] AUTH_SOURCE: demo_token');
    console.log('[Auth] ADMIN_ROLE_RESOLVED:', rolePart);
    return { authenticated: true, authorized: true, user, code: 'AUTHORIZED' };
  }

  const isJwtStructure =
    typeof token === 'string' &&
    token.split('.').length === 3 &&
    token.split('.').every((part) => part.trim().length > 0);

  if (!isJwtStructure && !isMockAuthForTest) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      code: 'INVALID_JWT_FORMAT',
      message: 'Token rejected: not a valid 3-part JWT format.',
    };
  }

  const auth = getFirebaseAdminAuth();
  if (!auth) {
    return {
      authenticated: false,
      authorized: false,
      user: null,
      code: 'AUTH_UNAVAILABLE',
      message: 'Firebase Admin Auth service is unavailable.',
    };
  }

  try {
    // checkRevoked=true is mandatory for admin traffic. Membership revocation
    // therefore takes effect on the next request after refresh tokens are revoked.
    const decoded = await auth.verifyIdToken(token, true);
    const email = String(decoded.email || '').toLowerCase().trim();
    const emailVerified = decoded.email_verified === true;
    const uid = decoded.uid;
    const name = decoded.name || (email ? email.split('@')[0] : 'Admin User');
    const targetTenantId = tenantHeader || 'brand-alpha';

    // Bootstrap is a request-only break-glass path. The secret is resolved via
    // the server-side SecretManager abstraction and never persists claims or
    // tenantMemberships.
    let bootstrapAllowlist = '';
    try {
      bootstrapAllowlist = (await SecretManager.getSecret('PLATFORM_SUPERADMIN_EMAILS')) || '';
    } catch {
      bootstrapAllowlist = '';
    }
    const bootstrapEmails = bootstrapAllowlist
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (email && emailVerified && bootstrapEmails.includes(email)) {
      console.log('[Auth] APP_MODE:', appMode);
      console.log('[Auth] AUTH_SOURCE: bootstrap_secret');
      console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
      console.log('[Auth] ADMIN_ROLE_RESOLVED: platformSuperAdmin');
      return {
        authenticated: true,
        authorized: true,
        user: {
          uid,
          email,
          role: 'platformSuperAdmin',
          tenantId: targetTenantId,
          name,
          isSuperAdmin: true,
        },
        code: 'AUTHORIZED',
      };
    }

    const db = isFirestorePermissionDenied() ? null : getFirestoreDb();

    // Legacy unit tests that install only a Firebase Auth mock are intentionally
    // isolated from this production membership path. New SEC-02a behavioural
    // tests install an explicit membership resolver and exercise the fail-closed
    // source-of-truth logic below.
    if (isMockAuthForTest && !db && !adminMembershipResolverForTest) {
      const claimedRole = normalizeAdminRole(decoded.role);
      if (claimedRole === 'platformSuperAdmin' && decoded.platformSuperAdmin === true) {
        return {
          authenticated: true,
          authorized: true,
          user: { uid, email, role: claimedRole, tenantId: targetTenantId, name, isSuperAdmin: true },
          code: 'AUTHORIZED',
        };
      }
      if (claimedRole && claimedRole !== 'platformSuperAdmin' && String(decoded.tenantId || '') === targetTenantId) {
        return {
          authenticated: true,
          authorized: true,
          user: { uid, email, role: claimedRole, tenantId: targetTenantId, name, isSuperAdmin: false },
          code: 'AUTHORIZED',
        };
      }
    }

    const authorizeMembership = async (
      membership: Record<string, any>,
      role: AuthenticatedAdmin['role'],
      membershipTenantId: string,
      isPlatform: boolean,
      fromEmailInvite: boolean
    ): Promise<AdminAuthResult> => {
      if (!membershipClaimsMatch(decoded as any, role, membershipTenantId, isPlatform)) {
        return {
          authenticated: true,
          authorized: false,
          user: null,
          code: 'STALE_ADMIN_CLAIM',
          message: 'Administrative claims no longer match the active membership. Sign in again.',
        };
      }

      // Only a verified email may cause claims to be assigned/refreshed.
      const hasClaims =
        decoded.platformSuperAdmin === true ||
        typeof decoded.role === 'string' ||
        typeof decoded.tenantId === 'string';
      if (!hasClaims && emailVerified) {
        await auth.setCustomUserClaims(uid, claimsForMembership(role, membershipTenantId, isPlatform));
      }

      if (fromEmailInvite && db) {
        const uidDocId = isPlatform ? `${uid}_platform` : `${uid}_${membershipTenantId}`;
        await db.collection('tenantMemberships').doc(uidDocId).set(
          {
            ...membership,
            uid,
            email,
            tenantId: isPlatform ? 'platform' : membershipTenantId,
            role,
            status: 'active',
            linkedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      console.log('[Auth] APP_MODE:', appMode);
      console.log('[Auth] AUTH_SOURCE: firebase_membership');
      console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
      console.log('[Auth] ADMIN_ROLE_RESOLVED:', role);

      return {
        authenticated: true,
        authorized: true,
        user: {
          uid,
          email,
          role,
          tenantId: isPlatform ? targetTenantId : membershipTenantId,
          name: membership.name || name,
          isSuperAdmin: isPlatform,
        },
        code: 'AUTHORIZED',
      };
    };

    try {
      // UID-keyed documents are the source of truth.
      const platformMembership = await readAdminMembership(`${uid}_platform`, db);
      if (platformMembership) {
        if (!isActiveMembership(platformMembership)) {
          // A revoked platform membership does not suppress a separate tenant
          // membership, but it can never authorize platform access.
        } else {
          const role = normalizeAdminRole(platformMembership.role);
          const membershipTenant = String(platformMembership.tenantId || 'platform');
          if (role !== 'platformSuperAdmin' || membershipTenant !== 'platform') {
            return {
              authenticated: true,
              authorized: false,
              user: null,
              code: 'INVALID_MEMBERSHIP_ROLE',
              message: 'Platform membership is invalid.',
            };
          }
          return authorizeMembership(platformMembership, role, 'platform', true, false);
        }
      }

      const tenantDocId = `${uid}_${targetTenantId}`;
      const tenantMembership = await readAdminMembership(tenantDocId, db);
      if (tenantMembership) {
        if (!isActiveMembership(tenantMembership)) {
          return {
            authenticated: true,
            authorized: false,
            user: null,
            code: 'MEMBERSHIP_INACTIVE',
            message: 'Administrative membership is not active.',
          };
        }
        const role = normalizeAdminRole(tenantMembership.role);
        const membershipTenant = String(tenantMembership.tenantId || '');
        if (!role || role === 'platformSuperAdmin' || !TENANT_ADMIN_ROLES.has(role) || membershipTenant !== targetTenantId) {
          return {
            authenticated: true,
            authorized: false,
            user: null,
            code: 'INVALID_MEMBERSHIP_ROLE',
            message: 'Tenant-scoped membership contains an invalid role or tenant.',
          };
        }
        return authorizeMembership(tenantMembership, role, targetTenantId, false, false);
      }

      // Email-keyed membership is migration/invite-only. It is never consulted
      // unless Firebase has cryptographically verified ownership of the email.
      if (email && emailVerified) {
        const platformInvite = await readAdminMembership(`${email}_platform`, db);
        if (platformInvite) {
          if (!isActiveMembership(platformInvite)) {
            return {
              authenticated: true,
              authorized: false,
              user: null,
              code: 'MEMBERSHIP_INACTIVE',
              message: 'Administrative membership is not active.',
            };
          }
          const role = normalizeAdminRole(platformInvite.role);
          if (role !== 'platformSuperAdmin' || String(platformInvite.tenantId || 'platform') !== 'platform') {
            return {
              authenticated: true,
              authorized: false,
              user: null,
              code: 'INVALID_MEMBERSHIP_ROLE',
              message: 'Platform membership is invalid.',
            };
          }
          return authorizeMembership(platformInvite, role, 'platform', true, true);
        }

        const tenantInvite = await readAdminMembership(`${email}_${targetTenantId}`, db);
        if (tenantInvite) {
          if (!isActiveMembership(tenantInvite)) {
            return {
              authenticated: true,
              authorized: false,
              user: null,
              code: 'MEMBERSHIP_INACTIVE',
              message: 'Administrative membership is not active.',
            };
          }
          const role = normalizeAdminRole(tenantInvite.role);
          if (
            !role ||
            role === 'platformSuperAdmin' ||
            !TENANT_ADMIN_ROLES.has(role) ||
            String(tenantInvite.tenantId || '') !== targetTenantId
          ) {
            return {
              authenticated: true,
              authorized: false,
              user: null,
              code: 'INVALID_MEMBERSHIP_ROLE',
              message: 'Tenant-scoped membership contains an invalid role or tenant.',
            };
          }
          return authorizeMembership(tenantInvite, role, targetTenantId, false, true);
        }
      }
    } catch (dbErr: any) {
      if (isFirestorePermissionDeniedError(dbErr)) {
        markFirestorePermissionDenied(dbErr);
        console.info('[RBAC] Firestore IAM permission unavailable; admin membership resolution failed closed.');
      } else {
        console.warn('[RBAC] Admin membership resolution failed closed:', dbErr?.code || dbErr?.name || 'UNKNOWN');
      }
    }

    console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
    console.log('[Auth] ADMIN_ROLE_RESOLVED: none');
    console.log('[Auth] AUTH_SOURCE: firebase');
    return {
      authenticated: true,
      authorized: false,
      user: null,
      code: email && !emailVerified ? 'EMAIL_NOT_VERIFIED' : 'AUTHENTICATED_NOT_AUTHORIZED',
      message: email && !emailVerified
        ? 'A verified email address is required for administrator access.'
        : 'Authenticated account has no active administrative membership.',
    };
  } catch (err: any) {
    const revoked = err?.code === 'auth/id-token-revoked';
    console.log('[Auth] ID token verification rejected:', revoked ? 'TOKEN_REVOKED' : (err?.code || 'INVALID_TOKEN'));
    return {
      authenticated: false,
      authorized: false,
      user: null,
      code: revoked ? 'FIREBASE_TOKEN_REVOKED' : 'FIREBASE_TOKEN_INVALID',
      message: revoked ? 'Administrator session has been revoked.' : 'Invalid or expired Firebase ID token.',
    };
  }
}

/**
 * Hardened Admin Session Verification (backwards-compatible wrapper)
 * Returns AuthenticatedAdmin if valid and authorized, or null otherwise.
 */
export async function verifyAdminSession(
  authHeader?: string,
  tenantHeader?: string
): Promise<AuthenticatedAdmin | null> {
  const result = await verifyAdminSessionWithStatus(authHeader, tenantHeader);
  return result.user;
}
