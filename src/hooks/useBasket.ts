import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Basket, Store, Product, SubstitutionPreferenceType, Money, moneyFromMajor, toMoney } from '../commerce/models';
import { BundleProduct, SelectedBundleModifier, calculateBundlePrice } from '../commerce/bundleModels';
import { useTenant } from '../tenant/TenantContext';
import { defaultAnalyticsClient } from '../analytics';
import {
  checkProductSnooze,
  evaluateBasketSnoozeStatus,
  BasketSnoozeAuditResult,
} from '../services/snoozeCheckService';
import { evaluateStoreOpenNow } from '../services/storeOpeningHoursService';

export function useBasket(
  selectedStore: Store | null,
  fulfillmentType: 'delivery' | 'pickup' = 'pickup'
) {
  const { client, tenant } = useTenant();
  const tenantId = tenant?.tenantId || 'brand-alpha';

  // Authoritative single-store basket state
  const [basket, setBasket] = useState<Basket | null>(null);
  const basketRef = useRef<Basket | null>(null);
  const basketCreatePromiseRef = useRef<Promise<Basket> | null>(null);
  const basketMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [optimisticQuantities, setOptimisticQuantities] = useState<Record<string, number>>({});
  const optimisticQuantitiesRef = useRef<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [snoozeWarning, setSnoozeWarning] = useState<string | null>(null);
  const [storeSwitchDiff, setStoreSwitchDiff] = useState<{
    availableUnchanged?: Array<{ plu: string; name: string; quantity: number; price: Money | number }>;
    priceChanges: Array<{ plu: string; name?: string; oldPrice: Money | number; newPrice: Money | number }>;
    unavailableItems: Array<{ plu: string; name: string; reason?: string }>;
    quantityAdjusted: Array<{ plu: string; name?: string; requested: number; adjustedTo: number; reason?: string }>;
  } | null>(null);

  const activeStoreId = selectedStore?.id ?? '';
  const basketStorageKey = `bwydi:basket:${tenantId}`;

  const rememberBasket = useCallback((nextBasket: Basket | null) => {
    basketRef.current = nextBasket;
    setBasket(nextBasket);
    if (!basketStorageKey) return;
    if (nextBasket?.id) localStorage.setItem(basketStorageKey, nextBasket.id);
    else localStorage.removeItem(basketStorageKey);
  }, [basketStorageKey]);

  const setOptimisticQuantity = useCallback((plu: string, quantity: number | null) => {
    const next = { ...optimisticQuantitiesRef.current };
    if (quantity === null) delete next[plu];
    else next[plu] = Math.max(0, quantity);
    optimisticQuantitiesRef.current = next;
    setOptimisticQuantities(next);
  }, []);

  useEffect(() => {
    basketRef.current = basket;
  }, [basket]);

  // Backwards-compatible single basket array (no multi-store split)
  const allBaskets = useMemo(() => {
    return basket && basket.items && basket.items.length > 0 ? [basket] : [];
  }, [basket]);

  const isMultiLocation = false;

  // Real-time evaluation of basket snooze and availability status
  // Runs on page load, basket calculation, and whenever basket items change
  const snoozeAudit: BasketSnoozeAuditResult = useMemo(() => {
    return evaluateBasketSnoozeStatus(basket);
  }, [basket]);

  // Track basket viewed when cart drawer opens
  useEffect(() => {
    if (isCartOpen) {
      defaultAnalyticsClient.track({
        type: 'BASKET_VIEWED',
        storeId: selectedStore?.id,
      });
    }
  }, [isCartOpen, selectedStore?.id]);

  // Opening a stale drawer always refreshes prices and availability from the server.
  useEffect(() => {
    if (!isCartOpen || !basket) return;
    const age = Date.now() - Date.parse(basket.updatedAt || '');
    if (Number.isFinite(age) && age < 30_000) return;
    client.reconcileBasket(basket.id, selectedStore?.id)
      .then((result) => rememberBasket(result.basket))
      .catch((err) => console.warn('[useBasket] Failed to refresh basket availability:', err?.message || err));
  }, [isCartOpen, basket?.id, basket?.updatedAt, selectedStore?.id, client, rememberBasket]);

  // Synchronize basket with selected store:
  // If customer changes store, revalidate basket items against the new store
  useEffect(() => {
    let isMounted = true;

    async function syncBasketWithStore() {
      if (!selectedStore) return;

      try {
        setLoading(true);
        let currentBasket = basket;
        if (!currentBasket && basketStorageKey) {
          const rememberedId = localStorage.getItem(basketStorageKey);
          if (rememberedId) currentBasket = await client.getBasket(rememberedId).catch(() => null);
        }
        if (currentBasket && currentBasket.items.length > 0 && currentBasket.storeId !== selectedStore.id) {
          const switchResult = await client.selectStore(selectedStore.id, currentBasket.id);
          if (isMounted) {
            if (switchResult.basket) rememberBasket(switchResult.basket);
            if (switchResult.storeSwitchDiff) setStoreSwitchDiff(switchResult.storeSwitchDiff);
          }
        } else if (currentBasket && currentBasket.storeId === selectedStore.id) {
          if (isMounted) {
            rememberBasket(currentBasket);
          }
        } else if (isMounted) {
          setBasket(null);
        }
      } catch (err: any) {
        console.warn('[useBasket] Failed to sync basket with store:', err?.message || err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    syncBasketWithStore();

    return () => {
      isMounted = false;
    };
  }, [selectedStore?.id, client, basketStorageKey, fulfillmentType]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateQuantity = useCallback(
    async (product: Product, newQuantity: number, _targetStoreId?: string) => {
      try {
        setSnoozeWarning(null);

        // Pre-emptively fail gracefully if delivery is requested:
        // Deliverect Commerce Basket API is collection-only until the Dispatch phase (docs/NORTH_STAR.md §11).
        if (fulfillmentType === 'delivery') {
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return { success: false, reason: 'INVALID_FULFILLMENT' };
        }

        let currentBasket = basketRef.current;
        const previousVisibleQty =
          optimisticQuantitiesRef.current[product.plu] ??
          currentBasket?.items.find((i) => i.plu === product.plu)?.quantity ??
          0;

        if (!currentBasket && !activeStoreId) {
          setSnoozeWarning('A store must be selected before creating a basket.');
          return { success: false, reason: 'NO_STORE_SELECTED' };
        }

        if (newQuantity > previousVisibleQty) {
          const snoozeStatus = checkProductSnooze(activeStoreId, product.plu);
          if (!snoozeStatus.isAvailable) {
            const reasonMsg = snoozeStatus.isSnoozed
              ? `"${product.name}" is temporarily unavailable at this store.`
              : `"${product.name}" is not available at this store.`;
            setSnoozeWarning(reasonMsg);
            return { success: false, reason: 'PRODUCT_UNAVAILABLE' };
          }
        }

        // Render the customer's intent immediately. The server remains authoritative:
        // mutations are serialized below and the optimistic value is removed once the
        // matching response (or failure) arrives.
        setOptimisticQuantity(product.plu, newQuantity);

        if (!currentBasket) {
          if (!activeStoreId) {
            setSnoozeWarning('A store must be selected before creating a basket.');
            return { success: false, reason: 'NO_STORE_SELECTED' };
          }
          // When the store is currently closed, the server (DeliverectApiClient.
          // createBasket) targets the store's next real opening time instead of
          // "now", so basket creation still succeeds — unless the tenant's
          // scheduling policy disallows pre-orders entirely (acceptAsapOrdersOnly,
          // or allowNextOpeningPreOrder off), in which case don't even attempt it.
          const openStatus = evaluateStoreOpenNow(selectedStore);
          if (!openStatus.isOpen) {
            if (selectedStore?.scheduling?.acceptsPreOrders === false) {
              setSnoozeWarning(
                `${selectedStore?.name || 'This store'} is closed right now and isn't accepting pre-orders.`
              );
              return { success: false, reason: 'STORE_CLOSED' };
            }
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} is closed right now${
                openStatus.nextChangeText ? ` — your order will be prepared for collection when it ${openStatus.nextChangeText.toLowerCase()}` : ''
              }. You can choose a different time at checkout.`
            );
          }
          const supportsRequested = selectedStore?.supportsPickup;
          if (supportsRequested === false) {
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} doesn't offer collection right now.`
            );
            return { success: false, reason: 'FULFILLMENT_NOT_SUPPORTED' };
          }
          if (!basketCreatePromiseRef.current) {
            basketCreatePromiseRef.current = client.createBasket(activeStoreId, fulfillmentType);
          }
          try {
            currentBasket = await basketCreatePromiseRef.current;
            rememberBasket(currentBasket);
          } finally {
            basketCreatePromiseRef.current = null;
          }
        }

        if (currentBasket && currentBasket.fulfillmentType === 'delivery') {
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return { success: false, reason: 'INVALID_FULFILLMENT' };
        }

        const previousQty =
          currentBasket.items.find((i) => i.plu === product.plu)?.quantity || 0;


        let resolveMutation!: (basket: Basket) => void;
        let rejectMutation!: (reason?: unknown) => void;
        const mutationResult = new Promise<Basket>((resolve, reject) => {
          resolveMutation = resolve;
          rejectMutation = reject;
        });

        basketMutationQueueRef.current = basketMutationQueueRef.current
          .then(async () => {
            try {
              const updatedBasket = await client.updateBasketItem(
                currentBasket!.id,
                product.plu,
                newQuantity
              );
              rememberBasket(updatedBasket);
              resolveMutation(updatedBasket);
            } catch (error) {
              rejectMutation(error);
            }
          })
          .catch(() => {
            // Keep the queue alive; the individual mutationResult carries the error.
          });

        const updatedBasket = await mutationResult;
        if (optimisticQuantitiesRef.current[product.plu] === newQuantity) {
          setOptimisticQuantity(product.plu, null);
        }

        // Track privacy-sanitized analytics event
        if (newQuantity > previousQty) {
          const numPrice: number =
            typeof product.price === 'object' && product.price !== null && 'amount' in product.price
              ? product.price.amount / 100
              : typeof product.price === 'number'
              ? product.price
              : 0;
          defaultAnalyticsClient.track({
            type: 'ADD_TO_BASKET',
            productPlu: product.plu,
            storeId: activeStoreId,
            properties: { quantity: newQuantity, price: numPrice },
          });
        } else if (newQuantity < previousQty) {
          defaultAnalyticsClient.track({
            type: 'REMOVE_FROM_BASKET',
            productPlu: product.plu,
            storeId: activeStoreId,
            properties: { quantity: newQuantity },
          });
        }
        return { success: true };
      } catch (err: any) {
        if (optimisticQuantitiesRef.current[product.plu] === newQuantity) {
          setOptimisticQuantity(product.plu, null);
        }
        const errorMsg = String(err?.message || err || '');
        const isFulfillmentError =
          errorMsg.includes('Delivery checkout is not enabled') ||
          err?.code === 'INVALID_FULFILLMENT' ||
          err?.code === 'FULFILLMENT_NOT_SUPPORTED';

        if (isFulfillmentError) {
          console.warn('[useBasket] Delivery fulfillment not enabled, failing gracefully:', errorMsg);
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return { success: false, reason: 'INVALID_FULFILLMENT' };
        }

        // STORE_CLOSED can still surface here even after the client-side pre-check
        // above, if the tenant's scheduling policy changed between page load and
        // this request — show the server's real reason rather than a generic one.
        if (err?.code === 'STORE_CLOSED') {
          console.warn('[useBasket] Store closed, failing gracefully:', errorMsg);
          setSnoozeWarning(errorMsg || 'This store cannot accept that order right now.');
          return { success: false, reason: 'STORE_CLOSED' };
        }

        console.warn('[useBasket] Failed to update basket item:', errorMsg);
        setSnoozeWarning(errorMsg || 'Could not update basket item. Please try again.');
        return { success: false };
      }
    },
    [activeStoreId, client, fulfillmentType, rememberBasket, selectedStore, setOptimisticQuantity]
  );

  const addMultipleItems = useCallback(
    async (
      itemsToAdd: Array<{ product: Product; quantity?: number }>,
      _targetStoreId?: string
    ) => {
      try {
        if (!activeStoreId) {
          console.warn('[useBasket] A store must be selected before adding items to the basket.');
          setSnoozeWarning('A store must be selected before adding items.');
          return;
        }

        if (fulfillmentType === 'delivery') {
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return;
        }

        let currentBasket = basket;
        if (!currentBasket) {
          const openStatus = evaluateStoreOpenNow(selectedStore);
          if (!openStatus.isOpen) {
            if (selectedStore?.scheduling?.acceptsPreOrders === false) {
              setSnoozeWarning(
                `${selectedStore?.name || 'This store'} is closed right now and isn't accepting pre-orders.`
              );
              return;
            }
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} is closed right now${
                openStatus.nextChangeText ? ` — your order will be prepared for collection when it ${openStatus.nextChangeText.toLowerCase()}` : ''
              }. You can choose a different time at checkout.`
            );
          }
          const supportsRequested = selectedStore?.supportsPickup;
          if (supportsRequested === false) {
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} doesn't offer collection right now.`
            );
            return;
          }
          currentBasket = await client.createBasket(activeStoreId, fulfillmentType);
        }

        if (currentBasket && currentBasket.fulfillmentType === 'delivery') {
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return;
        }

        let updatedBasket = currentBasket;
        for (const item of itemsToAdd) {
          const status = checkProductSnooze(activeStoreId, item.product.plu);
          if (!status.isAvailable) continue; // Skip unavailable/snoozed items

          const qtyToAdd = item.quantity || 1;
          const previousQty =
            updatedBasket.items.find((i) => i.plu === item.product.plu)?.quantity || 0;
          updatedBasket = await client.updateBasketItem(
            updatedBasket.id,
            item.product.plu,
            previousQty + qtyToAdd
          );
        }
        rememberBasket(updatedBasket);
      } catch (err: any) {
        const errorMsg = String(err?.message || err || '');
        const isFulfillmentError =
          errorMsg.includes('Delivery checkout is not enabled') ||
          err?.code === 'INVALID_FULFILLMENT' ||
          err?.code === 'FULFILLMENT_NOT_SUPPORTED';

        if (isFulfillmentError) {
          console.warn('[useBasket] Delivery fulfillment not enabled, failing gracefully:', errorMsg);
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return;
        }

        if (err?.code === 'STORE_CLOSED') {
          console.warn('[useBasket] Store closed, failing gracefully:', errorMsg);
          setSnoozeWarning(errorMsg || 'This store cannot accept that order right now.');
          return;
        }

        console.warn('[useBasket] Failed to add multiple items to basket:', errorMsg);
        setSnoozeWarning(errorMsg || 'Could not add items to basket. Please try again.');
      }
    },
    [basket, activeStoreId, client, fulfillmentType, rememberBasket, selectedStore]
  );

  const removeItem = useCallback(
    async (plu: string, _targetStoreId?: string) => {
      if (!basket) return;
      try {
        const updated = await client.removeBasketItem(basket.id, plu);
        // Deliverect Commerce cannot PATCH an empty items array. The BFF treats
        // removal of the final line as basket exit; drop the local basket id so
        // the next add creates a fresh upstream basket instead of resurrecting
        // the old final line.
        rememberBasket(updated.items.length === 0 ? null : updated);

        defaultAnalyticsClient.track({
          type: 'REMOVE_FROM_BASKET',
          productPlu: plu,
          storeId: activeStoreId,
        });
      } catch (err: any) {
        console.warn('[useBasket] Failed to remove item:', err?.message || err);
      }
    },
    [basket, activeStoreId, client, rememberBasket]
  );

  /**
   * Swaps an out-of-stock/snoozed item with its chosen substitute.
   * Directly implements the customer substitution preference before checkout.
   */
  const swapBasketItem = useCallback(
    async (originalPlu: string, substitutePlu: string) => {
      if (!basket) return null;
      try {
        const originalItem = basket.items.find((i) => i.plu === originalPlu);
        const qty = originalItem ? originalItem.quantity : 1;

        // 1. Remove original
        let current = await client.removeBasketItem(basket.id, originalPlu);
        // 2. Add substitute with same quantity
        current = await client.updateBasketItem(current.id, substitutePlu, qty);

        setBasket(current);
        return current;
      } catch (err) {
        console.error('Failed to swap basket item:', err);
        return null;
      }
    },
    [basket, client]
  );

  /**
   * Automatically executes all available customer-selected substitute swaps.
   */
  const autoSwapSubstitutes = useCallback(async () => {
    if (!basket) return null;
    const audit = evaluateBasketSnoozeStatus(basket);
    if (!audit.availableSwaps || audit.availableSwaps.length === 0) return basket;

    let current = basket;
    for (const swap of audit.availableSwaps) {
      current = await client.removeBasketItem(current.id, swap.originalPlu);
      current = await client.updateBasketItem(current.id, swap.substitutePlu, swap.quantity);
    }
    setBasket(current);
    return current;
  }, [basket, client]);

  const updateItemSubstitution = useCallback(
    async (
      plu: string,
      preference: SubstitutionPreferenceType,
      preferredSubstitutePlu?: string,
      preferredSubstituteName?: string,
      preferredSubstitutePrice?: Money | number,
      _targetStoreId?: string
    ) => {
      if (!basket) return;

      try {
        if (client.setBasketItemSubstitution) {
          const priceMoney: Money | undefined =
            preferredSubstitutePrice !== undefined
              ? typeof preferredSubstitutePrice === 'object' && preferredSubstitutePrice !== null && 'amount' in preferredSubstitutePrice
                ? preferredSubstitutePrice
                : moneyFromMajor(Number(preferredSubstitutePrice) || 0, basket.currency)
              : undefined;

          const updated = await client.setBasketItemSubstitution(
            basket.id,
            plu,
            preference,
            undefined,
            preferredSubstitutePlu,
            preferredSubstituteName,
            priceMoney
          );
          setBasket(updated);
          return updated;
        }
      } catch (err: any) {
        console.warn('[useBasket] Failed to update basket item substitution:', err?.message || err);
      }
    },
    [basket, client]
  );

  const addBundleToBasket = useCallback(
    async (
      bundle: BundleProduct,
      selectedModifiers: SelectedBundleModifier[],
      quantity: number = 1,
      options?: { claimExistingBasketItems?: boolean }
    ) => {
      try {
        setSnoozeWarning(null);

        // Pre-emptively fail gracefully if delivery is requested:
        // Deliverect Commerce Basket API is collection-only until the Dispatch phase (docs/NORTH_STAR.md §11).
        if (fulfillmentType === 'delivery') {
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return null;
        }

        let currentBasket = basket;
        if (!currentBasket) {
          if (!activeStoreId) {
            console.warn('[useBasket] A store must be selected before creating a basket.');
            setSnoozeWarning('A store must be selected before adding items.');
            return null;
          }

          const openStatus = evaluateStoreOpenNow(selectedStore);
          if (!openStatus.isOpen) {
            if (selectedStore?.scheduling?.acceptsPreOrders === false) {
              setSnoozeWarning(
                `${selectedStore?.name || 'This store'} is closed right now and isn't accepting pre-orders.`
              );
              return null;
            }
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} is closed right now${
                openStatus.nextChangeText ? ` — your order will be prepared for collection when it ${openStatus.nextChangeText.toLowerCase()}` : ''
              }. You can choose a different time at checkout.`
            );
          }

          const supportsRequested = selectedStore?.supportsPickup;
          if (supportsRequested === false) {
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} doesn't offer collection right now.`
            );
            return null;
          }

          currentBasket = await client.createBasket(activeStoreId, fulfillmentType);
        }

        if (currentBasket && currentBasket.fulfillmentType === 'delivery') {
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return null;
        }

        if (client.addBundleToBasket) {
          const updated = await client.addBundleToBasket(
            currentBasket.id,
            bundle,
            selectedModifiers,
            quantity,
            options
          );
          rememberBasket(updated);

          defaultAnalyticsClient.track({
            type: 'ADD_TO_BASKET',
            productPlu: bundle.plu,
            storeId: activeStoreId,
          });

          return updated;
        } else {
          const currency = bundle.currency || currentBasket.currency || 'GBP';
          const computedPrice = calculateBundlePrice(bundle, selectedModifiers);
          const itemPrice: Money = toMoney(computedPrice.totalPriceMinor, currency);

          const subItems = selectedModifiers.map((mod, idx) => ({
            id: `${mod.modifierId}_${idx}`,
            modifierId: mod.modifierId,
            plu: mod.plu,
            name: mod.name,
            price: toMoney(mod.priceMinor || mod.price, currency),
            priceMinor: mod.priceMinor || mod.price,
            quantity: mod.quantity,
            sectionId: mod.sectionId,
            sectionName: mod.sectionName,
          }));

          const updated = await client.updateBasketItems(currentBasket.id, [
            {
              plu: bundle.plu,
              name: bundle.name,
              quantity: Math.max(1, quantity),
              price: itemPrice,
              isCombo: true,
              bundleId: bundle.id,
              bundlePlu: bundle.plu,
              bundleName: bundle.name,
              subItems,
            } as any,
          ]);
          rememberBasket(updated);

          defaultAnalyticsClient.track({
            type: 'ADD_TO_BASKET',
            productPlu: bundle.plu,
            storeId: activeStoreId,
          });

          return updated;
        }
      } catch (err: any) {
        const errorMsg = String(err?.message || err || '');
        const isFulfillmentError =
          errorMsg.includes('Delivery checkout is not enabled') ||
          err?.code === 'INVALID_FULFILLMENT' ||
          err?.code === 'FULFILLMENT_NOT_SUPPORTED';

        if (isFulfillmentError) {
          console.warn('[useBasket] Delivery fulfillment not enabled for bundle, failing gracefully:', errorMsg);
          setSnoozeWarning(
            'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
          );
          return null;
        }

        if (err?.code === 'STORE_CLOSED') {
          console.warn('[useBasket] Store closed for bundle, failing gracefully:', errorMsg);
          setSnoozeWarning(errorMsg || 'This store cannot accept that order right now.');
          return null;
        }

        console.warn('[useBasket] Failed to add bundle to basket:', errorMsg);
        setSnoozeWarning(errorMsg || 'Could not add bundle to basket. Please try again.');
        return null;
      }
    },
    [basket, activeStoreId, client, fulfillmentType, rememberBasket, selectedStore]
  );

  const getItemQuantity = useCallback(
    (plu: string): number => {
      const optimistic = optimisticQuantities[plu];
      if (optimistic !== undefined) return optimistic;
      const found = basket?.items.find((i) => i.plu === plu);
      return found ? found.quantity : 0;
    },
    [basket, optimisticQuantities]
  );

  // Total items count mirrors optimistic quantity intent while each serialized
  // server mutation is in flight, then settles to the authoritative basket.
  const totalItemsCount = useMemo(() => {
    const quantities = new Map<string, number>();
    (basket?.items || []).forEach((item) => quantities.set(item.plu, item.quantity));
    Object.entries(optimisticQuantities).forEach(([plu, quantity]) => {
      quantities.set(plu, quantity);
    });
    return Array.from(quantities.values()).reduce((sum, quantity) => sum + quantity, 0);
  }, [basket, optimisticQuantities]);

  const clearStoreSwitchDiff = () => {
    setStoreSwitchDiff(null);
  };

  const clearAllBaskets = () => {
    rememberBasket(null);
  };

  return {
    basket,
    allBaskets,
    isMultiLocation,
    loading,
    totalItemsCount,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    addMultipleItems,
    addBundleToBasket,
    removeItem,
    swapBasketItem,
    autoSwapSubstitutes,
    snoozeAudit,
    snoozeWarning,
    clearSnoozeWarning: () => setSnoozeWarning(null),
    updateItemSubstitution,
    getItemQuantity,
    clearAllBaskets,
    setBasket,
    storeSwitchDiff,
    clearStoreSwitchDiff,
  };
}
