import { vi } from 'vitest';
import { setMockAdminAuthForTest } from '../../../server/firebase';

export interface MockFirebaseAdminClaims {
  uid?: string;
  email?: string;
  email_verified?: boolean;
  role?: string;
  tenantId?: string;
  platformSuperAdmin?: boolean;
  name?: string;
}

/**
 * Installs a Firebase Admin Auth mock and returns a structurally JWT-shaped token.
 * Behavioural HTTP tests still exercise the real auth middleware; only Google's
 * cryptographic token verification is replaced.
 */
export function installMockFirebaseAdminToken(claims: MockFirebaseAdminClaims = {}) {
  const token = 'test-header.test-payload.test-signature';
  const verifyIdToken = vi.fn().mockResolvedValue({
    uid: 'test-admin-uid',
    email: 'admin@example.test',
    email_verified: true,
    role: 'platformSuperAdmin',
    platformSuperAdmin: true,
    ...claims,
  });
  setMockAdminAuthForTest({ verifyIdToken } as any);
  return { token, verifyIdToken };
}
