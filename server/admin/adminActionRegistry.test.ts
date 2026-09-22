import { describe, expect, it } from 'vitest';
import {
  assertAssistantActionAllowed,
  buildReadOnlyActionPlan,
  listAssistantActionsForRole,
  hasServerAdminCapability,
} from './adminActionRegistry';

describe('adminActionRegistry', () => {
  it('exposes only assistant-enabled actions permitted to the role', () => {
    const viewer = listAssistantActionsForRole('viewer');
    expect(viewer.map((action) => action.name)).toEqual(
      expect.arrayContaining(['catalog.inspect', 'stores.inspect'])
    );
    expect(viewer.map((action) => action.name)).not.toContain('catalog.diagnoseVisibility');
    expect(viewer.every((action) => action.enabledForAssistant)).toBe(true);
  });

  it('rejects disabled write actions even for super admins', () => {
    expect(() => assertAssistantActionAllowed('platformSuperAdmin', 'fees.proposeUpdate')).toThrow(
      'not enabled'
    );
  });

  it('rejects actions outside a role capability set', () => {
    expect(() => assertAssistantActionAllowed('viewer', 'integrations.diagnose')).toThrow(
      'permission'
    );
  });

  it('rejects invalid action input before an executor can see it', () => {
    const action = assertAssistantActionAllowed('tenantAdmin', 'catalog.diagnoseVisibility');
    expect(() => buildReadOnlyActionPlan({ action, tenantId: 'tenant-a', actorId: 'user-1', input: {} })).toThrow('required');
  });

  it('keeps viewer access read-only for sensitive admin resources', () => {
    expect(hasServerAdminCapability('viewer', 'assets.read')).toBe(true);
    expect(hasServerAdminCapability('viewer', 'assets.write')).toBe(false);
    expect(hasServerAdminCapability('viewer', 'stores.write')).toBe(false);
    expect(hasServerAdminCapability('tenantAdmin', 'assets.write')).toBe(true);
  });

  it('builds read-only plans that are tenant-bound and executable', () => {
    const action = assertAssistantActionAllowed('tenantAdmin', 'catalog.diagnoseVisibility');
    const plan = buildReadOnlyActionPlan({
      action,
      tenantId: 'tenant-a',
      actorId: 'user-1',
      input: { plu: '123' },
    });

    expect(plan.tenantId).toBe('tenant-a');
    expect(plan.risk).toBe('READ');
    expect(plan.requiresConfirmation).toBe(false);
    expect(plan.executable).toBe(true);
    expect(plan.input).toEqual({ plu: '123' });
  });
});
