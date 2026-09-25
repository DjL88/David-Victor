import { describe, it, expect } from 'vitest';
import { isUnassignedStore } from '../admin/screens/StoreConfigScreen';
import { Store } from '../commerce/models';

describe('StoreConfigScreen Admin Provisioning Helpers', () => {
  const baseStore: Store = {
    id: 'store-chelmsford',
    name: 'Chelmsford Central',
    address: {
      city: 'Chelmsford',
      country: 'GB',
      formattedAddress: '10 High Street, Chelmsford',
    },
    coordinates: { latitude: 51.7356, longitude: 0.4685 },
    distanceMeters: 500,
    status: 'OPEN',
    supportsDelivery: true,
    supportsPickup: true,
  };

  it('correctly identifies unassigned stores lacking brandStoreId or channelLinkId', () => {
    const unassignedStore: Store = {
      ...baseStore,
      physicalLocationId: 'Unresolved',
      channelLinkId: undefined,
      brandStoreId: undefined,
    };

    expect(isUnassignedStore(unassignedStore)).toBe(true);
  });

  it('correctly identifies fully assigned stores', () => {
    const assignedStore: Store = {
      ...baseStore,
      physicalLocationId: 'loc-12345',
      channelLinkId: 'cl-67890',
      brandStoreId: 'brand-store-001',
    };

    expect(isUnassignedStore(assignedStore)).toBe(false);
  });

  it('honours the durable assignment flag when optional POS metadata is absent', () => {
    const assignedStore: Store = {
      ...baseStore,
      assigned: true,
      physicalLocationId: 'loc-12345',
      channelLinkId: 'cl-67890',
      brandStoreId: undefined,
    };

    expect(isUnassignedStore(assignedStore)).toBe(false);
  });
});
