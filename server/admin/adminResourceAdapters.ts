import type { TenantConfig } from '../../src/commerce/models';
import { FirestorePlatformService } from '../firestoreService';
import { getFirestoreDb } from '../firebase';
import { isDemoMode, isTestMode } from '../runtimeMode';
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

async function projectBrandingRevision(args: {
  tenantId: string;
  actorId: string;
  revisionId: string;
}): Promise<{ revisionId: string; tenant: TenantConfig }> {
  const revision = await ConfigurationRevisionService.getRevision<BrandingSnapshot>(
    args.tenantId,
    args.revisionId
  );
  if (revision.resourceType !== 'tenantBranding' || revision.resourceId !== args.tenantId) {
    throw Object.assign(new Error('Revision does not belong to this tenant branding resource.'), {
      code: 'ADMIN_REVISION_RESOURCE_MISMATCH',
      statusCode: 409,
    });
  }
  if (revision.status === 'PUBLISHED') {
    const current = await ConfigurationRevisionService.resolvePublishedConfiguration<BrandingSnapshot>(
      args.tenantId,
      'tenantBranding',
      args.tenantId
    );
    if (current?.pointer.currentRevisionId === revision.revisionId) {
      const tenant = await FirestorePlatformService.getTenantConfig(args.tenantId);
      return { revisionId: revision.revisionId, tenant };
    }
  }
  if (revision.status !== 'VALIDATED') {
    throw Object.assign(new Error('Branding revision is not validated and cannot be applied.'), {
      code: 'ADMIN_REVISION_NOT_VALIDATED',
      statusCode: 409,
    });
  }

  const currentTenant = await FirestorePlatformService.getTenantConfig(args.tenantId);
  if (revision.basedOnRevisionId) {
    const baseRevision = await ConfigurationRevisionService.getRevision<BrandingSnapshot>(
      args.tenantId,
      revision.basedOnRevisionId
    );
    const liveBeforeApply = brandingSnapshot(currentTenant);
    if (diffConfiguration(baseRevision.payload, liveBeforeApply).length > 0) {
      throw Object.assign(
        new Error('Branding changed after this proposal was created. Review a fresh proposal before applying.'),
        { code: 'ADMIN_REVISION_LIVE_STATE_CONFLICT', statusCode: 409 }
      );
    }
  }
  const updatedAt = new Date().toISOString();
  const fullTenant = {
    ...currentTenant,
    ...revision.payload,
    updatedAt,
  } as TenantConfig;

  const db = getFirestoreDb();
  if (!db) {
    if (!isDemoMode() && !isTestMode() && process.env.NODE_ENV !== 'test') {
      throw Object.assign(new Error('Durable Firestore persistence is unavailable.'), {
        code: 'ADMIN_REVISION_STORE_UNAVAILABLE',
        statusCode: 503,
      });
    }
    const tenant = await FirestorePlatformService.updateTenantConfig(args.tenantId, revision.payload);
    await ConfigurationRevisionService.publishRevision(args.tenantId, revision.revisionId, args.actorId);
    return { revisionId: revision.revisionId, tenant };
  }

  const tenantRef = db.collection('tenants').doc(args.tenantId);
  await ConfigurationRevisionService.publishRevision(
    args.tenantId,
    revision.revisionId,
    args.actorId,
    {
      documentRef: tenantRef,
      data: { ...revision.payload, updatedAt },
      merge: true,
    }
  );
  FirestorePlatformService.cacheTenantConfigSnapshot(args.tenantId, fullTenant);
  return { revisionId: revision.revisionId, tenant: fullTenant };
}

async function rollbackBrandingRevision(args: {
  tenantId: string;
  actorId: string;
  appliedRevisionId: string;
}): Promise<{ revisionId: string; tenant: TenantConfig }> {
  const applied = await ConfigurationRevisionService.getRevision<BrandingSnapshot>(
    args.tenantId,
    args.appliedRevisionId
  );
  if (applied.resourceType !== 'tenantBranding' || applied.resourceId !== args.tenantId) {
    throw Object.assign(new Error('Revision does not belong to this tenant branding resource.'), {
      code: 'ADMIN_REVISION_RESOURCE_MISMATCH',
      statusCode: 409,
    });
  }
  if (!applied.basedOnRevisionId) {
    throw Object.assign(new Error('Branding change does not have a prior revision to restore.'), {
      code: 'ADMIN_REVISION_ROLLBACK_INVALID',
      statusCode: 409,
    });
  }

  const target = await ConfigurationRevisionService.getRevision<BrandingSnapshot>(
    args.tenantId,
    applied.basedOnRevisionId
  );
  const current = await ConfigurationRevisionService.resolvePublishedConfiguration<BrandingSnapshot>(
    args.tenantId,
    'tenantBranding',
    args.tenantId
  );

  if (
    applied.status === 'SUPERSEDED' &&
    current?.revision.basedOnRevisionId === applied.revisionId &&
    diffConfiguration(current.revision.payload, target.payload).length === 0
  ) {
    const tenant = await FirestorePlatformService.getTenantConfig(args.tenantId);
    return { revisionId: current.revision.revisionId, tenant };
  }

  if (applied.status !== 'PUBLISHED' || !current || current.pointer.currentRevisionId !== applied.revisionId) {
    throw Object.assign(
      new Error('Branding changed again after this change set was applied; automatic rollback is unsafe.'),
      { code: 'ADMIN_REVISION_ROLLBACK_CONFLICT', statusCode: 409 }
    );
  }

  const liveBeforeRollback = brandingSnapshot(
    await FirestorePlatformService.getTenantConfig(args.tenantId)
  );
  if (diffConfiguration(applied.payload, liveBeforeRollback).length > 0) {
    throw Object.assign(
      new Error('Live Branding no longer matches this applied revision. Automatic rollback would overwrite a newer edit.'),
      { code: 'ADMIN_REVISION_LIVE_STATE_CONFLICT', statusCode: 409 }
    );
  }

  const rollbackDraft = await ConfigurationRevisionService.createRevision({
    tenantId: args.tenantId,
    resourceType: 'tenantBranding',
    resourceId: args.tenantId,
    payload: target.payload,
    actorId: args.actorId,
    expectedCurrentRevisionId: applied.revisionId,
    idempotencyKey: `rollback:${applied.revisionId}`,
  });
  await ConfigurationRevisionService.validateRevision(
    args.tenantId,
    rollbackDraft.revisionId,
    args.actorId
  );

  const liveTenant = await FirestorePlatformService.getTenantConfig(args.tenantId);
  const updatedAt = new Date().toISOString();
  const fullTenant = {
    ...liveTenant,
    ...target.payload,
    updatedAt,
  } as TenantConfig;
  const db = getFirestoreDb();

  if (!db) {
    if (!isDemoMode() && !isTestMode() && process.env.NODE_ENV !== 'test') {
      throw Object.assign(new Error('Durable Firestore persistence is unavailable.'), {
        code: 'ADMIN_REVISION_STORE_UNAVAILABLE',
        statusCode: 503,
      });
    }
    const tenant = await FirestorePlatformService.updateTenantConfig(args.tenantId, target.payload);
    await ConfigurationRevisionService.publishRevision(
      args.tenantId,
      rollbackDraft.revisionId,
      args.actorId
    );
    return { revisionId: rollbackDraft.revisionId, tenant };
  }

  const tenantRef = db.collection('tenants').doc(args.tenantId);
  await ConfigurationRevisionService.publishRevision(
    args.tenantId,
    rollbackDraft.revisionId,
    args.actorId,
    {
      documentRef: tenantRef,
      data: { ...target.payload, updatedAt },
      merge: true,
    }
  );
  FirestorePlatformService.cacheTenantConfigSnapshot(args.tenantId, fullTenant);
  return { revisionId: rollbackDraft.revisionId, tenant: fullTenant };
}

export class AdminResourceAdapterRegistry {
  static async applyRevision(args: {
    tenantId: string;
    actorId: string;
    actionName: string;
    revisionId: string;
  }): Promise<{ revisionId: string; result: unknown }> {
    if (args.actionName !== 'branding.proposeUpdate') {
      throw Object.assign(new Error('This admin action does not have an executable resource adapter.'), {
        code: 'ADMIN_ACTION_APPLY_NOT_CONNECTED',
        statusCode: 409,
      });
    }
    const applied = await projectBrandingRevision(args);
    return { revisionId: applied.revisionId, result: applied.tenant };
  }

  static async rollbackRevision(args: {
    tenantId: string;
    actorId: string;
    actionName: string;
    revisionId: string;
  }): Promise<{ revisionId: string; result: unknown }> {
    if (args.actionName !== 'branding.proposeUpdate') {
      throw Object.assign(new Error('This admin action does not have a rollback resource adapter.'), {
        code: 'ADMIN_ACTION_ROLLBACK_NOT_CONNECTED',
        statusCode: 409,
      });
    }
    const rolledBack = await rollbackBrandingRevision({
      tenantId: args.tenantId,
      actorId: args.actorId,
      appliedRevisionId: args.revisionId,
    });
    return { revisionId: rolledBack.revisionId, result: rolledBack.tenant };
  }

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
