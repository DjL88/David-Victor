import { afterEach, describe, expect, it, vi } from 'vitest';
import { FirestorePlatformService } from '../../server/firestoreService';
import { BFFError } from '../../server/errors';
import { setServerRuntimeMode } from '../../server/runtimeMode';

const storage = vi.hoisted(() => ({ set: vi.fn(), available: true }));
vi.mock('../../server/firebase', async importOriginal => ({
  ...await importOriginal<typeof import('../../server/firebase')>(),
  getFirestoreDb: () => storage.available ? { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ set: storage.set }) }) }) }) } : null,
}));

describe('explicit first fee-policy setup', () => {
  afterEach(() => { vi.restoreAllMocks(); storage.set.mockReset(); storage.available = true; setServerRuntimeMode(null); });
  it('creates an unconfigured tenant policy only on explicit save', async () => {
    setServerRuntimeMode('staging');
    vi.spyOn(FirestorePlatformService, 'getTenantFeePolicy').mockRejectedValue(new BFFError('POLICY_NOT_FOUND', 'unconfigured', 404));
    const tenant = vi.spyOn(FirestorePlatformService, 'getTenantConfig').mockResolvedValue({ tenantId: 'setup-test' } as any);
    const policy = await FirestorePlatformService.updateTenantFeePolicy('setup-test', { bagFee: 15 });
    expect(tenant).toHaveBeenCalledWith('setup-test');
    expect(policy).toMatchObject({ bagFee: 15, serviceFeeEnabled: false, serviceFeeAmount: 0 });
    expect(storage.set).toHaveBeenCalledWith(policy, { merge: true });
  });
  it('does not turn a failed read into a default fee policy', async () => {
    const outage = new BFFError('DATABASE_UNAVAILABLE', 'outage', 503);
    vi.spyOn(FirestorePlatformService, 'getTenantFeePolicy').mockRejectedValue(outage);
    await expect(FirestorePlatformService.updateTenantFeePolicy('setup-test', {})).rejects.toBe(outage);
    expect(storage.set).not.toHaveBeenCalled();
  });
  it('reports failed persistence instead of claiming a save', async () => {
    vi.spyOn(FirestorePlatformService, 'getTenantFeePolicy').mockResolvedValue({ bagFee: 0 } as any);
    storage.set.mockRejectedValue(new Error('write failed'));
    await expect(FirestorePlatformService.updateTenantFeePolicy('setup-test', { bagFee: 15 })).rejects.toThrow('write failed');
  });
});
