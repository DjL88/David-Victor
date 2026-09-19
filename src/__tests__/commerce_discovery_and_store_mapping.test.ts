import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommerceDiscoveryService,
  MAX_VISIBLE_STORES,
  COLLECTION_RADIUS_METRES,
  DISPATCH_VALIDATION_CONCURRENCY,
  asyncPool,
} from '../../server/deliverect/CommerceDiscoveryService';
import { DemoDiscoveryDataProvider } from '../../server/deliverect/DemoDiscoveryDataProvider';
import { IntegrationUnavailableAdapter } from '../../server/deliverect/IntegrationUnavailableAdapter';
import {
  Store,
  Coordinates,
  StoreStatus,
} from '../commerce/models';

describe('Phase 7: Commerce Discovery & Store Mapping', () => {
  let discoveryService: CommerceDiscoveryService;
  const centralCoords: Coordinates = { latitude: 51.5074, longitude: -0.1278 }; // Central London

  beforeEach(() => {
    CommerceDiscoveryService.setDataProvider(new DemoDiscoveryDataProvider());
    discoveryService = CommerceDiscoveryService.getInstance();
    discoveryService.clearCache();
  });

  describe('Store Candidate Search & Discovery Algorithm (Section 12)', () => {
    it('bounds candidate set to at most MAX_VISIBLE_STORES (10 stores)', async () => {
      // Generate 20 mock stores at varying distances
      const mockStores: Store[] = Array.from({ length: 20 }, (_, i) => ({
        id: `store-${i + 1}`,
        name: `Test Store ${i + 1}`,
        address: { city: 'London', country: 'GB' },
        coordinates: {
          latitude: centralCoords.latitude + i * 0.005,
          longitude: centralCoords.longitude + i * 0.005,
        },
        distanceMeters: i * 800, // from 0m to 15,200m
        status: 'OPEN' as StoreStatus,
        supportsDelivery: true,
        supportsPickup: true,
      }));

      const result = await discoveryService.discoverStores({
        coordinates: centralCoords,
        tenantId: 'test-brand',
        appMode: 'demo',
        customStores: mockStores,
      });

      expect(result.eligibleStores.length).toBeLessThanOrEqual(MAX_VISIBLE_STORES);
      expect(result.eligibleStores.length).toBe(10);
    });

    it('strictly enforces COLLECTION_RADIUS_METRES (20,000m / 20km) boundary', async () => {
      // Create one store within 5km, one at 19km, and one at 25km (outside 20km)
      const mockStores: Store[] = [
        {
          id: 'store-close',
          name: 'Close Store',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: centralCoords.latitude + 0.02, longitude: centralCoords.longitude },
          distanceMeters: 2200,
          status: 'OPEN' as StoreStatus,
          supportsDelivery: false,
          supportsPickup: true,
        },
        {
          id: 'store-boundary',
          name: 'Boundary Store',
          address: { city: 'London', country: 'GB' },
          // ~18 km away
          coordinates: { latitude: centralCoords.latitude + 0.16, longitude: centralCoords.longitude },
          distanceMeters: 17800,
          status: 'OPEN' as StoreStatus,
          supportsDelivery: false,
          supportsPickup: true,
        },
        {
          id: 'store-far-away',
          name: 'Far Away Store',
          address: { city: 'Far', country: 'GB' },
          // ~35 km away
          coordinates: { latitude: centralCoords.latitude + 0.32, longitude: centralCoords.longitude },
          distanceMeters: 35000,
          status: 'OPEN' as StoreStatus,
          supportsDelivery: false,
          supportsPickup: true,
        },
      ];

      const result = await discoveryService.discoverStores({
        coordinates: centralCoords,
        tenantId: 'test-brand',
        appMode: 'demo',
        customStores: mockStores,
      });

      const storeIds = result.eligibleStores.map((s) => s.store.id);
      expect(storeIds).toContain('store-close');
      expect(storeIds).toContain('store-boundary');
      expect(storeIds).not.toContain('store-far-away');

      // Verify no eligible store exceeds 20,000m
      for (const es of result.eligibleStores) {
        expect(es.distanceMeters).toBeLessThanOrEqual(COLLECTION_RADIUS_METRES);
      }
    });

    it('preserves store operational statuses (OPEN, CLOSED, BUSY, PAUSED)', async () => {
      const mockStores: Store[] = [
        {
          id: 'store-open',
          name: 'Store Open',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: centralCoords.latitude + 0.01, longitude: centralCoords.longitude },
          distanceMeters: 1100,
          status: 'OPEN' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: true,
        },
        {
          id: 'store-busy',
          name: 'Store Busy',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: centralCoords.latitude + 0.02, longitude: centralCoords.longitude },
          distanceMeters: 2200,
          status: 'BUSY' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: true,
        },
        {
          id: 'store-paused',
          name: 'Store Paused',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: centralCoords.latitude + 0.03, longitude: centralCoords.longitude },
          distanceMeters: 3300,
          status: 'PAUSED' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: true,
        },
      ];

      const result = await discoveryService.discoverStores({
        coordinates: centralCoords,
        tenantId: 'test-brand',
        appMode: 'demo',
        customStores: mockStores,
      });

      const openStore = result.eligibleStores.find((s) => s.store.id === 'store-open');
      const busyStore = result.eligibleStores.find((s) => s.store.id === 'store-busy');
      const pausedStore = result.eligibleStores.find((s) => s.store.id === 'store-paused');

      expect(openStore?.store.status).toBe('OPEN');
      expect(busyStore?.store.status).toBe('BUSY');
      expect(pausedStore?.store.status).toBe('PAUSED');
    });

    it('does not hide CLOSED stores when scheduling/pre-ordering is supported', async () => {
      const mockStores: Store[] = [
        {
          id: 'store-closed-with-scheduling',
          name: 'Store Closed Preorders Only',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: centralCoords.latitude + 0.01, longitude: centralCoords.longitude },
          distanceMeters: 1000,
          status: 'CLOSED' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: true,
          scheduling: {
            acceptsAsapOrders: false,
            acceptsPreOrders: true,
            acceptsSameDayPreOrders: true,
          },
        },
        {
          id: 'store-closed-no-scheduling',
          name: 'Store Closed Permanently',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: centralCoords.latitude + 0.02, longitude: centralCoords.longitude },
          distanceMeters: 2000,
          status: 'CLOSED' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: true,
          scheduling: {
            acceptsAsapOrders: false,
            acceptsPreOrders: false,
            acceptsSameDayPreOrders: false,
          },
        },
      ];

      const result = await discoveryService.discoverStores({
        coordinates: centralCoords,
        tenantId: 'test-brand',
        appMode: 'demo',
        customStores: mockStores,
      });

      const scheduledStore = result.eligibleStores.find((s) => s.store.id === 'store-closed-with-scheduling');
      expect(scheduledStore).toBeDefined();
      expect(scheduledStore?.deliveryServiceable).toBe(true);

      // Closed store with no pre-ordering or scheduling is not eligible for delivery/collection
      const closedNoSched = result.eligibleStores.find((s) => s.store.id === 'store-closed-no-scheduling');
      expect(closedNoSched).toBeUndefined();
    });

    it('executes validations with controlled concurrency (asyncPool)', async () => {
      let activeConcurrency = 0;
      let maxSeenConcurrency = 0;

      const tasks = Array.from({ length: 12 }, (_, i) => i);
      const results = await asyncPool(DISPATCH_VALIDATION_CONCURRENCY, tasks, async (task) => {
        activeConcurrency++;
        if (activeConcurrency > maxSeenConcurrency) {
          maxSeenConcurrency = activeConcurrency;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
        activeConcurrency--;
        return task * 2;
      });

      expect(maxSeenConcurrency).toBeLessThanOrEqual(DISPATCH_VALIDATION_CONCURRENCY);
      expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    });
  });

  describe('Root Menu vs Store Menu Separation (Sections 9 & 13)', () => {
    it('projects pre-store availability (availableNearby) across bounded candidate stores', async () => {
      const projection = await discoveryService.getRootCatalogWithNearbyProjection({
        tenantId: 'test-brand',
        candidateStoreIds: ['store-market-lane-chelmsford', 'store-market-lane-moulsham'],
        appMode: 'demo',
      });

      expect(projection.catalog.type).toBe('ROOT');
      expect(Object.keys(projection.summaries).length).toBeGreaterThan(0);

      // Verify that availableNearby is a boolean projection
      const sampleSummary = Object.values(projection.summaries)[0];
      expect(typeof sampleSummary.availableNearby).toBe('boolean');
      expect(sampleSummary.eligibleStoreCount).toBeLessThanOrEqual(MAX_VISIBLE_STORES);
    });

    it('returns authoritative store-specific catalog with storeId', async () => {
      const storeCatalog = await discoveryService.getStoreCatalog({
        tenantId: 'test-brand',
        storeId: 'store-market-lane-chelmsford',
        fulfillmentType: 'delivery',
        appMode: 'demo',
      });

      expect(storeCatalog.type).toBe('STORE');
      expect(storeCatalog.storeId).toBe('store-market-lane-chelmsford');
      expect(storeCatalog.products).toBeDefined();
      expect(storeCatalog.products!.length).toBeGreaterThan(0);

      for (const p of storeCatalog.products!) {
        expect(p.active).toBe(true);
      }
    });

    it('throws 404 STORE_NOT_FOUND when requesting catalog for a nonexistent store', async () => {
      await expect(
        discoveryService.getStoreCatalog({
          tenantId: 'test-brand',
          storeId: 'nonexistent-store-xyz',
          appMode: 'demo',
        })
      ).rejects.toThrow('Store not found: nonexistent-store-xyz');
    });
  });

  describe('Staging & Production Guard (Zero Mock Fallback)', () => {
    it('strictly returns 503 INTEGRATION_NOT_CONFIGURED when live credentials are not present', async () => {
      const unavailableAdapter = new IntegrationUnavailableAdapter('staging', 'brand-staging');

      await expect(
        unavailableAdapter.getStores(centralCoords)
      ).rejects.toThrow(/INTEGRATION_NOT_CONFIGURED|Live credentials/);

      await expect(
        unavailableAdapter.getEligibleStores(centralCoords)
      ).rejects.toThrow(/INTEGRATION_NOT_CONFIGURED|Live credentials/);

      await expect(
        unavailableAdapter.getRootCatalog()
      ).rejects.toThrow(/INTEGRATION_NOT_CONFIGURED|Live credentials/);

      await expect(
        unavailableAdapter.getStoreCatalog('store-01')
      ).rejects.toThrow(/INTEGRATION_NOT_CONFIGURED|Live credentials/);
    });
  });
});
