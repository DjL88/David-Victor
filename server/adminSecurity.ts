import type { Request, Response, NextFunction } from 'express';
import { getAppCheck } from 'firebase-admin/app-check';
import { getFirebaseAdminApp, getFirebaseAdminAuth } from './firebase';
import { getServerRuntimeMode } from './runtimeMode';

function enabled(name: string): boolean {
  return String(process.env[name] || '').trim().toLowerCase() === 'true';
}

/**
 * SEC-02b defence-in-depth for privileged Admin requests.
 *
 * Rollout is explicit so existing tenants are not locked out before their
 * Firebase MFA/App Check configuration is provisioned. Once enabled, checks
 * fail closed in staging/production. Demo/test flows remain unaffected.
 */
export async function adminSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  const mode = getServerRuntimeMode();
  if (mode !== 'staging' && mode !== 'production') return next();

  try {
    if (enabled('ADMIN_REQUIRE_APP_CHECK')) {
      const token = String(req.header('X-Firebase-AppCheck') || '').trim();
      const app = getFirebaseAdminApp();
      if (!token || !app) {
        return res.status(401).json({ code: 'APP_CHECK_REQUIRED', error: 'A valid application attestation is required.' });
      }
      await getAppCheck(app).verifyToken(token);
    }

    if (enabled('ADMIN_REQUIRE_MFA')) {
      const bearer = String(req.header('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
      const auth = getFirebaseAdminAuth();
      if (!bearer || !auth) {
        return res.status(401).json({ code: 'MFA_REQUIRED', error: 'Multi-factor authentication is required.' });
      }
      const decoded = await auth.verifyIdToken(bearer, true);
      const firebase = (decoded as any).firebase || {};
      if (!firebase.sign_in_second_factor) {
        return res.status(403).json({ code: 'MFA_REQUIRED', error: 'Multi-factor authentication is required for administrative access.' });
      }
    }

    return next();
  } catch {
    return res.status(401).json({ code: 'ADMIN_SECURITY_VERIFICATION_FAILED', error: 'Administrative security verification failed.' });
  }
}
