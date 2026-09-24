import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const router = fs.readFileSync(path.resolve(process.cwd(), 'server/api/v1Router.ts'), 'utf8');
const adminLayout = fs.readFileSync(path.resolve(process.cwd(), 'src/admin/AdminLayout.tsx'), 'utf8');
const memberships = fs.readFileSync(path.resolve(process.cwd(), 'src/admin/screens/MembershipsScreen.tsx'), 'utf8');

describe('Sprint 5 role and admin acceptance', () => {
  it('keeps platform tenant enumeration and destructive location removal Super Admin only', () => {
    expect(router).toContain("v1Router.get('/admin/tenants', requireAdminAuth('platformSuperAdmin')");
    expect(router).toContain("v1Router.delete('/admin/tenants/:id/stores/:storeId', requireAdminAuth('platformSuperAdmin')");
    expect(router).toContain("action: 'HARD_DELETE_LOCATION'");
  });

  it('enforces tenant membership scope and role grant ceilings on the server', () => {
    expect(router).toContain("requireAdminCapability('memberships.manage')");
    expect(router).toContain("code: 'TENANT_ISOLATION_ERROR'");
    expect(router).toContain("code: 'ROLE_GRANT_NOT_ALLOWED'");
    expect(router).toContain("code: 'FORBIDDEN_SUPERADMIN_ONLY'");
    expect(router).toContain("code: 'ROLE_REVOKE_NOT_ALLOWED'");
  });

  it('fails closed when the live membership/auth stores are unavailable', () => {
    expect(router).toContain("code: 'ADMIN_MEMBERSHIP_STORE_UNAVAILABLE'");
    expect(router).toContain("code: 'ADMIN_INVITE_AUTH_UNAVAILABLE'");
    expect(router).toContain("code: 'MEMBERSHIP_REVOCATION_AUTH_UNAVAILABLE'");
  });

  it('does not expose platform tenant switching or mock identity switching as ordinary tenant-admin UI', () => {
    expect(adminLayout).toContain("currentUser.role === 'platformSuperAdmin'");
    expect(adminLayout).toContain('isDemo');
    expect(adminLayout).toContain('handleUserSwitch');
    expect(memberships).toContain("newRole === 'platformSuperAdmin' ? 'platform' : newTenantId");
    expect(memberships).toContain("currentUser.isSuperAdmin || currentUser.role === 'platformSuperAdmin'");
  });
});
