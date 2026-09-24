import type { AdminRole } from '../commerce/models';

export type AdminCapability =
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
  | 'assets.read'
  | 'assets.write'
  | 'domains.read'
  | 'domains.manage'
  | 'audit.read'
  | 'billing.read'
  | 'billing.manage'
  | 'assistant.use'
  | 'assistant.executeLowRisk'
  | 'assistant.approveHighRisk';

const ROLE_CAPABILITIES: Record<AdminRole, ReadonlySet<AdminCapability>> = {
  platformSuperAdmin: new Set<AdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'branding.write', 'content.read', 'content.write',
    'rules.read', 'rules.write', 'fees.read', 'fees.write',
    'integrations.read', 'integrations.diagnostics', 'integrations.configure',
    'memberships.read', 'memberships.manage', 'assets.read', 'assets.write',
    'domains.read', 'domains.manage', 'audit.read', 'billing.read', 'billing.manage', 'assistant.use',
    'assistant.executeLowRisk', 'assistant.approveHighRisk',
  ]),
  tenantAdmin: new Set<AdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'branding.write', 'content.read', 'content.write',
    'rules.read', 'rules.write', 'fees.read', 'fees.write',
    'integrations.read', 'integrations.diagnostics', 'integrations.configure',
    'memberships.read', 'memberships.manage', 'assets.read', 'assets.write',
    'domains.read', 'domains.manage', 'audit.read', 'billing.read', 'assistant.use',
    'assistant.executeLowRisk', 'assistant.approveHighRisk',
  ]),
  marketingEditor: new Set<AdminCapability>([
    'catalog.read', 'stores.read', 'branding.read', 'branding.write',
    'content.read', 'content.write', 'rules.read', 'rules.write',
    'fees.read', 'integrations.read', 'assets.read', 'assets.write',
    'domains.read', 'audit.read', 'assistant.use', 'assistant.executeLowRisk',
  ]),
  operationsEditor: new Set<AdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'content.read', 'rules.read', 'rules.write',
    'fees.read', 'fees.write', 'integrations.read', 'integrations.diagnostics',
    'assets.read', 'domains.read', 'audit.read', 'assistant.use',
    'assistant.executeLowRisk',
  ]),
  viewer: new Set<AdminCapability>([
    'catalog.read', 'stores.read', 'branding.read', 'content.read',
    'rules.read', 'fees.read', 'integrations.read', 'assets.read', 'domains.read', 'audit.read', 'assistant.use',
  ]),
};

export function hasAdminCapability(role: AdminRole, capability: AdminCapability): boolean {
  return ROLE_CAPABILITIES[role]?.has(capability) ?? false;
}

export function listAdminCapabilities(role: AdminRole): AdminCapability[] {
  return Array.from(ROLE_CAPABILITIES[role] || []);
}
