import { describe, expect, it } from 'vitest';
import type { AdminRole } from '../../src/commerce/models';
import {
  listAdminCapabilities,
  type AdminCapability,
} from '../../src/admin/capabilities';
import {
  hasServerAdminCapability,
  listAssistantActionsForRole,
  type ServerAdminCapability,
} from './adminActionRegistry';

const ROLES: AdminRole[] = [
  'platformSuperAdmin',
  'tenantAdmin',
  'marketingEditor',
  'operationsEditor',
  'viewer',
];

describe('Artie capability parity', () => {
  it('keeps browser guidance and server authorization capability sets aligned', () => {
    for (const role of ROLES) {
      const clientCapabilities = new Set<AdminCapability>(
        listAdminCapabilities(role)
      );
      const knownCapabilities = Array.from(
        new Set(
          ROLES.flatMap((candidateRole) =>
            listAdminCapabilities(candidateRole)
          )
        )
      );

      for (const capability of knownCapabilities) {
        expect(
          hasServerAdminCapability(
            role,
            capability as ServerAdminCapability
          ),
          `${role} capability drift for ${capability}`
        ).toBe(clientCapabilities.has(capability));
      }
    }
  });

  it('never advertises an assistant action that the server capability layer denies', () => {
    for (const role of ROLES) {
      const actions = listAssistantActionsForRole(role);
      for (const action of actions) {
        expect(
          hasServerAdminCapability(role, action.capability),
          `${role} was advertised ${action.name} without ${action.capability}`
        ).toBe(true);
      }
    }
  });
});
