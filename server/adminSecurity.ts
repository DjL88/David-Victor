import type { Request, Response, NextFunction } from 'express';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirebaseAdminApp, getFirebaseAdminAuth } from './firebase';
import { getServerRuntimeMode } from './runtimeMode';

type AppCheckVerifierForTest = ((token: string) => Promise<unknown>) | null;
let appCheckVerifierForTest: AppCheckVerifierForTest = null;

export function setAdminAppCheckVerifierForTest(verifier: AppCheckVerifierForTest): void {
  appCheckVerifierForTest = verifier;
}

function enabled(name: string): boolean {
  const value = String(process.env[name] || '').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'required';
}

function isLiveAdminMode(): boolean {
  const mode = getServerRuntimeMode();
  return mode === 'staging' || mode === 'production';
}

function hasSecondFactor(decoded: Record<string, any>): boolean {
  const factor = decoded?.firebase?.sign_in_second_factor;
  if (typeof factor === 'string') return factor.trim().length > 0;
  return Array.isArray(factor) && factor.length > 0;
}

async function verifyAppCheckToken(token: string): Promise<boolean> {
  try {
    if (appCheckVerifierForTest) {
      await appCheckVerifierForTest(token);
      return true;
    }
    const app = getFirebaseAdminApp();
    if (!app) return false;
    await getAppCheck(app).verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

async function enforceAppCheck(
  req: Request,
  res: Response,
  next: NextFunction,
  flagName: 'ADMIN_REQUIRE_APP_CHECK' | 'CHECKOUT_REQUIRE_APP_CHECK'
) {
  if (!isLiveAdminMode() || !enabled(flagName)) return next();

  const token = String(req.header('X-Firebase-AppCheck') || '').trim();
  if (!token) {
    return res.status(401).json({
      code: 'APP_CHECK_REQUIRED',
      error: 'A valid application attestation is required.',
    });
  }

  if (!(await verifyAppCheckToken(token))) {
    return res.status(401).json({
      code: 'APP_CHECK_INVALID',
      error: 'Application attestation could not be verified.',
    });
  }

  return next();
}

/**
 * SEC-02b defence-in-depth for privileged Admin requests.
 *
 * Rollout remains explicit so existing tenants are not locked out before
 * Identity Platform TOTP and Firebase App Check are provisioned. When enabled,
 * checks fail closed in staging/production. Demo/test flows remain unaffected.
 */
export async function adminSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isLiveAdminMode()) return next();

  const continueAfterAppCheck = async () => {
    if (!enabled('ADMIN_REQUIRE_MFA')) return next();

    try {
      const bearer = String(req.header('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
      const auth = getFirebaseAdminAuth();
      if (!bearer || !auth) {
        return res.status(401).json({
          code: 'MFA_REQUIRED',
          error: 'Multi-factor authentication is required.',
        });
      }

      const decoded = await auth.verifyIdToken(bearer, true);
      if (!hasSecondFactor(decoded as Record<string, any>)) {
        return res.status(403).json({
          code: 'MFA_REQUIRED',
          error: 'Multi-factor authentication is required for administrative access.',
        });
      }

      return next();
    } catch {
      return res.status(401).json({
        code: 'MFA_VERIFICATION_FAILED',
        error: 'Multi-factor authentication could not be verified.',
      });
    }
  };

  if (!enabled('ADMIN_REQUIRE_APP_CHECK')) {
    return continueAfterAppCheck();
  }

  return enforceAppCheck(req, res, continueAfterAppCheck, 'ADMIN_REQUIRE_APP_CHECK');
}

/**
 * Optional storefront checkout attestation boundary. This is deliberately a
 * separate rollout flag from Admin App Check because customer traffic may need
 * a staged cut-over. Once CHECKOUT_REQUIRE_APP_CHECK is enabled, POST /checkouts
 * fails closed unless the same Firebase App Check token contract verifies.
 */
export async function checkoutAppCheckMiddleware(req: Request, res: Response, next: NextFunction) {
  return enforceAppCheck(req, res, next, 'CHECKOUT_REQUIRE_APP_CHECK');
}
