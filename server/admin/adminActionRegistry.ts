import type { AdminRole } from '../../src/commerce/models';

export type AdminActionRisk = 'READ' | 'LOW_WRITE' | 'HIGH_WRITE' | 'RESTRICTED';

export type ServerAdminCapability =
  | 'catalog.read'
  | 'catalog.diagnostics'
  | 'stores.read'
  | 'stores.write'
  | 'branding.read'
  | 'branding.write'
  | 'content.read'
  | 'content.write'
  | 'rules.read'
  | 'rules.write'
  | 'fees.read'
  | 'fees.write'
  | 'integrations.read'
  | 'integrations.diagnostics'
  | 'integrations.configure'
  | 'memberships.read'
  | 'memberships.manage'
  | 'assistant.use'
  | 'assistant.executeLowRisk'
  | 'assistant.approveHighRisk';

export interface AdminActionDefinition {
  name: string;
  description: string;
  capability: ServerAdminCapability;
  risk: AdminActionRisk;
  supportsPreview: boolean;
  supportsUndo: boolean;
  enabledForAssistant: boolean;
}

const ROLE_CAPABILITIES: Record<AdminRole, ReadonlySet<ServerAdminCapability>> = {
  platformSuperAdmin: new Set<ServerAdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'branding.write', 'content.read', 'content.write',
    'rules.read', 'rules.write', 'fees.read', 'fees.write',
    'integrations.read', 'integrations.diagnostics', 'integrations.configure',
    'memberships.read', 'memberships.manage', 'assistant.use',
    'assistant.executeLowRisk', 'assistant.approveHighRisk',
  ]),
  tenantAdmin: new Set<ServerAdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'branding.write', 'content.read', 'content.write',
    'rules.read', 'rules.write', 'fees.read', 'fees.write',
    'integrations.read', 'integrations.diagnostics', 'integrations.configure',
    'memberships.read', 'memberships.manage', 'assistant.use',
    'assistant.executeLowRisk', 'assistant.approveHighRisk',
  ]),
  marketingEditor: new Set<ServerAdminCapability>([
    'catalog.read', 'stores.read', 'branding.read', 'branding.write',
    'content.read', 'content.write', 'rules.read', 'rules.write',
    'fees.read', 'integrations.read', 'assistant.use', 'assistant.executeLowRisk',
  ]),
  operationsEditor: new Set<ServerAdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'content.read', 'rules.read', 'rules.write',
    'fees.read', 'fees.write', 'integrations.read', 'integrations.diagnostics',
    'assistant.use', 'assistant.executeLowRisk',
  ]),
  viewer: new Set<ServerAdminCapability>([
    'catalog.read', 'stores.read', 'branding.read', 'content.read',
    'rules.read', 'fees.read', 'integrations.read', 'assistant.use',
  ]),
};

const ACTIONS: AdminActionDefinition[] = [
  {
    name: 'catalog.inspect',
    description: 'Inspect normalized catalogue and stock state for the active tenant.',
    capability: 'catalog.read',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'catalog.diagnoseVisibility',
    description: 'Trace why a product may not be visible in the storefront.',
    capability: 'catalog.diagnostics',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'stores.inspect',
    description: 'Read location configuration and compare settings.',
    capability: 'stores.read',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'integrations.diagnose',
    description: 'Read connection and commerce diagnostics without exposing credentials.',
    capability: 'integrations.diagnostics',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'branding.proposeUpdate',
    description: 'Prepare a branding change proposal without applying it.',
    capability: 'branding.write',
    risk: 'LOW_WRITE',
    supportsPreview: true,
    supportsUndo: true,
    enabledForAssistant: false,
  },
  {
    name: 'rules.proposeUpdate',
    description: 'Prepare a rule change proposal without applying it.',
    capability: 'rules.write',
    risk: 'HIGH_WRITE',
    supportsPreview: true,
    supportsUndo: true,
    enabledForAssistant: false,
  },
  {
    name: 'fees.proposeUpdate',
    description: 'Prepare a fee policy change proposal without applying it.',
    capability: 'fees.write',
    risk: 'HIGH_WRITE',
    supportsPreview: true,
    supportsUndo: true,
    enabledForAssistant: false,
  },
];

export function hasServerAdminCapability(role: AdminRole, capability: ServerAdminCapability): boolean {
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

export function listAssistantActionsForRole(role: AdminRole): AdminActionDefinition[] {
  if (!hasServerAdminCapability(role, 'assistant.use')) return [];
  return ACTIONS.filter(
    (action) => action.enabledForAssistant && hasServerAdminCapability(role, action.capability)
  );
}

export function getAdminActionDefinition(name: string): AdminActionDefinition | undefined {
  return ACTIONS.find((action) => action.name === name);
}
