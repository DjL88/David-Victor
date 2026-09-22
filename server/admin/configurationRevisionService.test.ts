import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigurationRevisionService, diffConfiguration } from './configurationRevisionService';

describe('ConfigurationRevisionService', () => {
  beforeEach(() => ConfigurationRevisionService.resetForTest());

  it('creates, validates and publishes immutable revisions with a useful diff', async () => {
    const first = await ConfigurationRevisionService.createRevision({
      tenantId: 'tenant-a',
      resourceType: 'feePolicy',
      resourceId: 'default',
      payload: { deliveryFee: 199, nested: { enabled: true } },
      actorId: 'admin-1',
      expectedCurrentRevisionId: null,
    });
    expect(first.status).toBe('DRAFT');
    expect(first.diff.length).toBeGreaterThan(0);

    await ConfigurationRevisionService.validateRevision('tenant-a', first.revisionId, 'admin-1');
    const published = await ConfigurationRevisionService.publishRevision('tenant-a', first.revisionId, 'admin-1');
    expect(published.pointer.currentRevisionId).toBe(first.revisionId);

    const second = await ConfigurationRevisionService.createRevision({
      tenantId: 'tenant-a',
      resourceType: 'feePolicy',
      resourceId: 'default',
      payload: { deliveryFee: 249, nested: { enabled: true } },
      actorId: 'admin-1',
      expectedCurrentRevisionId: first.revisionId,
    });
    expect(second.diff).toEqual([{ path: 'deliveryFee', before: 199, after: 249 }]);
  });

  it('rejects stale writers using optimistic concurrency', async () => {
    const first = await ConfigurationRevisionService.createRevision({
      tenantId: 'tenant-a',
      resourceType: 'branding',
      resourceId: 'default',
      payload: { primaryColor: '#000000' },
      actorId: 'admin-1',
      expectedCurrentRevisionId: null,
    });
    await ConfigurationRevisionService.validateRevision('tenant-a', first.revisionId, 'admin-1');
    await ConfigurationRevisionService.publishRevision('tenant-a', first.revisionId, 'admin-1');

    await expect(
      ConfigurationRevisionService.createRevision({
        tenantId: 'tenant-a',
        resourceType: 'branding',
        resourceId: 'default',
        payload: { primaryColor: '#ffffff' },
        actorId: 'admin-2',
        expectedCurrentRevisionId: null,
      })
    ).rejects.toMatchObject({ code: 'CONFIG_REVISION_CONFLICT' });
  });

  it('rolls back by publishing a new revision rather than moving history backwards', async () => {
    const first = await ConfigurationRevisionService.createRevision({
      tenantId: 'tenant-a',
      resourceType: 'branding',
      resourceId: 'default',
      payload: { primaryColor: '#111111' },
      actorId: 'admin-1',
    });
    await ConfigurationRevisionService.validateRevision('tenant-a', first.revisionId, 'admin-1');
    await ConfigurationRevisionService.publishRevision('tenant-a', first.revisionId, 'admin-1');

    const second = await ConfigurationRevisionService.createRevision({
      tenantId: 'tenant-a',
      resourceType: 'branding',
      resourceId: 'default',
      payload: { primaryColor: '#222222' },
      actorId: 'admin-1',
      expectedCurrentRevisionId: first.revisionId,
    });
    await ConfigurationRevisionService.validateRevision('tenant-a', second.revisionId, 'admin-1');
    await ConfigurationRevisionService.publishRevision('tenant-a', second.revisionId, 'admin-1');

    const rolledBack = await ConfigurationRevisionService.rollbackToRevision(
      'tenant-a',
      first.revisionId,
      'admin-2'
    );
    expect(rolledBack.revision.revisionId).not.toBe(first.revisionId);
    expect(rolledBack.revision.payload).toEqual({ primaryColor: '#111111' });
    expect(rolledBack.revision.rollbackOfRevisionId).toBe(first.revisionId);
  });

  it('diffs nested values without replacing unchanged siblings', () => {
    expect(diffConfiguration(
      { a: 1, nested: { b: 2, c: 3 } },
      { a: 1, nested: { b: 4, c: 3 } }
    )).toEqual([{ path: 'nested.b', before: 2, after: 4 }]);
  });
});
