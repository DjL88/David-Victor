import { useState, useEffect, useCallback, useMemo } from 'react';
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
    setBasket(nextBasket);
    if (!basketStorageKey) return;
    if (nextBasket?.id) localStorage.setItem(basketStorageKey, nextBasket.id);
    else localStorage.removeItem(basketStorageKey);
  }, [basketStorageKey]);

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
      .catch((err) => console.error('Failed to refresh basket availability:', err));
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
      } catch (err) {
        console.error('Failed to sync basket with store:', err);
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

        let currentBasket = basket;
        if (!currentBasket) {
          if (!activeStoreId) {
            throw new Error('A store must be selected before creating a basket.');
          }
          // Deliverect rejects basket creation with a raw 422 ("Fulfillment time is
          // invalid...") when the store is currently closed and no future pickup/
          // delivery time is offered yet. Check first so the customer gets an honest,
          // friendly message instead of a raw upstream error.
          const openStatus = evaluateStoreOpenNow(selectedStore);
          if (!openStatus.isOpen) {
            const reasonMsg = `${selectedStore?.name || 'This store'} is closed right now${
              openStatus.nextChangeText ? ` — ${openStatus.nextChangeText.toLowerCase()}` : ''
            }.`;
            setSnoozeWarning(reasonMsg);
            return { success: false, reason: 'STORE_CLOSED' };
          }
          // Same idea for fulfillment type: some Commerce stores only support one of
          // delivery/pickup. The BFF enforces this too (server/api/v1Router.ts
          // POST /baskets), but checking client-side avoids a round trip to a
          // guaranteed-to-fail request.
          const supportsRequested =
            fulfillmentType === 'delivery' ? selectedStore?.supportsDelivery : selectedStore?.supportsPickup;
          if (supportsRequested === false) {
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} doesn't offer ${fulfillmentType === 'delivery' ? 'delivery' : 'collection'} right now.`
            );
            return { success: false, reason: 'FULFILLMENT_NOT_SUPPORTED' };
          }
          currentBasket = await client.createBasket(activeStoreId, fulfillmentType);
        }

        const previousQty =
          currentBasket.items.find((i) => i.plu === product.plu)?.quantity || 0;

        // Lifecycle check on Add To Basket:
        // Verify snooze/availability before increasing quantity
        if (newQuantity > previousQty) {
          const snoozeStatus = checkProductSnooze(activeStoreId, product.plu);
          if (!snoozeStatus.isAvailable) {
            const reasonMsg = snoozeStatus.isSnoozed
              ? `"${product.name}" is temporarily snoozed and cannot be ordered right now.`
              : `"${product.name}" is currently out of stock at this store.`;
            setSnoozeWarning(reasonMsg);
            return { success: false, reason: snoozeStatus.reason, isSnoozed: snoozeStatus.isSnoozed };
          }
        }

        const updatedBasket = await client.updateBasketItem(
          currentBasket.id,
          product.plu,
          newQuantity
        );

        rememberBasket(updatedBasket);

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
      } catch (err) {
        console.error('Failed to update basket item:', err);
        return { success: false };
      }
    },
    [basket, activeStoreId, client, rememberBasket, selectedStore]
  );

  const addMultipleItems = useCallback(
    async (
      itemsToAdd: Array<{ product: Product; quantity?: number }>,
      _targetStoreId?: string
    ) => {
      try {
        if (!activeStoreId) {
          console.warn('[useBasket] A store must be selected before adding items to the basket.');
          return;
        }

        let currentBasket = basket;
        if (!currentBasket) {
          const openStatus = evaluateStoreOpenNow(selectedStore);
          if (!openStatus.isOpen) {
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} is closed right now${
                openStatus.nextChangeText ? ` — ${openStatus.nextChangeText.toLowerCase()}` : ''
              }.`
            );
            return;
          }
          const supportsRequested =
            fulfillmentType === 'delivery' ? selectedStore?.supportsDelivery : selectedStore?.supportsPickup;
          if (supportsRequested === false) {
            setSnoozeWarning(
              `${selectedStore?.name || 'This store'} doesn't offer ${fulfillmentType === 'delivery' ? 'delivery' : 'collection'} right now.`
            );
            return;
          }
          currentBasket = await client.createBasket(activeStoreId, fulfillmentType);
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
      } catch (err) {
        console.error('Failed to add multiple items to basket:', err);
      }
    },
    [basket, activeStoreId, client, rememberBasket, selectedStore]
  );

  const removeItem = useCallback(
    async (plu: string, _targetStoreId?: string) => {
      if (!basket) return;
      try {
        const updated = await client.removeBasketItem(basket.id, plu);
        rememberBasket(updated);

        defaultAnalyticsClient.track({
          type: 'REMOVE_FROM_BASKET',
          productPlu: plu,
          storeId: activeStoreId,
        });
      } catch (err) {
        console.error('Failed to remove item:', err);
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
      } catch (err) {
        console.error('Failed to update basket item substitution:', err);
      }
    },
    [basket, client]
  );

  const addBundleToBasket = useCallback(
    async (
      bundle: BundleProduct,
      selectedModifiers: SelectedBundleModifier[],
      quantity: number = 1
    ) => {
      try {
        setSnoozeWarning(null);

        let currentBasket = basket;
        if (!currentBasket) {
          if (!activeStoreId) {
            throw new Error('A store must be selected before creating a basket.');
          }
          currentBasket = await client.createBasket(activeStoreId, fulfillmentType);
        }

        if (client.addBundleToBasket) {
          const updated = await client.addBundleToBasket(
            currentBasket.id,
            bundle,
            selectedModifiers,
            quantity
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
      } catch (err) {
        console.error('Failed to add bundle to basket:', err);
      }
    },
    [basket, activeStoreId, client]
  );

  const getItemQuantity = useCallback(
    (plu: string): number => {
      if (!basket) return 0;
      const found = basket.items.find((i) => i.plu === plu);
      return found ? found.quantity : 0;
    },
    [basket]
  );

  // Total items count in the active store basket
  const totalItemsCount = useMemo(() => {
    if (!basket || !basket.items) return 0;
    return basket.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [basket]);

  const clearStoreSwitchDiff = () => {
    setStoreSwitchDiff(null);
  };

  const clearAllBaskets = () => {
    setBasket(null);
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
