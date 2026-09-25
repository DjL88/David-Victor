import { describe, expect, it } from 'vitest';
import { resolvePersistentChannelAssignments } from '../../server/deliverect/locationAssignmentPersistence';

describe('tenant location assignment persistence', () => {
  it('preserves durable assignments when a refresh omits channelLinkIds', () => {
    expect(resolvePersistentChannelAssignments({
      existingChannelLinkIds: ['channel-a'],
      discoveredChannelLinkIds: [],
    })).toEqual({
      requestedChannelLinkIds: ['channel-a'],
      visibleChannelLinkIds: [],
      temporarilyMissingChannelLinkIds: ['channel-a'],
    });
  });

  it('does not unlink an assigned location because discovery is temporarily empty', () => {
    const result = resolvePersistentChannelAssignments({
      existingChannelLinkIds: ['channel-a', 'channel-b'],
      requestedChannelLinkIds: undefined,
      discoveredChannelLinkIds: ['channel-b'],
    });
    expect(result.requestedChannelLinkIds).toEqual(['channel-a', 'channel-b']);
    expect(result.temporarilyMissingChannelLinkIds).toEqual(['channel-a']);
  });

  it('changes ownership only when an explicit assignment set is submitted', () => {
    const result = resolvePersistentChannelAssignments({
      existingChannelLinkIds: ['channel-a', 'channel-b'],
      requestedChannelLinkIds: ['channel-b'],
      discoveredChannelLinkIds: ['channel-b'],
    });
    expect(result.requestedChannelLinkIds).toEqual(['channel-b']);
    expect(result.visibleChannelLinkIds).toEqual(['channel-b']);
    expect(result.temporarilyMissingChannelLinkIds).toEqual([]);
  });
});
