import { useState, useEffect, useCallback, useMemo } from 'react';
import { Store, Coordinates, Address, EligibleStore } from '../commerce/models';
import { useTenant } from '../tenant/TenantContext';
import { defaultAnalyticsClient, AnalyticsEventType } from '../analytics';

export type EntryStage = 'SPLASH' | 'LOCATION' | 'FULFILMENT' | 'STORE_SELECTION' | 'READY';

const STORAGE_KEYS = {
  ADDRESS: '__retail_customer_address',
  COORDINATES: '__retail_customer_coordinates',
  STORE_ID: '__retail_selected_store_id',
  FULFILLMENT: '__retail_fulfillment_type',
};

export function useLocationAndStores() {
  const { client } = useTenant();

  // Location state: NEVER starts with fake coordinates or address
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'resolving' | 'resolved' | 'error'>('idle');

  // Stores & eligibility state
  const [eligibleStores, setEligibleStores] = useState<EligibleStore[]>([]);
  const [deliveryStores, setDeliveryStores] = useState<EligibleStore[]>([]);
  const [collectionStores, setCollectionStores] = useState<EligibleStore[]>([]);
  const [hasDeliveryCoverage, setHasDeliveryCoverage] = useState<boolean>(true);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

  // Fulfillment & journey state
  const [fulfillmentType, setFulfillmentTypeState] = useState<'delivery' | 'pickup'>('delivery');
  const [entryStage, setEntryStage] = useState<EntryStage>('SPLASH');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modal visibility states
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [isStorePickerOpen, setIsStorePickerOpen] = useState<boolean>(false);
  const [isFulfilmentModalOpen, setIsFulfilmentModalOpen] = useState<boolean>(false);

  // Global store inventory
  const [allStores, setAllStores] = useState<Store[]>([]);

  // Fetch all available stores on mount
  useEffect(() => {
    let isMounted = true;
    client
      .getStores()
      .then((stores) => {
        if (isMounted && Array.isArray(stores)) {
          setAllStores(stores);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch all stores:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [client]);

  // Flattened Store[] for consumers expecting standard Store list
  const nearbyStores: Store[] = useMemo(() => {
    return eligibleStores.map((item) => item.store);
  }, [eligibleStores]);

  // Filter for only active/open stores
  const activeStores: Store[] = useMemo(() => {
    const list = allStores.length > 0 ? allStores : nearbyStores;
    return list.filter((s) => {
      const statusUpper = String(s.status || '').toUpperCase();
      return statusUpper !== 'CLOSED' && statusUpper !== 'INACTIVE';
    });
  }, [allStores, nearbyStores]);

  const hasLocation = Boolean(coordinates && currentAddress);

  // Authoritative store eligibility fetcher - only runs with non-null coordinates
  const refreshStores = useCallback(
    async (coords: Coordinates, address: Address | null, mode: 'delivery' | 'pickup') => {
      try {
        setLoading(true);
        setError(null);

        const result = await client.getEligibleStores(coords, address, mode);
        setEligibleStores(result.eligibleStores);
        setDeliveryStores(result.deliveryStores);
        setCollectionStores(result.collectionStores);
        setHasDeliveryCoverage(result.hasDeliveryCoverage);

        defaultAnalyticsClient.track({
          type: AnalyticsEventType.ELIGIBLE_STORES_RETURNED,
          properties: {
            fulfillmentType: mode,
            eligibleCount: result.eligibleStores.length,
            deliveryCount: result.deliveryStores.length,
            collectionCount: result.collectionStores.length,
            hasDeliveryCoverage: result.hasDeliveryCoverage,
          },
        });

        if (!result.hasDeliveryCoverage && mode === 'delivery') {
          const coarseOutcode = address?.postalCode?.split(' ')[0] || address?.city || 'UNKNOWN';
          defaultAnalyticsClient.track({
            type: AnalyticsEventType.NO_DELIVERY_AVAILABLE,
            coarseRegion: coarseOutcode,
            properties: {
              coarseOutcode,
              hasStoresNearby: result.eligibleStores.length > 0,
            },
          });
        }

        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve eligible stores';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  // Restore session-persisted location and store preferences on mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const savedAddrRaw = sessionStorage.getItem(STORAGE_KEYS.ADDRESS);
        const savedCoordsRaw = sessionStorage.getItem(STORAGE_KEYS.COORDINATES);
        const savedStoreId = sessionStorage.getItem(STORAGE_KEYS.STORE_ID);
        const savedFulfillment = sessionStorage.getItem(STORAGE_KEYS.FULFILLMENT) as
          | 'delivery'
          | 'pickup'
          | null;

        if (savedFulfillment) {
          setFulfillmentTypeState(savedFulfillment);
        }

        if (savedAddrRaw && savedCoordsRaw) {
          const parsedAddr = JSON.parse(savedAddrRaw) as Address;
          const parsedCoords = JSON.parse(savedCoordsRaw) as Coordinates;

          if (
            parsedCoords &&
            typeof parsedCoords.latitude === 'number' &&
            typeof parsedCoords.longitude === 'number'
          ) {
            if (!isMounted) return;
            setCurrentAddress(parsedAddr);
            setCoordinates(parsedCoords);
            setLocationStatus('resolved');

            // Set coarse region for privacy analytics
            const coarse = parsedAddr.postalCode?.split(' ')[0] || parsedAddr.city || 'GB';
            defaultAnalyticsClient.setCoarseRegion(coarse);

            // Fetch stores authoritatively
            const activeMode = savedFulfillment || 'delivery';
            const result = await client.getEligibleStores(parsedCoords, parsedAddr, activeMode);

            if (!isMounted) return;
            setEligibleStores(result.eligibleStores);
            setDeliveryStores(result.deliveryStores);
            setCollectionStores(result.collectionStores);
            setHasDeliveryCoverage(result.hasDeliveryCoverage);

            // Authoritative store restoration (NEVER fallback to MOCK_STORES)
            if (savedStoreId) {
              const inMemoryStore = result.eligibleStores.find((e) => e.store.id === savedStoreId)?.store;
              if (inMemoryStore) {
                setSelectedStore(inMemoryStore);
              } else {
                const fetchedStore = await client.getStore(savedStoreId);
                if (isMounted) {
                  setSelectedStore(fetchedStore);
                }
              }
            }

            setEntryStage('READY');
            return;
          }
        }

        // If no location saved, user must go through location step
        if (isMounted) {
          setEntryStage('LOCATION');
        }
      } catch (e) {
        console.warn('Could not restore session state:', e);
        if (isMounted) {
          setEntryStage('LOCATION');
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [client]);

  // Resolves customer location and coordinates without fake fallbacks
  const resolveAndSetLocation = async (
    query: string | Coordinates | { address: Address; coordinates: Coordinates }
  ) => {
    try {
      setLoading(true);
      setError(null);
      setLocationStatus('resolving');

      defaultAnalyticsClient.track({
        type: AnalyticsEventType.LOCATION_STARTED,
      });

      let resolvedAddr: Address;
      let resolvedCoords: Coordinates;

      if (typeof query === 'object' && 'address' in query && 'coordinates' in query) {
        resolvedAddr = query.address;
        resolvedCoords = query.coordinates;
      } else {
        const res = await client.resolveAddress(query);
        resolvedAddr = res.address;
        resolvedCoords = res.coordinates;
      }

      setCurrentAddress(resolvedAddr);
      setCoordinates(resolvedCoords);
      setLocationStatus('resolved');

      // Persist to session storage
      try {
        sessionStorage.setItem(STORAGE_KEYS.ADDRESS, JSON.stringify(resolvedAddr));
        sessionStorage.setItem(STORAGE_KEYS.COORDINATES, JSON.stringify(resolvedCoords));
      } catch (storageErr) {
        console.warn('Failed to persist location to sessionStorage:', storageErr);
      }

      // Track coarse privacy-sanitized analytics
      const coarseRegion = resolvedAddr.postalCode?.split(' ')[0] || resolvedAddr.city || 'GB';
      defaultAnalyticsClient.setCoarseRegion(coarseRegion);
      defaultAnalyticsClient.track({
        type: AnalyticsEventType.LOCATION_RESOLVED,
        coarseRegion,
        properties: {
          city: resolvedAddr.city,
          country: resolvedAddr.country,
        },
      });

      // Retrieve eligible stores with new coordinates
      const storeResult = await refreshStores(resolvedCoords, resolvedAddr, fulfillmentType);

      setIsLocationModalOpen(false);

      // Advance stage to FULFILMENT
      setEntryStage('FULFILMENT');
      setIsFulfilmentModalOpen(true);

      return storeResult;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not resolve location';
      setError(msg);
      setLocationStatus('error');

      defaultAnalyticsClient.track({
        type: AnalyticsEventType.LOCATION_FAILED,
        properties: { error: msg },
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Switch fulfillment mode (delivery vs collection)
  const setFulfillmentType = useCallback(
    async (mode: 'delivery' | 'pickup') => {
      setFulfillmentTypeState(mode);
      try {
        sessionStorage.setItem(STORAGE_KEYS.FULFILLMENT, mode);
      } catch {}

      defaultAnalyticsClient.track({
        type: AnalyticsEventType.FULFILLMENT_SELECTED,
        properties: { fulfillmentType: mode },
      });

      if (coordinates) {
        await refreshStores(coordinates, currentAddress, mode);
      }

      // Advance stage to STORE_SELECTION
      setEntryStage('STORE_SELECTION');
      setIsFulfilmentModalOpen(false);
      setIsStorePickerOpen(true);
    },
    [coordinates, currentAddress, refreshStores]
  );

  // Authoritative store selection
  const selectStore = useCallback(
    async (storeOrId: Store | string | null) => {
      if (!storeOrId) {
        setSelectedStore(null);
        try {
          sessionStorage.removeItem(STORAGE_KEYS.STORE_ID);
        } catch {}

        defaultAnalyticsClient.track({
          type: AnalyticsEventType.BROWSE_NEARBY_SELECTED,
        });

        setIsStorePickerOpen(false);
        setEntryStage('READY');
        return;
      }

      let chosenStore: Store | null = null;

      if (typeof storeOrId === 'string') {
        const inMemory = eligibleStores.find((e) => e.store.id === storeOrId)?.store;
        if (inMemory) {
          chosenStore = inMemory;
        } else {
          // Authoritative fetch via client, NEVER MOCK_STORES
          chosenStore = await client.getStore(storeOrId);
        }
      } else {
        chosenStore = storeOrId;
      }

      if (chosenStore) {
        setSelectedStore(chosenStore);
        try {
          sessionStorage.setItem(STORAGE_KEYS.STORE_ID, chosenStore.id);
        } catch {}

        defaultAnalyticsClient.track({
          type: AnalyticsEventType.STORE_SELECTED,
          storeId: chosenStore.id,
          properties: {
            storeName: chosenStore.name,
            supportsDelivery: chosenStore.supportsDelivery,
            collectionAvailable: chosenStore.collectionAvailable,
          },
        });
      }

      setIsStorePickerOpen(false);
      setEntryStage('READY');
    },
    [client, eligibleStores]
  );

  // Reset location (returns customer to location stage)
  const resetLocation = useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.ADDRESS);
      sessionStorage.removeItem(STORAGE_KEYS.COORDINATES);
      sessionStorage.removeItem(STORAGE_KEYS.STORE_ID);
    } catch {}

    setCurrentAddress(null);
    setCoordinates(null);
    setSelectedStore(null);
    setEligibleStores([]);
    setDeliveryStores([]);
    setCollectionStores([]);
    setLocationStatus('idle');
    setEntryStage('LOCATION');
    setIsLocationModalOpen(true);
  }, []);

  return {
    entryStage,
    setEntryStage,
    currentAddress,
    coordinates,
    hasLocation,
    locationStatus,
    fulfillmentType,
    setFulfillmentType,
    eligibleStores,
    deliveryStores,
    collectionStores,
    nearbyStores,
    allStores,
    activeStores,
    selectedStore,
    hasDeliveryCoverage,
    loading,
    error,
    isLocationModalOpen,
    setIsLocationModalOpen,
    isStorePickerOpen,
    setIsStorePickerOpen,
    isFulfilmentModalOpen,
    setIsFulfilmentModalOpen,
    resolveAndSetLocation,
    selectStore,
    refreshStores,
    resetLocation,
  };
}
