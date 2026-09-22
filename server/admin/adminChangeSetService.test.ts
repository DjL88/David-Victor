import { beforeEach, describe, expect, it } from 'vitest';
import { AdminChangeSetService } from './adminChangeSetService';

describe('AdminChangeSetService', () => {
  beforeEach(() => AdminChangeSetService.resetForTest());

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
    expect(changeSet.actions[0].risk).toBe('HIGH_WRITE');
    expect(changeSet.reversible).toBe(true);
  });

  it('is idempotent for an identical proposal and rejects key reuse with different input', async () => {
    const args = {
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      actorRole: 'tenantAdmin' as const,
      actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColor: '#112233' } }],
      idempotencyKey: 'branding-1',
    };
    const first = await AdminChangeSetService.createProposedChangeSet(args);
    const second = await AdminChangeSetService.createProposedChangeSet(args);
    expect(second.id).toBe(first.id);

    await expect(
      AdminChangeSetService.createProposedChangeSet({
        ...args,
        actions: [{ actionName: 'branding.proposeUpdate', input: { primaryColor: '#ffffff' } }],
      })
    ).rejects.toMatchObject({ code: 'ADMIN_CHANGESET_IDEMPOTENCY_CONFLICT' });
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
