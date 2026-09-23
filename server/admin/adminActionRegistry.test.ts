import { describe, expect, it } from 'vitest';
import {
  assertAssistantActionAllowed,
  buildReadOnlyActionPlan,
  listAssistantActionsForRole,
  hasServerAdminCapability,
  getAdminActionDefinition,
  validateAdminActionInput,
} from './adminActionRegistry';

describe('adminActionRegistry', () => {
  it('exposes only assistant-enabled actions permitted to the role', () => {
    const viewer = listAssistantActionsForRole('viewer');
    expect(viewer.map((action) => action.name)).toEqual(
      expect.arrayContaining(['catalog.inspect', 'stores.inspect', 'rules.inspect'])
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

  it('advertises previewable write actions as proposal-only', () => {
    const actions = listAssistantActionsForRole('tenantAdmin');
    expect(actions.find((action) => action.name === 'branding.proposeUpdate')?.assistantMode).toBe('PROPOSE_ONLY');
    expect(actions.find((action) => action.name === 'catalog.inspect')?.assistantMode).toBe('EXECUTE_READ');
    expect(actions.find((action) => action.name === 'rules.inspect')?.assistantMode).toBe('EXECUTE_READ');
    expect(listAssistantActionsForRole('viewer').some((action) => action.name === 'branding.proposeUpdate')).toBe(false);
  });

  it('rejects credential-shaped fields from assistant action input', () => {
    const action = listAssistantActionsForRole('tenantAdmin').find((candidate) => candidate.name === 'branding.proposeUpdate');
    expect(action).toBeTruthy();
    const definition = getAdminActionDefinition('branding.proposeUpdate')!;
    expect(() => validateAdminActionInput(definition, { clientSecret: 'do-not-store' })).toThrow('Sensitive credential fields');
  });

  it('accepts reviewable brand terminology and locale proposals', () => {
    const definition = getAdminActionDefinition('branding.proposeUpdate')!;
    const input = validateAdminActionInput(definition, {
      locale: 'en-GB',
      enabledLocales: ['en-GB', 'en-US'],
      copyOverrides: {
        'en-US': {
          'header.basket': 'Cart',
          'header.collect': 'Pickup',
        },
      },
    });

    expect(input).toMatchObject({
      locale: 'en-GB',
      enabledLocales: ['en-GB', 'en-US'],
      copyOverrides: {
        'en-US': {
          'header.basket': 'Cart',
          'header.collect': 'Pickup',
        },
      },
    });
  });

  it('rejects credential-shaped keys nested inside brand wording proposals', () => {
    const definition = getAdminActionDefinition('branding.proposeUpdate')!;
    expect(() =>
      validateAdminActionInput(definition, {
        copyOverrides: {
          'en-GB': {
            apiKey: 'never-store-this',
          },
        },
      })
    ).toThrow('Sensitive credential fields');
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
