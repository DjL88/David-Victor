import { describe, expect, it } from 'vitest';
import { mergeCommerceStoreDiscoverySnapshot } from '../../server/deliverect/storeDiscoveryReliability';

const store = (channelLinkId: string) => ({
  commerceStoreId: `cstore_${channelLinkId}`,
  accountLinkId: 'acclink_acc_partial',
  channelLinkId,
  name: channelLinkId,
  stateProjection: 'open' as const,
  lastSeenAt: '2026-09-25T12:00:00.000Z',
});

describe('commerce store discovery reliability', () => {
  it('preserves a previously known channel when a later successful response is partial', () => {
    const result = mergeCommerceStoreDiscoverySnapshot(
      [store('st_keep_1'), store('st_keep_2')],
      [store('st_keep_1')],
      'acc_partial',
      '2026-09-25T13:00:00.000Z'
    );

    expect(result.effectiveStores.map((item) => item.channelLinkId).sort()).toEqual([
      'st_keep_1',
      'st_keep_2',
    ]);
    expect(
      (result.temporarilyMissingStores[0] as any).upstreamVisibility
    ).toBe('MISSING');
    expect(
      (result.temporarilyMissingStores[0] as any).lastUpstreamMissingAt
    ).toBe('2026-09-25T13:00:00.000Z');
  });

  it('never carries unrelated-account stores into the effective account snapshot', () => {
    const unrelated = {
      ...store('st_other'),
      accountLinkId: 'acclink_acc_other',
    };
    const result = mergeCommerceStoreDiscoverySnapshot(
      [store('st_keep_1'), unrelated],
      [store('st_keep_1')],
      'acc_partial',
      '2026-09-25T13:00:00.000Z'
    );

    expect(result.effectiveStores.map((item) => item.channelLinkId)).toEqual(['st_keep_1']);
  });
});
