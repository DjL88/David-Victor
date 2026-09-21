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
  if (firestorePermissionDeniedDetected) {
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
let lastFirestorePermissionError: string | null = null;
let firestorePermissionDiagnosticsLogged = false;

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

export function isFirestorePermissionDenied(): boolean {
  return firestorePermissionDeniedDetected;
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
  if (!firestorePermissionDeniedDetected) {
    firestorePermissionDeniedDetected = true;
    lastFirestorePermissionError =
      err?.message ||
      'Firestore returned PERMISSION_DENIED. Inspect [Firestore IAM Diagnostics] for the actual runtime identity and Google error.';
    console.warn(
      '[Firestore IAM] Firestore returned PERMISSION_DENIED. Persistence is disabled for this container instance; see [Firestore IAM Diagnostics] for the actual Google error and runtime identity.'
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
export function setMockAdminAuthForTest(mock: AdminAuth | null): void {
  authInstance = mock;
  isMockAuthForTest = Boolean(mock);
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

  // 1. Dev / Mock tokens: ONLY permitted in explicit demo mode
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
    const rolePart = lowerToken.includes('superadmin') || token.includes('platformSuperAdmin')
      ? 'platformSuperAdmin'
      : lowerToken.includes('marketing')
      ? 'marketingEditor'
      : lowerToken.includes('operations')
      ? 'operationsEditor'
      : lowerToken.includes('viewer')
      ? 'viewer'
      : 'tenantAdmin';

    console.log('[Auth] AUTH_SOURCE: demo_token');
    console.log('[Auth] ADMIN_ROLE_RESOLVED:', rolePart);
    console.log('[Auth] ADMIN_SESSION_RESOLVED:', {
      uid: `usr_${token}`,
      email: lowerToken.includes('superadmin') ? 'superadmin@example.com' : 'admin@retailer.com',
      role: rolePart,
      isSuperAdmin: rolePart === 'platformSuperAdmin',
      source: 'dev_token',
    });

    const user: AuthenticatedAdmin = {
      uid: `usr_${token}`,
      email: lowerToken.includes('superadmin') ? 'superadmin@example.com' : 'admin@retailer.com',
      role: rolePart,
      tenantId: tenantHeader || 'brand-alpha',
      name: rolePart === 'platformSuperAdmin' ? 'Platform SuperAdmin' : 'Brand Administrator',
      isSuperAdmin: rolePart === 'platformSuperAdmin',
    };

    return {
      authenticated: true,
      authorized: true,
      user,
      code: 'AUTHORIZED',
      email: user.email,
    };
  }

  // 2. Real Firebase Auth ID Token verification via Firebase Admin SDK
  // Pre-validate that token is structurally a 3-part JWT (header.payload.signature) before invoking Firebase Admin
  const isJwtStructure =
    typeof token === 'string' &&
    token.split('.').length === 3 &&
    token.split('.').every((part) => part.trim().length > 0);

  if (!isJwtStructure && !isMockAuthForTest) {
    console.log('[Auth] Token rejected: not a valid 3-part JWT format');
    return {
      authenticated: false,
      authorized: false,
      user: null,
      code: 'INVALID_JWT_FORMAT',
      message: 'Token rejected: not a valid 3-part JWT format.',
    };
  }

  const auth = getFirebaseAdminAuth();
  if (auth) {
    try {
      const decoded = await auth.verifyIdToken(token);
      const email = (decoded.email || '').toLowerCase().trim();
      const uid = decoded.uid;
      const name = decoded.name || (email ? email.split('@')[0] : 'Admin User');
      const targetTenantId = tenantHeader || 'brand-alpha';

      // 2a. Bootstrap Allowlist Check: PLATFORM_SUPERADMIN_EMAILS
      // Comma-separated list of authorized initial platform superadmin emails.
      // Cryptographic verification above MUST succeed before checking email.
      let secretSuperadminEmails = '';
      try {
        secretSuperadminEmails = (await SecretManager.getSecret('PLATFORM_SUPERADMIN_EMAILS')) || '';
      } catch {}

      const allowlistRaw = [
        process.env.PLATFORM_SUPERADMIN_EMAILS,
        secretSuperadminEmails,
        process.env.PLATFORM_SUPERADMIN_EMAIL,
        'dleitch22@gmail.com', // Project owner Platform Super Admin bootstrap
        demoActive ? 'sarah.chen@platform.internal' : null,
      ]
        .filter(Boolean)
        .join(',');

      const superAdminAllowlist = allowlistRaw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      // Initial bootstrap: Check if tenantMemberships has any documents.
      // If Firestore has NO active memberships at all, the first authenticated user is bootstrapped as platformSuperAdmin.
      let isFirstAdmin = false;
      const db = isFirestorePermissionDenied() ? null : getFirestoreDb();
      if (db && email) {
        try {
          const snapshot = await db.collection('tenantMemberships').limit(1).get();
          if (snapshot.empty) {
            isFirstAdmin = true;
            console.log(`[RBAC Bootstrap] Empty tenantMemberships detected. First authenticated user ${email} bootstrapped as platformSuperAdmin.`);
          }
        } catch (dbErr: any) {
          if (isFirestorePermissionDeniedError(dbErr)) {
            markFirestorePermissionDenied(dbErr);
            console.info('[RBAC Bootstrap] Firestore IAM permission unavailable, proceeding with bootstrap allowlist.');
          } else {
            console.warn('[RBAC Bootstrap] Could not check memberships count:', dbErr?.message || dbErr);
          }
        }
      }

      const isBootstrapSuperAdmin = Boolean(
        email && (
          superAdminAllowlist.includes(email) ||
          (demoActive && (email.endsWith('@platform.internal') || email.includes('admin'))) ||
          isFirstAdmin
        )
      );

      if (isBootstrapSuperAdmin) {
        console.log('[Auth] APP_MODE:', appMode);
        console.log('[Auth] AUTH_SOURCE: firebase');
        console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
        console.log('[Auth] ADMIN_ROLE_RESOLVED: platformSuperAdmin');
        console.log('[Auth] ADMIN_EMAIL:', email);

        // Async backfill custom claims and Firestore membership for smooth subsequent calls & long-term RBAC
        try {
          auth.setCustomUserClaims(uid, { role: 'platformSuperAdmin', platformSuperAdmin: true }).catch(() => {});
          if (db) {
            db.collection('tenantMemberships').doc(`${uid}_platform`).set({
              uid,
              email,
              role: 'platformSuperAdmin',
              status: 'active',
              assignedAt: new Date().toISOString(),
              bootstrapSource: 'PLATFORM_SUPERADMIN_EMAILS',
            }, { merge: true }).catch(() => {});
          }
        } catch (_) {}

        const user: AuthenticatedAdmin = {
          uid,
          email,
          role: 'platformSuperAdmin',
          tenantId: targetTenantId,
          name,
          isSuperAdmin: true,
        };

        return {
          authenticated: true,
          authorized: true,
          user,
          code: 'AUTHORIZED',
          email,
        };
      }

      // 2b. Cryptographic custom claim check (e.g. platformSuperAdmin: true or role: 'platformSuperAdmin')
      if (decoded.role === 'platformSuperAdmin' || decoded.platformSuperAdmin === true) {
        console.log('[Auth] APP_MODE:', appMode);
        console.log('[Auth] AUTH_SOURCE: firebase');
        console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
        console.log('[Auth] ADMIN_ROLE_RESOLVED: platformSuperAdmin');
        console.log('[Auth] ADMIN_EMAIL:', email);

        const user: AuthenticatedAdmin = {
          uid,
          email,
          role: 'platformSuperAdmin',
          tenantId: targetTenantId,
          name,
          isSuperAdmin: true,
        };

        return {
          authenticated: true,
          authorized: true,
          user,
          code: 'AUTHORIZED',
          email,
        };
      }

      if (decoded.role && decoded.tenantId === targetTenantId) {
        console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
        console.log('[Auth] ADMIN_EMAIL:', email);
        console.log('[Auth] ADMIN_ROLE_RESOLVED:', decoded.role);
        console.log('[Auth] AUTH_SOURCE: firebase');

        const user: AuthenticatedAdmin = {
          uid,
          email,
          role: decoded.role as AuthenticatedAdmin['role'],
          tenantId: targetTenantId,
          name,
          isSuperAdmin: false,
        };

        return {
          authenticated: true,
          authorized: true,
          user,
          code: 'AUTHORIZED',
          email,
        };
      }

      // 2c. Query explicit per-tenant membership in Firestore: tenantMemberships
      if (db) {
        try {
          // Check platformSuperAdmin role in tenantMemberships by UID
          const superDoc = await db.collection('tenantMemberships').doc(`${uid}_platform`).get();
          if (superDoc.exists && (superDoc.data()?.role === 'platformSuperAdmin' || superDoc.data()?.role === 'PLATFORM_SUPER_ADMIN')) {
            console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
            console.log('[Auth] ADMIN_EMAIL:', email);
            console.log('[Auth] ADMIN_ROLE_RESOLVED: platformSuperAdmin');
            console.log('[Auth] AUTH_SOURCE: firebase');

            const user: AuthenticatedAdmin = {
              uid,
              email,
              role: 'platformSuperAdmin',
              tenantId: targetTenantId,
              name: superDoc.data()?.name || name,
              isSuperAdmin: true,
            };

            return {
              authenticated: true,
              authorized: true,
              user,
              code: 'AUTHORIZED',
              email,
            };
          }

          // Check platformSuperAdmin role by email
          if (email) {
            const superEmailDoc = await db.collection('tenantMemberships').doc(`${email}_platform`).get();
            if (superEmailDoc.exists && (superEmailDoc.data()?.role === 'platformSuperAdmin' || superEmailDoc.data()?.role === 'PLATFORM_SUPER_ADMIN')) {
              console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
              console.log('[Auth] ADMIN_EMAIL:', email);
              console.log('[Auth] ADMIN_ROLE_RESOLVED: platformSuperAdmin');
              console.log('[Auth] AUTH_SOURCE: firebase');

              // Link UID doc
              db.collection('tenantMemberships').doc(`${uid}_platform`).set({
                uid,
                email,
                role: 'platformSuperAdmin',
                status: 'active',
                assignedAt: new Date().toISOString(),
              }, { merge: true }).catch(() => {});

              const user: AuthenticatedAdmin = {
                uid,
                email,
                role: 'platformSuperAdmin',
                tenantId: targetTenantId,
                name: superEmailDoc.data()?.name || name,
                isSuperAdmin: true,
              };

              return {
                authenticated: true,
                authorized: true,
                user,
                code: 'AUTHORIZED',
                email,
              };
            }
          }

          const directDocId = `${uid}_${targetTenantId}`;
          const memDoc = await db.collection('tenantMemberships').doc(directDocId).get();

          if (memDoc.exists) {
            const memData = memDoc.data();
            const rawRole = memData?.role || 'viewer';
            const resolvedRole = (rawRole === 'PLATFORM_SUPER_ADMIN' ? 'platformSuperAdmin' : rawRole === 'TENANT_ADMIN' ? 'tenantAdmin' : rawRole) as AuthenticatedAdmin['role'];
            const isSuper = resolvedRole === 'platformSuperAdmin';

            console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
            console.log('[Auth] ADMIN_EMAIL:', email);
            console.log('[Auth] ADMIN_ROLE_RESOLVED:', resolvedRole);
            console.log('[Auth] AUTH_SOURCE: firebase');

            const user: AuthenticatedAdmin = {
              uid,
              email,
              role: resolvedRole,
              tenantId: targetTenantId,
              name: memData?.name || name,
              isSuperAdmin: isSuper,
            };

            return {
              authenticated: true,
              authorized: true,
              user,
              code: 'AUTHORIZED',
              email,
            };
          }

          // Check if registered by email: tenantMemberships/{email}_{tenantId}
          if (email) {
            const emailDocId = `${email}_${targetTenantId}`;
            const emailMemDoc = await db.collection('tenantMemberships').doc(emailDocId).get();
            if (emailMemDoc.exists) {
              const memData = emailMemDoc.data();
              const rawRole = memData?.role || 'viewer';
              const resolvedRole = (rawRole === 'PLATFORM_SUPER_ADMIN' ? 'platformSuperAdmin' : rawRole === 'TENANT_ADMIN' ? 'tenantAdmin' : rawRole) as AuthenticatedAdmin['role'];
              const isSuper = resolvedRole === 'platformSuperAdmin';

              console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
              console.log('[Auth] ADMIN_EMAIL:', email);
              console.log('[Auth] ADMIN_ROLE_RESOLVED:', resolvedRole);
              console.log('[Auth] AUTH_SOURCE: firebase');

              // Backfill UID record
              await db.collection('tenantMemberships').doc(directDocId).set({
                ...memData,
                uid,
                email,
                tenantId: targetTenantId,
                updatedAt: new Date().toISOString(),
              }, { merge: true });

              const user: AuthenticatedAdmin = {
                uid,
                email,
                role: resolvedRole,
                tenantId: targetTenantId,
                name: memData?.name || name,
                isSuperAdmin: isSuper,
              };

              return {
                authenticated: true,
                authorized: true,
                user,
                code: 'AUTHORIZED',
                email,
              };
            }
          }
        } catch (dbErr: any) {
          if (isFirestorePermissionDeniedError(dbErr)) {
            markFirestorePermissionDenied(dbErr);
            console.info('[RBAC] Firestore IAM permission unavailable, cannot query dynamic tenantMemberships.');
          } else {
            console.warn('[RBAC] Error querying tenantMemberships:', dbErr?.message || dbErr);
          }
        }
      }

      // RBAC Security Gate: An authenticated Firebase user with NO tenantMembership record
      // and NOT in PLATFORM_SUPERADMIN_EMAILS has NO ADMIN ACCESS.
      console.log('[Auth] FIREBASE_TOKEN_VERIFIED: true');
      console.log('[Auth] ADMIN_EMAIL:', email);
      console.log('[Auth] ADMIN_ROLE_RESOLVED: none');
      console.log('[Auth] AUTH_SOURCE: firebase');
      console.warn(
        `[RBAC Security] Access Denied: User ${email} (${uid}) has no authorized membership for tenant ${targetTenantId} and is not in PLATFORM_SUPERADMIN_EMAILS.`
      );

      return {
        authenticated: true,
        authorized: false,
        user: null,
        code: 'AUTHENTICATED_NOT_AUTHORIZED',
        email,
        message: `Authenticated as ${email}, but no administrative role found. Add this email to PLATFORM_SUPERADMIN_EMAILS or create a tenant membership.`,
      };
    } catch (err: any) {
      console.log('[Auth] ID token verification rejected:', err?.code || 'INVALID_TOKEN');
      return {
        authenticated: false,
        authorized: false,
        user: null,
        code: 'FIREBASE_TOKEN_INVALID',
        message: err?.message || 'Invalid or expired Firebase ID token.',
      };
    }
  }

  return {
    authenticated: false,
    authorized: false,
    user: null,
    code: 'AUTH_UNAVAILABLE',
    message: 'Firebase Admin Auth service is unavailable.',
  };
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
