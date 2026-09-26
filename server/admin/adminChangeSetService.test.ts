import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_CHANGESET_APPROVAL_TTL_MS, AdminChangeSetService } from './adminChangeSetService';

describe('AdminChangeSetService', () => {
  beforeEach(() => AdminChangeSetService.resetForTest());
  afterEach(() => vi.useRealTimers());

  it('creates a validated proposal but never enables execution', async () => {
    const changeSet = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
      prompt: 'Change the delivery fee',
      actions: [{ actionName: 'fees.proposeUpdate', input: { serviceFeeAmount: 249 } }],
      idempotencyKey: 'same-request',
    });

    expect(changeSet.status).toBe('APPROVAL_REQUIRED');
    expect(changeSet.autonomousExecutionEnabled).toBe(false);
    expect(changeSet.independentApprovalRequired).toBe(true);
    expect(changeSet.actions[0].risk).toBe('HIGH_WRITE');
    expect(changeSet.reversible).toBe(true);
  });

  it('is idempotent for an identical proposal and rejects key reuse with different input', async () => {
    const args = {
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin' as const,
      actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColour: '#112233' } }],
      idempotencyKey: 'branding-1',
    };
    const first = await AdminChangeSetService.createProposedChangeSet(args);
    const second = await AdminChangeSetService.createProposedChangeSet(args);
    expect(second.id).toBe(first.id);

    await expect(
      AdminChangeSetService.createProposedChangeSet({
        ...args,
        actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColour: '#ffffff' } }],
      })
    ).rejects.toMatchObject({ code: 'ADMIN_CHANGESET_IDEMPOTENCY_CONFLICT' });
  });

  it('requires a second administrator for high-risk assistant approval', async () => {
    const changeSet = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'admin-creator',
      actorRole: 'tenantAdmin',
      actions: [{ actionName: 'fees.proposeUpdate', input: { serviceFeeAmount: 249 } }],
    });

    await expect(
      AdminChangeSetService.approveChangeSet({
        tenantId: 'tenant-a',
        changeSetId: changeSet.id,
        actorId: 'admin-creator',
        actorRole: 'tenantAdmin',
      })
    ).rejects.toMatchObject({
      code: 'ADMIN_CHANGESET_SECOND_APPROVER_REQUIRED',
      statusCode: 403,
    });

    const approved = await AdminChangeSetService.approveChangeSet({
      tenantId: 'tenant-a',
      changeSetId: changeSet.id,
      actorId: 'admin-reviewer',
      actorRole: 'tenantAdmin',
    });

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('admin-reviewer');
  });

  it('still permits same-admin approval for low-risk reviewable changes', async () => {
    const changeSet = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'marketing-1',
      actorRole: 'marketingEditor',
      actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColour: '#123456' } }],
    });

    const approved = await AdminChangeSetService.approveChangeSet({
      tenantId: 'tenant-a',
      changeSetId: changeSet.id,
      actorId: 'marketing-1',
      actorRole: 'marketingEditor',
    });

    expect(changeSet.independentApprovalRequired).toBe(false);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('marketing-1');
  });

  it('requires a high-risk approval capability for fee/rule proposals', async () => {
    const changeSet = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
      actions: [{ actionName: 'rules.proposeUpdate', input: { enabled: true } }],
    });

    await expect(
      AdminChangeSetService.approveChangeSet({
        tenantId: 'tenant-a',
        changeSetId: changeSet.id,
        actorId: 'ops-1',
        actorRole: 'operationsEditor',
      })
    ).rejects.toMatchObject({ code: 'ADMIN_CHANGESET_APPROVAL_FORBIDDEN' });

    const approved = await AdminChangeSetService.approveChangeSet({
      tenantId: 'tenant-a',
      changeSetId: changeSet.id,
      actorId: 'admin-2',
      actorRole: 'tenantAdmin',
    });
    expect(approved.status).toBe('APPROVED');
    expect(approved.autonomousExecutionEnabled).toBe(false);
  });

  it('tracks approved apply and rollback transitions explicitly', async () => {
    const proposed = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
      actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColour: '#123456' } }],
      revisionIds: ['rev-1'],
    });
    expect(proposed.applyAvailable).toBe(true);

    const approved = await AdminChangeSetService.approveChangeSet({
      tenantId: 'tenant-a',
      changeSetId: proposed.id,
      actorId: 'admin-2',
      actorRole: 'tenantAdmin',
    });
    const applying = await AdminChangeSetService.transitionChangeSet({
      tenantId: 'tenant-a',
      changeSetId: approved.id,
      actorId: 'admin-2',
      status: 'APPLYING',
    });
    expect(applying.status).toBe('APPLYING');

    const applied = await AdminChangeSetService.transitionChangeSet({
      tenantId: 'tenant-a',
      changeSetId: approved.id,
      actorId: 'admin-2',
      status: 'APPLIED',
      afterSnapshot: { primaryColour: '#123456' },
    });
    expect(applied.status).toBe('APPLIED');
    expect(applied.appliedAt).toBeTruthy();

    const rolledBack = await AdminChangeSetService.transitionChangeSet({
      tenantId: 'tenant-a',
      changeSetId: approved.id,
      actorId: 'admin-2',
      status: 'ROLLED_BACK',
      rollbackRevisionIds: ['rev-rollback'],
    });
    expect(rolledBack.status).toBe('ROLLED_BACK');
    expect(rolledBack.rollbackRevisionIds).toEqual(['rev-rollback']);
  });

  it('keeps a change set tenant-bound and rejects stale-tenant reuse', async () => {
    const changeSet = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
      actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColour: '#123456' } }],
      revisionIds: ['rev-a'],
    });

    await expect(
      AdminChangeSetService.getChangeSet('tenant-b', changeSet.id)
    ).rejects.toMatchObject({ code: 'ADMIN_CHANGESET_NOT_FOUND' });

    await expect(
      AdminChangeSetService.approveChangeSet({
        tenantId: 'tenant-b',
        changeSetId: changeSet.id,
        actorId: 'admin-1',
        actorRole: 'tenantAdmin',
      })
    ).rejects.toMatchObject({ code: 'ADMIN_CHANGESET_NOT_FOUND' });
  });

  it('expires scoped approvals before apply', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T15:00:00.000Z'));
    const proposed = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
      actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColour: '#123456' } }],
      revisionIds: ['rev-1'],
    });
    const approved = await AdminChangeSetService.approveChangeSet({
      tenantId: 'tenant-a',
      changeSetId: proposed.id,
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
    });

    expect(approved.approvalScopeHash).toBeTruthy();
    expect(approved.approvalExpiresAt).toBe(
      new Date(Date.now() + ADMIN_CHANGESET_APPROVAL_TTL_MS).toISOString()
    );

    vi.advanceTimersByTime(ADMIN_CHANGESET_APPROVAL_TTL_MS + 1);
    await expect(
      AdminChangeSetService.transitionChangeSet({
        tenantId: 'tenant-a',
        changeSetId: proposed.id,
        actorId: 'admin-1',
        status: 'APPLYING',
      })
    ).rejects.toMatchObject({ code: 'ADMIN_CHANGESET_APPROVAL_EXPIRED' });
  });

  it('does not refresh an approval when the approval request is replayed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-26T15:00:00.000Z'));
    const proposed = await AdminChangeSetService.createProposedChangeSet({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
      actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColour: '#123456' } }],
      revisionIds: ['rev-1'],
    });
    const first = await AdminChangeSetService.approveChangeSet({
      tenantId: 'tenant-a',
      changeSetId: proposed.id,
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
    });
    vi.advanceTimersByTime(30_000);
    const replay = await AdminChangeSetService.approveChangeSet({
      tenantId: 'tenant-a',
      changeSetId: proposed.id,
      actorId: 'admin-1',
      actorRole: 'tenantAdmin',
    });

    expect(replay.approvedAt).toBe(first.approvedAt);
    expect(replay.approvalExpiresAt).toBe(first.approvalExpiresAt);

    const applying = await AdminChangeSetService.transitionChangeSet({
      tenantId: 'tenant-a',
      changeSetId: proposed.id,
      actorId: 'admin-1',
      status: 'APPLYING',
    });
    expect(applying.approvalConsumedAt).toBeTruthy();
    expect(applying.approvalConsumedBy).toBe('admin-1');
  });

  it('rejects unsupported action names instead of inventing a write path', async () => {
    await expect(
      AdminChangeSetService.createProposedChangeSet({
        tenantId: 'tenant-a',
        actorId: 'admin-1',
        actorRole: 'tenantAdmin',
        actions: [{ actionName: 'integrations.rotateSecret', input: {} }],
      })
    ).rejects.toMatchObject({ code: 'ADMIN_ACTION_UNKNOWN' });
  });

  it('does not allow read actions to be wrapped as write proposals', async () => {
    await expect(
      AdminChangeSetService.createProposedChangeSet({
        tenantId: 'tenant-a',
        actorId: 'admin-1',
        actorRole: 'tenantAdmin',
        actions: [{ actionName: 'catalog.inspect', input: {} }],
      })
    ).rejects.toMatchObject({ code: 'ADMIN_ACTION_NOT_PROPOSABLE' });
  });
});
