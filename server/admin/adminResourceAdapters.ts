import type { TenantConfig } from '../../src/commerce/models';
import { FirestorePlatformService } from '../firestoreService';
import {
  ConfigurationRevisionService,
  diffConfiguration,
  type ConfigurationRevision,
} from './configurationRevisionService';
import {
  getAdminActionDefinition,
  validateAdminActionInput,
} from './adminActionRegistry';

export interface PreparedAdminActionProposal {
  actionName: string;
  input: Record<string, unknown>;
  affectedResources: Array<{ type: string; id: string; label?: string }>;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  diff?: unknown;
  warnings: string[];
  revisionIds: string[];
}

type BrandingSnapshot = Pick<
  TenantConfig,
  | 'brandName'
  | 'tagline'
  | 'logoUrl'
  | 'iconUrl'
  | 'faviconUrl'
  | 'headerLogoMode'
  | 'headerLogoMaxWidth'
  | 'primaryColour'
  | 'secondaryColour'
  | 'backgroundColour'
  | 'textColour'
  | 'surfaceColour'
  | 'mutedTextColour'
  | 'borderColour'
  | 'successColour'
  | 'warningColour'
  | 'errorColour'
  | 'fontFamily'
  | 'headingFontFamily'
  | 'carouselTitleFontFamily'
  | 'borderRadius'
>;

const BRANDING_KEYS: Array<keyof BrandingSnapshot> = [
  'brandName',
  'tagline',
  'logoUrl',
  'iconUrl',
  'faviconUrl',
  'headerLogoMode',
  'headerLogoMaxWidth',
  'primaryColour',
  'secondaryColour',
  'backgroundColour',
  'textColour',
  'surfaceColour',
  'mutedTextColour',
  'borderColour',
  'successColour',
  'warningColour',
  'errorColour',
  'fontFamily',
  'headingFontFamily',
  'carouselTitleFontFamily',
  'borderRadius',
];

function brandingSnapshot(config: TenantConfig): BrandingSnapshot {
  const result: Partial<BrandingSnapshot> = {};
  for (const key of BRANDING_KEYS) {
    const value = config[key];
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result as BrandingSnapshot;
}

async function ensureBrandingBaseline(
  tenantId: string,
  actorId: string,
  liveSnapshot: BrandingSnapshot
): Promise<ConfigurationRevision<BrandingSnapshot>> {
  const resolved = await ConfigurationRevisionService.resolvePublishedConfiguration<BrandingSnapshot>(
    tenantId,
    'tenantBranding',
    tenantId
  );

  if (resolved && diffConfiguration(resolved.revision.payload, liveSnapshot).length === 0) {
    return resolved.revision;
  }

  const baseline = await ConfigurationRevisionService.createRevision({
    tenantId,
    resourceType: 'tenantBranding',
    resourceId: tenantId,
    payload: liveSnapshot,
    actorId,
    expectedCurrentRevisionId: resolved?.pointer.currentRevisionId || null,
  });
  await ConfigurationRevisionService.validateRevision(tenantId, baseline.revisionId, actorId);
  const published = await ConfigurationRevisionService.publishRevision(
    tenantId,
    baseline.revisionId,
    actorId
  );
  return published.revision as ConfigurationRevision<BrandingSnapshot>;
}

async function prepareBrandingProposal(args: {
  tenantId: string;
  actorId: string;
  input?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<PreparedAdminActionProposal> {
  const definition = getAdminActionDefinition('branding.proposeUpdate');
  if (!definition) throw new Error('Branding action definition is not registered.');
  const input = validateAdminActionInput(definition, args.input);

  const currentTenant = await FirestorePlatformService.getTenantConfig(args.tenantId);
  const before = brandingSnapshot(currentTenant);
  const baseline = await ensureBrandingBaseline(args.tenantId, args.actorId, before);
  const after = { ...before, ...input } as BrandingSnapshot;
  const diff = diffConfiguration(before, after);

  if (diff.length === 0) {
    throw Object.assign(new Error('The proposed branding update does not change the current configuration.'), {
      code: 'ADMIN_CHANGESET_NO_CHANGES',
      statusCode: 400,
    });
  }

  const revision = await ConfigurationRevisionService.createRevision({
    tenantId: args.tenantId,
    resourceType: 'tenantBranding',
    resourceId: args.tenantId,
    payload: after,
    actorId: args.actorId,
    expectedCurrentRevisionId: baseline.revisionId,
    idempotencyKey: args.idempotencyKey
      ? `${args.idempotencyKey}:branding.proposeUpdate`
      : undefined,
  });
  const validated = await ConfigurationRevisionService.validateRevision(
    args.tenantId,
    revision.revisionId,
    args.actorId
  );

  return {
    actionName: definition.name,
    input,
    affectedResources: [
      {
        type: 'tenantBranding',
        id: args.tenantId,
        label: currentTenant.brandName,
      },
    ],
    beforeSnapshot: before,
    afterSnapshot: after,
    diff,
    warnings: [],
    revisionIds: [validated.revisionId],
  };
}

export class AdminResourceAdapterRegistry {
  static async prepareProposal(args: {
    tenantId: string;
    actorId: string;
    actionName: string;
    input?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<PreparedAdminActionProposal> {
    if (args.actionName === 'branding.proposeUpdate') {
      return prepareBrandingProposal(args);
    }

    const definition = getAdminActionDefinition(args.actionName);
    if (!definition) {
      throw Object.assign(new Error(`Unknown admin action: ${args.actionName}`), {
        code: 'ADMIN_ACTION_UNKNOWN',
        statusCode: 404,
      });
    }

    const input = validateAdminActionInput(definition, args.input);
    return {
      actionName: definition.name,
      input,
      affectedResources: [],
      warnings: [
        'A server-side resource preview adapter is not connected for this action yet. The proposal cannot be applied.',
      ],
      revisionIds: [],
    };
  }
}
