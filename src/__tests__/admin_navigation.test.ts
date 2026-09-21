import { describe, it, expect } from 'vitest';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';

describe('Prompt 8 — Simplify Admin Navigation & Badges', () => {
  it('has mock admin users with roles defined for navigation filtering', () => {
    const superAdmin = ALL_MOCK_ADMIN_USERS.find((u) => u.role === 'platformSuperAdmin');
    const tenantAdmin = ALL_MOCK_ADMIN_USERS.find((u) => u.role === 'tenantAdmin');

    expect(superAdmin).toBeDefined();
    expect(tenantAdmin).toBeDefined();
  });
});
