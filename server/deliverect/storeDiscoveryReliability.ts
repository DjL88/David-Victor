import type { CommerceStore } from '../../src/domain/models';

export interface CommerceStoreDiscoveryMerge {
  visibleStores: CommerceStore[];
  temporarilyMissingStores: CommerceStore[];
  effectiveStores: CommerceStore[];
}

/**
 * Deliverect discovery is observational. A partial response must not silently
 * delete a tenant's last-known-good channel mapping; explicit assignment state
 * is maintained separately by the integration control plane.
 */
export function mergeCommerceStoreDiscoverySnapshot(
  previousStores: CommerceStore[],
  discoveredStores: CommerceStore[],
  accountId: string,
  now: string = new Date().toISOString()
): CommerceStoreDiscoveryMerge {
  const freshIds = new Set(discoveredStores.map((store) => String(store.channelLinkId)));
  const previousAccountStores = previousStores.filter((store) => {
    const existingAccount = String(store.accountLinkId || '');
    return existingAccount === accountId || existingAccount === `acclink_${accountId}`;
  });

  const temporarilyMissingStores = previousAccountStores
    .filter((store) => !freshIds.has(String(store.channelLinkId)))
    .map((store) => ({
      ...store,
      upstreamVisibility: 'MISSING',
      lastUpstreamMissingAt: (store as any).lastUpstreamMissingAt || now,
    } as CommerceStore));

  const visibleStores = discoveredStores.map((store) => ({
    ...store,
    upstreamVisibility: 'VISIBLE',
    lastUpstreamMissingAt: undefined,
  } as CommerceStore));

  return {
    visibleStores,
    temporarilyMissingStores,
    effectiveStores: [...visibleStores, ...temporarilyMissingStores],
  };
}
