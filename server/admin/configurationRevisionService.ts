import type { DocumentReference } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { getFirestoreDb } from '../firebase';
import { isDemoMode, isTestMode } from '../runtimeMode';

export type ConfigurationRevisionStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'ROLLED_BACK';

export interface ConfigurationDiffEntry {
  path: string;
  before?: unknown;
  after?: unknown;
}

export interface ConfigurationRevision<TPayload = unknown> {
  revisionId: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  version: number;
  payload: TPayload;
  diff: ConfigurationDiffEntry[];
  status: ConfigurationRevisionStatus;
  changeSetId?: string;
  basedOnRevisionId?: string;
  idempotencyKey?: string;
  requestHash: string;
  createdBy: string;
  createdAt: string;
  validatedAt?: string;
  validatedBy?: string;
  publishedAt?: string;
  publishedBy?: string;
  rollbackOfRevisionId?: string;
}

export interface PublishedConfigurationPointer {
  tenantId: string;
  resourceType: string;
  resourceId: string;
  currentRevisionId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
}

interface CreateRevisionArgs<TPayload> {
  tenantId: string;
  resourceType: string;
  resourceId: string;
  payload: TPayload;
  actorId: string;
  changeSetId?: string;
  idempotencyKey?: string;
  expectedCurrentRevisionId?: string | null;
}

const memoryRevisions = new Map<string, ConfigurationRevision>();
const memoryPointers = new Map<string, PublishedConfigurationPointer>();

function makeError(code: string, message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode });
}

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function resourceKey(tenantId: string, resourceType: string, resourceId: string): string {
  return stableHash({ tenantId, resourceType, resourceId }).slice(0, 32);
}

function revisionMemoryKey(tenantId: string, revisionId: string): string {
  return `${tenantId}:${revisionId}`;
}

function pointerMemoryKey(tenantId: string, resourceType: string, resourceId: string): string {
  return `${tenantId}:${resourceKey(tenantId, resourceType, resourceId)}`;
}

function revisionIdFor(
  tenantId: string,
  resourceType: string,
  resourceId: string,
  idempotencyKey?: string
): string {
  if (idempotencyKey) {
    return `rev_${stableHash({ tenantId, resourceType, resourceId, idempotencyKey }).slice(0, 24)}`;
  }
  return `rev_${crypto.randomUUID()}`;
}

function requireStore() {
  const db = getFirestoreDb();
  if (db) return db;
  if (isDemoMode() || isTestMode() || process.env.NODE_ENV === 'test') return null;
  throw makeError(
    'CONFIG_REVISION_STORE_UNAVAILABLE',
    'Durable configuration revision storage is unavailable.',
    503
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function diffConfiguration(before: unknown, after: unknown, path = '$'): ConfigurationDiffEntry[] {
  if (Object.is(before, after)) return [];

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    return Array.from(keys).flatMap((key) =>
      diffConfiguration(before[key], after[key], path === '$' ? key : `${path}.${key}`)
    );
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const max = Math.max(before.length, after.length);
    const changes: ConfigurationDiffEntry[] = [];
    for (let index = 0; index < max; index += 1) {
      changes.push(...diffConfiguration(before[index], after[index], `${path}[${index}]`));
    }
    return changes;
  }

  return [{ path, before, after }];
}

async function getCurrentInMemoryRevision(
  tenantId: string,
  resourceType: string,
  resourceId: string
): Promise<ConfigurationRevision | null> {
  const pointer = memoryPointers.get(pointerMemoryKey(tenantId, resourceType, resourceId));
  if (!pointer) return null;
  return memoryRevisions.get(revisionMemoryKey(tenantId, pointer.currentRevisionId)) || null;
}

export class ConfigurationRevisionService {
  static async createRevision<TPayload>(args: CreateRevisionArgs<TPayload>): Promise<ConfigurationRevision<TPayload>> {
    if (!args.tenantId || !args.resourceType || !args.resourceId) {
      throw makeError(
        'CONFIG_REVISION_SCOPE_REQUIRED',
        'Tenant, resource type and resource ID are required.',
        400
      );
    }

    const db = requireStore();
    const revisionId = revisionIdFor(
      args.tenantId,
      args.resourceType,
      args.resourceId,
      args.idempotencyKey
    );

    if (!db) {
      const existing = memoryRevisions.get(revisionMemoryKey(args.tenantId, revisionId));
      const current = await getCurrentInMemoryRevision(args.tenantId, args.resourceType, args.resourceId);
      const currentId = current?.revisionId || null;
      if (args.expectedCurrentRevisionId !== undefined && args.expectedCurrentRevisionId !== currentId) {
        throw makeError(
          'CONFIG_REVISION_CONFLICT',
          'Published configuration changed since this edit began.',
          409
        );
      }
      const requestHash = stableHash({
        tenantId: args.tenantId,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        payload: args.payload,
        changeSetId: args.changeSetId,
        basedOnRevisionId: currentId,
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw makeError(
            'CONFIG_REVISION_IDEMPOTENCY_CONFLICT',
            'This idempotency key has already been used for different revision content.',
            409
          );
        }
        return existing as ConfigurationRevision<TPayload>;
      }

      const revision: ConfigurationRevision<TPayload> = {
        revisionId,
        tenantId: args.tenantId,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        version: (current?.version || 0) + 1,
        payload: args.payload,
        diff: diffConfiguration(current?.payload, args.payload),
        status: 'DRAFT',
        changeSetId: args.changeSetId,
        basedOnRevisionId: currentId || undefined,
        idempotencyKey: args.idempotencyKey,
        requestHash,
        createdBy: args.actorId,
        createdAt: new Date().toISOString(),
      };
      memoryRevisions.set(revisionMemoryKey(args.tenantId, revisionId), revision);
      return revision;
    }

    const pointerId = resourceKey(args.tenantId, args.resourceType, args.resourceId);
    const pointerRef = db
      .collection('tenants')
      .doc(args.tenantId)
      .collection('configurationPointers')
      .doc(pointerId);
    const revisionRef = db
      .collection('tenants')
      .doc(args.tenantId)
      .collection('configurationRevisions')
      .doc(revisionId);

    return db.runTransaction(async (transaction) => {
      const [pointerSnap, existingSnap] = await Promise.all([
        transaction.get(pointerRef),
        transaction.get(revisionRef),
      ]);
      const pointer = pointerSnap.exists ? (pointerSnap.data() as PublishedConfigurationPointer) : null;
      const currentId = pointer?.currentRevisionId || null;

      if (args.expectedCurrentRevisionId !== undefined && args.expectedCurrentRevisionId !== currentId) {
        throw makeError(
          'CONFIG_REVISION_CONFLICT',
          'Published configuration changed since this edit began.',
          409
        );
      }

      const currentSnap = currentId
        ? await transaction.get(
            db.collection('tenants').doc(args.tenantId).collection('configurationRevisions').doc(currentId)
          )
        : null;
      const current = currentSnap?.exists ? (currentSnap.data() as ConfigurationRevision) : null;
      const requestHash = stableHash({
        tenantId: args.tenantId,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        payload: args.payload,
        changeSetId: args.changeSetId,
        basedOnRevisionId: currentId,
      });

      if (existingSnap.exists) {
        const existing = existingSnap.data() as ConfigurationRevision<TPayload>;
        if (existing.requestHash !== requestHash) {
          throw makeError(
            'CONFIG_REVISION_IDEMPOTENCY_CONFLICT',
            'This idempotency key has already been used for different revision content.',
            409
          );
        }
        return existing;
      }

      const revision: ConfigurationRevision<TPayload> = {
        revisionId,
        tenantId: args.tenantId,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        version: (pointer?.version || 0) + 1,
        payload: args.payload,
        diff: diffConfiguration(current?.payload, args.payload),
        status: 'DRAFT',
        changeSetId: args.changeSetId,
        basedOnRevisionId: currentId || undefined,
        idempotencyKey: args.idempotencyKey,
        requestHash,
        createdBy: args.actorId,
        createdAt: new Date().toISOString(),
      };
      transaction.create(revisionRef, revision);
      return revision;
    });
  }

  static async getRevision<TPayload = unknown>(
    tenantId: string,
    revisionId: string
  ): Promise<ConfigurationRevision<TPayload>> {
    const db = requireStore();
    if (!db) {
      const revision = memoryRevisions.get(revisionMemoryKey(tenantId, revisionId));
      if (!revision) throw makeError('CONFIG_REVISION_NOT_FOUND', 'Configuration revision not found.', 404);
      return revision as ConfigurationRevision<TPayload>;
    }
    const snap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('configurationRevisions')
      .doc(revisionId)
      .get();
    if (!snap.exists) throw makeError('CONFIG_REVISION_NOT_FOUND', 'Configuration revision not found.', 404);
    return snap.data() as ConfigurationRevision<TPayload>;
  }

  static async validateRevision(
    tenantId: string,
    revisionId: string,
    actorId: string
  ): Promise<ConfigurationRevision> {
    const db = requireStore();
    const now = new Date().toISOString();

    if (!db) {
      const key = revisionMemoryKey(tenantId, revisionId);
      const current = memoryRevisions.get(key);
      if (!current) throw makeError('CONFIG_REVISION_NOT_FOUND', 'Configuration revision not found.', 404);
      if (current.status === 'VALIDATED') return current;
      if (current.status !== 'DRAFT') {
        throw makeError('CONFIG_REVISION_INVALID_STATE', `Cannot validate revision from ${current.status}.`, 409);
      }
      const updated = { ...current, status: 'VALIDATED' as const, validatedAt: now, validatedBy: actorId };
      memoryRevisions.set(key, updated);
      return updated;
    }

    const ref = db.collection('tenants').doc(tenantId).collection('configurationRevisions').doc(revisionId);
    return db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw makeError('CONFIG_REVISION_NOT_FOUND', 'Configuration revision not found.', 404);
      const current = snap.data() as ConfigurationRevision;
      if (current.status === 'VALIDATED') return current;
      if (current.status !== 'DRAFT') {
        throw makeError('CONFIG_REVISION_INVALID_STATE', `Cannot validate revision from ${current.status}.`, 409);
      }
      const updated = { ...current, status: 'VALIDATED' as const, validatedAt: now, validatedBy: actorId };
      transaction.set(ref, updated);
      return updated;
    });
  }

  static async publishRevision(
    tenantId: string,
    revisionId: string,
    actorId: string,
    projection?: {
      documentRef: DocumentReference;
      data: Record<string, unknown>;
      merge?: boolean;
    }
  ): Promise<{ revision: ConfigurationRevision; pointer: PublishedConfigurationPointer }> {
    const db = requireStore();

    if (!db) {
      const key = revisionMemoryKey(tenantId, revisionId);
      const revision = memoryRevisions.get(key);
      if (!revision) throw makeError('CONFIG_REVISION_NOT_FOUND', 'Configuration revision not found.', 404);
      if (revision.status !== 'VALIDATED') {
        throw makeError('CONFIG_REVISION_NOT_VALIDATED', 'Only validated revisions may be published.', 409);
      }
      const pointerKey = pointerMemoryKey(tenantId, revision.resourceType, revision.resourceId);
      const currentPointer = memoryPointers.get(pointerKey);
      const currentId = currentPointer?.currentRevisionId || null;
      if ((revision.basedOnRevisionId || null) !== currentId) {
        throw makeError('CONFIG_REVISION_CONFLICT', 'Published configuration changed before publish.', 409);
      }
      if (currentId) {
        const previousKey = revisionMemoryKey(tenantId, currentId);
        const previous = memoryRevisions.get(previousKey);
        if (previous) memoryRevisions.set(previousKey, { ...previous, status: 'SUPERSEDED' });
      }
      const now = new Date().toISOString();
      const published = {
        ...revision,
        status: 'PUBLISHED' as const,
        publishedAt: now,
        publishedBy: actorId,
      };
      const pointer: PublishedConfigurationPointer = {
        tenantId,
        resourceType: revision.resourceType,
        resourceId: revision.resourceId,
        currentRevisionId: revision.revisionId,
        version: revision.version,
        updatedAt: now,
        updatedBy: actorId,
      };
      memoryRevisions.set(key, published);
      memoryPointers.set(pointerKey, pointer);
      return { revision: published, pointer };
    }

    const revisionRef = db.collection('tenants').doc(tenantId).collection('configurationRevisions').doc(revisionId);

    return db.runTransaction(async (transaction) => {
      const revisionSnap = await transaction.get(revisionRef);
      if (!revisionSnap.exists) throw makeError('CONFIG_REVISION_NOT_FOUND', 'Configuration revision not found.', 404);
      const revision = revisionSnap.data() as ConfigurationRevision;
      if (revision.status !== 'VALIDATED') {
        throw makeError('CONFIG_REVISION_NOT_VALIDATED', 'Only validated revisions may be published.', 409);
      }

      const pointerId = resourceKey(tenantId, revision.resourceType, revision.resourceId);
      const pointerRef = db.collection('tenants').doc(tenantId).collection('configurationPointers').doc(pointerId);
      const pointerSnap = await transaction.get(pointerRef);
      const currentPointer = pointerSnap.exists ? (pointerSnap.data() as PublishedConfigurationPointer) : null;
      const currentId = currentPointer?.currentRevisionId || null;
      if ((revision.basedOnRevisionId || null) !== currentId) {
        throw makeError('CONFIG_REVISION_CONFLICT', 'Published configuration changed before publish.', 409);
      }

      const now = new Date().toISOString();
      if (currentId) {
        const previousRef = db.collection('tenants').doc(tenantId).collection('configurationRevisions').doc(currentId);
        const previousSnap = await transaction.get(previousRef);
        if (previousSnap.exists) {
          transaction.set(previousRef, {
            ...(previousSnap.data() as ConfigurationRevision),
            status: 'SUPERSEDED',
          });
        }
      }

      const published: ConfigurationRevision = {
        ...revision,
        status: 'PUBLISHED',
        publishedAt: now,
        publishedBy: actorId,
      };
      const pointer: PublishedConfigurationPointer = {
        tenantId,
        resourceType: revision.resourceType,
        resourceId: revision.resourceId,
        currentRevisionId: revision.revisionId,
        version: revision.version,
        updatedAt: now,
        updatedBy: actorId,
      };
      transaction.set(revisionRef, published);
      transaction.set(pointerRef, pointer);
      if (projection) {
        if (projection.merge === false) {
          transaction.set(projection.documentRef, projection.data);
        } else {
          transaction.set(projection.documentRef, projection.data, { merge: true });
        }
      }
      return { revision: published, pointer };
    });
  }

  static async resolvePublishedConfiguration<TPayload = unknown>(
    tenantId: string,
    resourceType: string,
    resourceId: string
  ): Promise<{ pointer: PublishedConfigurationPointer; revision: ConfigurationRevision<TPayload> } | null> {
    const db = requireStore();
    if (!db) {
      const pointer = memoryPointers.get(pointerMemoryKey(tenantId, resourceType, resourceId));
      if (!pointer) return null;
      const revision = memoryRevisions.get(revisionMemoryKey(tenantId, pointer.currentRevisionId));
      if (!revision) return null;
      return { pointer, revision: revision as ConfigurationRevision<TPayload> };
    }

    const pointerId = resourceKey(tenantId, resourceType, resourceId);
    const pointerSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('configurationPointers')
      .doc(pointerId)
      .get();
    if (!pointerSnap.exists) return null;
    const pointer = pointerSnap.data() as PublishedConfigurationPointer;
    const revision = await this.getRevision<TPayload>(tenantId, pointer.currentRevisionId);
    return { pointer, revision };
  }

  static async rollbackToRevision(
    tenantId: string,
    targetRevisionId: string,
    actorId: string,
    idempotencyKey?: string
  ): Promise<{ revision: ConfigurationRevision; pointer: PublishedConfigurationPointer }> {
    const target = await this.getRevision(tenantId, targetRevisionId);
    const resolved = await this.resolvePublishedConfiguration(
      tenantId,
      target.resourceType,
      target.resourceId
    );
    if (!resolved) {
      throw makeError('CONFIG_REVISION_NO_PUBLISHED_STATE', 'There is no published revision to roll back.', 409);
    }

    const rollbackDraft = await this.createRevision({
      tenantId,
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      payload: target.payload,
      actorId,
      expectedCurrentRevisionId: resolved.pointer.currentRevisionId,
      idempotencyKey: idempotencyKey || `rollback:${targetRevisionId}:${resolved.pointer.currentRevisionId}`,
    });
    const validated = await this.validateRevision(tenantId, rollbackDraft.revisionId, actorId);

    const db = requireStore();
    if (!db) {
      const key = revisionMemoryKey(tenantId, validated.revisionId);
      memoryRevisions.set(key, { ...validated, rollbackOfRevisionId: targetRevisionId });
    } else {
      await db
        .collection('tenants')
        .doc(tenantId)
        .collection('configurationRevisions')
        .doc(validated.revisionId)
        .set({ rollbackOfRevisionId: targetRevisionId }, { merge: true });
    }

    return this.publishRevision(tenantId, validated.revisionId, actorId);
  }

  static resetForTest(): void {
    memoryRevisions.clear();
    memoryPointers.clear();
  }
}
