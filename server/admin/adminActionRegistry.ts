import { z } from 'zod';
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
  | 'assets.read'
  | 'assets.write'
  | 'domains.read'
  | 'domains.manage'
  | 'audit.read'
  | 'assistant.use'
  | 'assistant.executeLowRisk'
  | 'assistant.approveHighRisk';

export interface AdminActionDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  capability: ServerAdminCapability;
  risk: AdminActionRisk;
  supportsPreview: boolean;
  supportsUndo: boolean;
  enabledForAssistant: boolean;
}

export type AdminActionMetadata = Omit<AdminActionDefinition, 'inputSchema'> & {
  assistantMode: 'EXECUTE_READ' | 'PROPOSE_ONLY';
};

const ROLE_CAPABILITIES: Record<AdminRole, ReadonlySet<ServerAdminCapability>> = {
  platformSuperAdmin: new Set<ServerAdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'branding.write', 'content.read', 'content.write',
    'rules.read', 'rules.write', 'fees.read', 'fees.write',
    'integrations.read', 'integrations.diagnostics', 'integrations.configure',
    'memberships.read', 'memberships.manage', 'assets.read', 'assets.write',
    'domains.read', 'domains.manage', 'audit.read', 'assistant.use',
    'assistant.executeLowRisk', 'assistant.approveHighRisk',
  ]),
  tenantAdmin: new Set<ServerAdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'branding.write', 'content.read', 'content.write',
    'rules.read', 'rules.write', 'fees.read', 'fees.write',
    'integrations.read', 'integrations.diagnostics', 'integrations.configure',
    'memberships.read', 'memberships.manage', 'assets.read', 'assets.write',
    'domains.read', 'domains.manage', 'audit.read', 'assistant.use',
    'assistant.executeLowRisk', 'assistant.approveHighRisk',
  ]),
  marketingEditor: new Set<ServerAdminCapability>([
    'catalog.read', 'stores.read', 'branding.read', 'branding.write',
    'content.read', 'content.write', 'rules.read', 'rules.write',
    'fees.read', 'integrations.read', 'assets.read', 'assets.write',
    'domains.read', 'audit.read', 'assistant.use', 'assistant.executeLowRisk',
  ]),
  operationsEditor: new Set<ServerAdminCapability>([
    'catalog.read', 'catalog.diagnostics', 'stores.read', 'stores.write',
    'branding.read', 'content.read', 'rules.read', 'rules.write',
    'fees.read', 'fees.write', 'integrations.read', 'integrations.diagnostics',
    'assets.read', 'domains.read', 'audit.read', 'assistant.use',
    'assistant.executeLowRisk',
  ]),
  viewer: new Set<ServerAdminCapability>([
    'catalog.read', 'stores.read', 'branding.read', 'content.read',
    'rules.read', 'fees.read', 'integrations.read', 'assets.read',
    'domains.read', 'audit.read', 'assistant.use',
  ]),
};

const EmptyInputSchema = z.object({}).passthrough();
const CatalogueDiagnosticInputSchema = z.object({
  query: z.string().trim().min(1).optional(),
  plu: z.string().trim().min(1).optional(),
  productId: z.string().trim().min(1).optional(),
}).refine((value) => Boolean(value.query || value.plu || value.productId), {
  message: 'A product name, PLU, barcode or product ID is required.',
});
const ProposalInputSchema = z.record(z.string(), z.unknown());

const BrandingProposalInputSchema = z.object({
  brandName: z.string().trim().min(1).max(200).optional(),
  tagline: z.string().max(500).optional(),
  logoUrl: z.string().max(4000).optional(),
  iconUrl: z.string().max(4000).optional(),
  faviconUrl: z.string().max(4000).optional(),
  headerLogoMode: z.enum(['ICON_WITH_TEXT', 'WIDE_LOGO', 'LOGO_ONLY']).optional(),
  headerLogoMaxWidth: z.number().finite().min(24).max(1200).optional(),
  primaryColour: z.string().trim().min(1).max(100).optional(),
  secondaryColour: z.string().trim().min(1).max(100).optional(),
  backgroundColour: z.string().trim().min(1).max(100).optional(),
  textColour: z.string().trim().min(1).max(100).optional(),
  surfaceColour: z.string().trim().min(1).max(100).optional(),
  mutedTextColour: z.string().trim().min(1).max(100).optional(),
  borderColour: z.string().trim().min(1).max(100).optional(),
  successColour: z.string().trim().min(1).max(100).optional(),
  warningColour: z.string().trim().min(1).max(100).optional(),
  errorColour: z.string().trim().min(1).max(100).optional(),
  fontFamily: z.string().trim().min(1).max(200).optional(),
  headingFontFamily: z.string().trim().min(1).max(200).optional(),
  carouselTitleFontFamily: z.string().trim().min(1).max(200).optional(),
  borderRadius: z.string().trim().min(1).max(100).optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  enabledLocales: z.array(z.string().trim().min(2).max(20)).min(1).max(20).optional(),
  copyOverrides: z.record(
    z.string().trim().min(2).max(20),
    z.record(z.string().trim().min(1).max(160), z.string().max(1000))
  ).optional(),
  supportDetails: z.object({
    email: z.string().max(320).optional(),
    phone: z.string().max(100).optional(),
    openingHours: z.string().max(500).optional(),
    helpCenterUrl: z.string().max(4000).optional(),
  }).strict().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one branding field is required.',
});

const ACTIONS: AdminActionDefinition[] = [
  {
    name: 'catalog.inspect',
    description: 'Inspect normalized catalogue and stock state for the active tenant.',
    inputSchema: EmptyInputSchema,
    capability: 'catalog.read',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'catalog.diagnoseVisibility',
    description: 'Trace why a product may not be visible in the storefront.',
    inputSchema: CatalogueDiagnosticInputSchema,
    capability: 'catalog.diagnostics',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'stores.inspect',
    description: 'Read location configuration and compare settings.',
    inputSchema: EmptyInputSchema,
    capability: 'stores.read',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'integrations.diagnose',
    description: 'Read connection and commerce diagnostics without exposing credentials.',
    inputSchema: EmptyInputSchema,
    capability: 'integrations.diagnostics',
    risk: 'READ',
    supportsPreview: false,
    supportsUndo: false,
    enabledForAssistant: true,
  },
  {
    name: 'branding.proposeUpdate',
    description: 'Prepare a branding change proposal without applying it.',
    inputSchema: BrandingProposalInputSchema,
    capability: 'branding.write',
    risk: 'LOW_WRITE',
    supportsPreview: true,
    supportsUndo: true,
    enabledForAssistant: false,
  },
  {
    name: 'rules.proposeUpdate',
    description: 'Prepare a rule change proposal without applying it.',
    inputSchema: ProposalInputSchema,
    capability: 'rules.write',
    risk: 'HIGH_WRITE',
    supportsPreview: true,
    supportsUndo: true,
    enabledForAssistant: false,
  },
  {
    name: 'fees.proposeUpdate',
    description: 'Prepare a fee policy change proposal without applying it.',
    inputSchema: ProposalInputSchema,
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

export function listAssistantActionsForRole(role: AdminRole): AdminActionMetadata[] {
  if (!hasServerAdminCapability(role, 'assistant.use')) return [];
  return ACTIONS
    .filter(
      (action) =>
        hasServerAdminCapability(role, action.capability) &&
        (action.enabledForAssistant || (action.risk !== 'READ' && action.supportsPreview))
    )
    .map(({ inputSchema: _inputSchema, ...metadata }) => ({
      ...metadata,
      assistantMode: metadata.enabledForAssistant ? 'EXECUTE_READ' : 'PROPOSE_ONLY',
    }));
}

export function getAdminActionDefinition(name: string): AdminActionDefinition | undefined {
  return ACTIONS.find((action) => action.name === name);
}

const SENSITIVE_INPUT_KEY = /^(?:password|secret|clientSecret|apiKey|accessToken|refreshToken|authorization|credential|credentials)$/i;

function findSensitiveInputKey(value: unknown, path: string[] = [], depth = 0): string | null {
  if (depth > 8 || value === null || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSensitiveInputKey(value[index], [...path, String(index)], depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_INPUT_KEY.test(key)) return [...path, key].join('.');
    const found = findSensitiveInputKey(nested, [...path, key], depth + 1);
    if (found) return found;
  }
  return null;
}

export function validateAdminActionInput(
  action: AdminActionDefinition,
  input: Record<string, unknown> | undefined
): Record<string, unknown> {
  const rawInput = input || {};
  const sensitiveKey = findSensitiveInputKey(rawInput);
  if (sensitiveKey) {
    throw Object.assign(
      new Error(`Sensitive credential fields are not allowed in assistant action input (${sensitiveKey}).`),
      { code: 'ADMIN_ACTION_SENSITIVE_INPUT_FORBIDDEN', statusCode: 400 }
    );
  }
  const parsed = action.inputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw Object.assign(new Error(parsed.error.issues.map((issue) => issue.message).join('; ')), {
      code: 'ADMIN_ACTION_INPUT_INVALID',
      statusCode: 400,
      issues: parsed.error.issues,
    });
  }
  return parsed.data as Record<string, unknown>;
}

export interface AdminActionPlan {
  planId: string;
  actionName: string;
  tenantId: string;
  actorId: string;
  risk: AdminActionRisk;
  summary: string;
  input: Record<string, unknown>;
  affectedResources: Array<{ type: string; id: string; label?: string }>;
  requiresConfirmation: boolean;
  executable: boolean;
  reversible: boolean;
  createdAt: string;
}

export function assertAssistantActionAllowed(role: AdminRole, actionName: string): AdminActionDefinition {
  const action = getAdminActionDefinition(actionName);
  if (!action) {
    throw Object.assign(new Error('Unknown admin action.'), { code: 'ADMIN_ACTION_UNKNOWN', statusCode: 404 });
  }
  if (!action.enabledForAssistant) {
    throw Object.assign(new Error('This action is not enabled for assistant execution.'), { code: 'ADMIN_ACTION_DISABLED', statusCode: 403 });
  }
  if (!hasServerAdminCapability(role, 'assistant.use') || !hasServerAdminCapability(role, action.capability)) {
    throw Object.assign(new Error('Your role does not have permission to use this admin action.'), { code: 'ADMIN_ACTION_FORBIDDEN', statusCode: 403 });
  }
  return action;
}

export function buildReadOnlyActionPlan(args: {
  action: AdminActionDefinition;
  tenantId: string;
  actorId: string;
  input?: Record<string, unknown>;
}): AdminActionPlan {
  const now = new Date().toISOString();
  const entropy = Math.random().toString(36).slice(2, 10);
  const input = validateAdminActionInput(args.action, args.input);
  return {
    planId: `plan-${Date.now()}-${entropy}`,
    actionName: args.action.name,
    tenantId: args.tenantId,
    actorId: args.actorId,
    risk: args.action.risk,
    summary: args.action.description,
    input,
    affectedResources: [],
    requiresConfirmation: args.action.risk !== 'READ',
    executable: args.action.risk === 'READ' && args.action.enabledForAssistant,
    reversible: args.action.supportsUndo,
    createdAt: now,
  };
}
