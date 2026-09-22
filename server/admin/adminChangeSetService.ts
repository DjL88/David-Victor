import crypto from 'crypto';
import type { AdminRole } from '../../src/commerce/models';
import { getFirestoreDb } from '../firebase';
import { isDemoMode, isTestMode } from '../runtimeMode';
import {
  getAdminActionDefinition,
  hasServerAdminCapability,
  validateAdminActionInput,
  type AdminActionRisk,
  type ServerAdminCapability,
} from './adminActionRegistry';

export type AdminChangeSetStatus =
  | 'PROPOSED'
  | 'VALIDATED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVED'
  | 'APPLYING'
  | 'APPLIED'
  | 'PARTIALLY_FAILED'
  | 'FAILED'
  | 'ROLLED_BACK';

export interface AdminChangeSetAction {
  actionName: string;
  input: Record<string, unknown>;
  risk: AdminActionRisk;
  capability: ServerAdminCapability;
  supportsUndo: boolean;
}

export interface AdminAffectedResource {
  type: string;
  id: string;
  label?: string;
}

export interface AssistantChangeSet {
  id: string;
  tenantId: string;
  requestedBy: string;
  requestedByRole: AdminRole;
  requestedThrough: 'ASSISTANT' | 'ADMIN_UI' | 'SYSTEM';
  prompt?: string;
  actions: AdminChangeSetAction[];
  status: AdminChangeSetStatus;
  affectedResources: AdminAffectedResource[];
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  diff?: unknown;
  warnings: string[];
  idempotencyKey?: string;
  requestHash: string;
  createdAt: string;
  updatedAt: string;
  validatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  reversible: boolean;
  executionEnabled: false;
}

export interface AuditEventV2 {
  eventId: string;
  tenantId: string;
  actor: {
    userId: string;
    actorType: 'HUMAN' | 'ASSISTANT' | 'SYSTEM';
  };
  action: string;
  resourceType: string;
  resourceIds: string[];
  changeSetId?: string;
  before?: unknown;
  after?: unknown;
  diff?: unknown;
  approval?: {
    required: boolean;
    approvedBy?: string;
    approvedAt?: string;
  };
  assistant?: {
    conversationId?: string;
    toolName?: string;
    modelProvider?: string;
  };
  result: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK';
  reversible: boolean;
  createdAt: string;
}

interface CreateChangeSetArgs {
  tenantId: string;
  actorId: string;
  actorRole: AdminRole;
  prompt?: string;
  actions: Array<{ actionName: string; input?: Record<string, unknown> }>;
  affectedResources?: AdminAffectedResource[];
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  diff?: unknown;
  warnings?: string[];
  idempotencyKey?: string;
  conversationId?: string;
}

interface ApproveChangeSetArgs {
  tenantId: string;
  changeSetId: string;
  actorId: string;
  actorRole: AdminRole;
}

const inMemoryChangeSets = new Map<string, AssistantChangeSet>();
const inMemoryAuditEvents = new Map<string, AuditEventV2[]>();

function error(code: string, message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { code, statusCode });
}

function collectionKey(tenantId: string, changeSetId: string): string {
  return `${tenantId}:${changeSetId}`;
}

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function changeSetIdFor(tenantId: string, idempotencyKey?: string): string {
  if (idempotencyKey) {
    return `cs_${stableHash({ tenantId, idempotencyKey }).slice(0, 24)}`;
  }
  return `cs_${crypto.randomUUID()}`;
}

function requireDurableStore() {
  const db = getFirestoreDb();
  if (db) return db;
  if (isDemoMode() || isTestMode() || process.env.NODE_ENV === 'test') return null;
  throw error(
    'ADMIN_CHANGESET_STORE_UNAVAILABLE',
    'Durable change-set storage is unavailable. Proposed writes are rejected outside demo/test mode.',
    503
  );
}

function auditEventForCreated(changeSet: AssistantChangeSet, conversationId?: string): AuditEventV2 {
  return {
    eventId: `aev_${crypto.randomUUID()}`,
    tenantId: changeSet.tenantId,
    actor: { userId: changeSet.requestedBy, actorType: 'ASSISTANT' },
    action: 'assistant.changeSet.proposed',
    resourceType: 'adminChangeSet',
    resourceIds: changeSet.affectedResources.map((resource) => resource.id),
    changeSetId: changeSet.id,
    before: changeSet.beforeSnapshot,
    after: changeSet.afterSnapshot,
    diff: changeSet.diff,
    approval: { required: true },
    assistant: conversationId ? { conversationId } : undefined,
    result: 'SUCCESS',
    reversible: changeSet.reversible,
    createdAt: changeSet.createdAt,
  };
}

function auditEventForApproved(changeSet: AssistantChangeSet, actorId: string): AuditEventV2 {
  return {
    eventId: `aev_${crypto.randomUUID()}`,
    tenantId: changeSet.tenantId,
    actor: { userId: actorId, actorType: 'HUMAN' },
    action: 'assistant.changeSet.approved',
    resourceType: 'adminChangeSet',
    resourceIds: changeSet.affectedResources.map((resource) => resource.id),
    changeSetId: changeSet.id,
    approval: {
      required: true,
      approvedBy: changeSet.approvedBy,
      approvedAt: changeSet.approvedAt,
    },
    result: 'SUCCESS',
    reversible: changeSet.reversible,
    createdAt: changeSet.approvedAt || new Date().toISOString(),
  };
}

function requiredApprovalCapability(changeSet: AssistantChangeSet): ServerAdminCapability {
  const highRisk = changeSet.actions.some(
    (action) => action.risk === 'HIGH_WRITE' || action.risk === 'RESTRICTED'
  );
  return highRisk ? 'assistant.approveHighRisk' : 'assistant.executeLowRisk';
}

export class AdminChangeSetService {
  static async createProposedChangeSet(args: CreateChangeSetArgs): Promise<AssistantChangeSet> {
    if (!args.tenantId) {
      throw error('ADMIN_CHANGESET_TENANT_REQUIRED', 'Tenant context is required.', 400);
    }
    if (!args.actions.length) {
      throw error('ADMIN_CHANGESET_ACTION_REQUIRED', 'At least one proposed action is required.', 400);
    }
    if (!hasServerAdminCapability(args.actorRole, 'assistant.use')) {
      throw error('ADMIN_CHANGESET_FORBIDDEN', 'This role cannot use the Admin Assistant.', 403);
    }

    const actions: AdminChangeSetAction[] = args.actions.map((candidate) => {
      const definition = getAdminActionDefinition(candidate.actionName);
      if (!definition) {
        throw error('ADMIN_ACTION_UNKNOWN', `Unknown admin action: ${candidate.actionName}`, 404);
      }
      if (definition.risk === 'READ' || !definition.supportsPreview) {
        throw error(
          'ADMIN_ACTION_NOT_PROPOSABLE',
          `${definition.name} is not a previewable write action.`,
          400
        );
      }
      if (!hasServerAdminCapability(args.actorRole, definition.capability)) {
        throw error(
          'ADMIN_ACTION_FORBIDDEN',
          `Your role does not have permission to propose ${definition.name}.`,
          403
        );
      }

      return {
        actionName: definition.name,
        input: validateAdminActionInput(definition, candidate.input),
        risk: definition.risk,
        capability: definition.capability,
        supportsUndo: definition.supportsUndo,
      };
    });

    const now = new Date().toISOString();
    const normalizedPrompt = args.prompt?.trim().slice(0, 8000) || undefined;
    const id = changeSetIdFor(args.tenantId, args.idempotencyKey);
    const requestHash = stableHash({
      tenantId: args.tenantId,
      actorId: args.actorId,
      prompt: normalizedPrompt,
      actions,
      affectedResources: args.affectedResources || [],
      beforeSnapshot: args.beforeSnapshot,
      afterSnapshot: args.afterSnapshot,
      diff: args.diff,
    });

    const changeSet: AssistantChangeSet = {
      id,
      tenantId: args.tenantId,
      requestedBy: args.actorId,
      requestedByRole: args.actorRole,
      requestedThrough: 'ASSISTANT',
      prompt: normalizedPrompt,
      actions,
      status: 'APPROVAL_REQUIRED',
      affectedResources: args.affectedResources || [],
      beforeSnapshot: args.beforeSnapshot,
      afterSnapshot: args.afterSnapshot,
      diff: args.diff,
      warnings: args.warnings || [],
      idempotencyKey: args.idempotencyKey,
      requestHash,
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
      reversible: actions.every((action) => action.supportsUndo),
      executionEnabled: false,
    };

    const db = requireDurableStore();
    const auditEvent = auditEventForCreated(changeSet, args.conversationId);

    if (!db) {
      const key = collectionKey(args.tenantId, id);
      const existing = inMemoryChangeSets.get(key);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw error(
            'ADMIN_CHANGESET_IDEMPOTENCY_CONFLICT',
            'This idempotency key has already been used for a different proposal.',
            409
          );
        }
        return existing;
      }
      inMemoryChangeSets.set(key, changeSet);
      const audit = inMemoryAuditEvents.get(args.tenantId) || [];
      audit.unshift(auditEvent);
      inMemoryAuditEvents.set(args.tenantId, audit);
      return changeSet;
    }

    const changeSetRef = db
      .collection('tenants')
      .doc(args.tenantId)
      .collection('assistantChangeSets')
      .doc(id);
    const auditRef = db
      .collection('tenants')
      .doc(args.tenantId)
      .collection('auditEventsV2')
      .doc(auditEvent.eventId);

    return db.runTransaction(async (transaction) => {
      const existingSnap = await transaction.get(changeSetRef);
      if (existingSnap.exists) {
        const existing = existingSnap.data() as AssistantChangeSet;
        if (existing.requestHash !== requestHash) {
          throw error(
            'ADMIN_CHANGESET_IDEMPOTENCY_CONFLICT',
            'This idempotency key has already been used for a different proposal.',
            409
          );
        }
        return existing;
      }
      transaction.create(changeSetRef, changeSet);
      transaction.create(auditRef, auditEvent);
      return changeSet;
    });
  }

  static async getChangeSet(tenantId: string, changeSetId: string): Promise<AssistantChangeSet> {
    const db = requireDurableStore();
    if (!db) {
      const found = inMemoryChangeSets.get(collectionKey(tenantId, changeSetId));
      if (!found) throw error('ADMIN_CHANGESET_NOT_FOUND', 'Change set not found.', 404);
      return found;
    }

    const snap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('assistantChangeSets')
      .doc(changeSetId)
      .get();
    if (!snap.exists) throw error('ADMIN_CHANGESET_NOT_FOUND', 'Change set not found.', 404);
    return snap.data() as AssistantChangeSet;
  }

  static async approveChangeSet(args: ApproveChangeSetArgs): Promise<AssistantChangeSet> {
    const db = requireDurableStore();

    if (!db) {
      const key = collectionKey(args.tenantId, args.changeSetId);
      const current = inMemoryChangeSets.get(key);
      if (!current) throw error('ADMIN_CHANGESET_NOT_FOUND', 'Change set not found.', 404);
      if (!hasServerAdminCapability(args.actorRole, requiredApprovalCapability(current))) {
        throw error('ADMIN_CHANGESET_APPROVAL_FORBIDDEN', 'Your role cannot approve this change set.', 403);
      }
      if (current.status === 'APPROVED') return current;
      if (current.status !== 'APPROVAL_REQUIRED') {
        throw error(
          'ADMIN_CHANGESET_INVALID_STATE',
          `Change set cannot be approved from state ${current.status}.`,
          409
        );
      }
      const approved: AssistantChangeSet = {
        ...current,
        status: 'APPROVED',
        approvedAt: new Date().toISOString(),
        approvedBy: args.actorId,
        updatedAt: new Date().toISOString(),
      };
      inMemoryChangeSets.set(key, approved);
      const audit = inMemoryAuditEvents.get(args.tenantId) || [];
      audit.unshift(auditEventForApproved(approved, args.actorId));
      inMemoryAuditEvents.set(args.tenantId, audit);
      return approved;
    }

    const ref = db
      .collection('tenants')
      .doc(args.tenantId)
      .collection('assistantChangeSets')
      .doc(args.changeSetId);

    return db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw error('ADMIN_CHANGESET_NOT_FOUND', 'Change set not found.', 404);
      const current = snap.data() as AssistantChangeSet;
      if (!hasServerAdminCapability(args.actorRole, requiredApprovalCapability(current))) {
        throw error('ADMIN_CHANGESET_APPROVAL_FORBIDDEN', 'Your role cannot approve this change set.', 403);
      }
      if (current.status === 'APPROVED') return current;
      if (current.status !== 'APPROVAL_REQUIRED') {
        throw error(
          'ADMIN_CHANGESET_INVALID_STATE',
          `Change set cannot be approved from state ${current.status}.`,
          409
        );
      }

      const now = new Date().toISOString();
      const approved: AssistantChangeSet = {
        ...current,
        status: 'APPROVED',
        approvedAt: now,
        approvedBy: args.actorId,
        updatedAt: now,
      };
      const event = auditEventForApproved(approved, args.actorId);
      const auditRef = db
        .collection('tenants')
        .doc(args.tenantId)
        .collection('auditEventsV2')
        .doc(event.eventId);

      transaction.set(ref, approved);
      transaction.create(auditRef, event);
      return approved;
    });
  }

  static resetForTest(): void {
    inMemoryChangeSets.clear();
    inMemoryAuditEvents.clear();
  }
}
