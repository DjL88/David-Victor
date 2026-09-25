export interface PersistentChannelAssignmentResolution {
  requestedChannelLinkIds: string[];
  visibleChannelLinkIds: string[];
  temporarilyMissingChannelLinkIds: string[];
}

/**
 * Tenant location ownership is durable control-plane state. Upstream discovery
 * is observational and must never silently unlink an already assigned channel.
 * Only an explicit channelLinkIds payload changes the assignment set.
 */
export function resolvePersistentChannelAssignments(params: {
  existingChannelLinkIds?: string[];
  requestedChannelLinkIds?: unknown;
  discoveredChannelLinkIds?: string[];
}): PersistentChannelAssignmentResolution {
  const unique = (values: unknown[]) => [...new Set(values.map(String).map((value) => value.trim()).filter(Boolean))];
  const existing = unique(Array.isArray(params.existingChannelLinkIds) ? params.existingChannelLinkIds : []);
  const requested = params.requestedChannelLinkIds === undefined
    ? existing
    : unique(Array.isArray(params.requestedChannelLinkIds) ? params.requestedChannelLinkIds : []);
  const discovered = new Set(unique(Array.isArray(params.discoveredChannelLinkIds) ? params.discoveredChannelLinkIds : []));
  return {
    requestedChannelLinkIds: requested,
    visibleChannelLinkIds: requested.filter((id) => discovered.has(id)),
    temporarilyMissingChannelLinkIds: requested.filter((id) => !discovered.has(id)),
  };
}
