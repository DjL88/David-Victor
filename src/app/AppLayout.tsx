import React, { useState, useCallback } from 'react';
import { useTenant } from '../tenant/TenantContext';
import { useLocationAndStores } from '../hooks/useLocationAndStores';
import { useStories } from '../hooks/useStories';
import { useCatalog } from '../hooks/useCatalog';
import { useBasket } from '../hooks/useBasket';
import { useProductSearch } from '../hooks/useProductSearch';
import { Header } from '../components/Header';
import { MobileNav, MobileTab } from '../components/MobileNav';
import { FloatingCartBar } from '../components/FloatingCartBar';
import { HomeScreen } from '../features/home/HomeScreen';
import { SearchScreen } from '../features/search/SearchScreen';
import { OrdersScreen } from '../features/orders/OrdersScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { StoryViewerModal } from '../features/stories/StoryViewerModal';
import { ProductDetailModal } from '../features/product/ProductDetailModal';
import { LocationPickerModal } from '../features/location/LocationPickerModal';
import { FulfilmentModal } from '../features/location/FulfilmentModal';
import { StorePickerModal } from '../features/stores/StorePickerModal';
import { StoreSwitchDiffModal } from '../features/stores/StoreSwitchDiffModal';
import { CartDrawerModal } from '../features/cart/CartDrawerModal';
import { CheckoutModal } from '../features/checkout/CheckoutModal';
import { BrandSplashScreen } from '../components/BrandSplashScreen';
import { AislesModal } from '../features/catalog/AislesModal';
import { MealDealDialog } from '../components/deals/MealDealDialog';
import { BundleSelectionDialog } from '../components/deals/BundleSelectionDialog';
import { DeliverectDeal, getDealForStory } from '../commerce/dealModels';
import { BundleProduct } from '../commerce/bundleModels';
import { Product, StoryAction } from '../commerce/models';
import { defaultAnalyticsClient, AnalyticsEventType } from '../analytics';
import { Loader2, BadgePercent, X, Store as StoreIcon, AlertTriangle } from 'lucide-react';

interface AppLayoutProps {
  onOpenAdmin?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ onOpenAdmin }) => {
  const { tenant, loading: tenantLoading, error: tenantError, appMode } = useTenant();

  // Branded initial splash screen state
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<MobileTab>('home');

  // Selected product detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [storePickerTargetProduct, setStorePickerTargetProduct] = useState<Product | null>(null);
  const [pendingStoreProductAdd, setPendingStoreProductAdd] = useState<{ storeId: string; product: Product } | null>(null);

  // Deliverect Deal modal & filter states
  const [activeDealForModal, setActiveDealForModal] = useState<DeliverectDeal | null>(null);
  const [activeDealFilter, setActiveDealFilter] = useState<DeliverectDeal | null>(null);
  const [activeBundleForModal, setActiveBundleForModal] = useState<BundleProduct | null>(null);
  const [dealToastMessage, setDealToastMessage] = useState<string | null>(null);

  // Session-level age acknowledgements (e.g. 18+, 16+)
  const [sessionAgeAcknowledged, setSessionAgeAcknowledged] = useState<Record<number, boolean>>({});

  const handleAcknowledgeAge = (minAge: number) => {
    setSessionAgeAcknowledged((prev) => ({ ...prev, [minAge]: true }));
  };

  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  // Aisles Directory Modal
  const [isAislesModalOpen, setIsAislesModalOpen] = useState<boolean>(false);

  // Location & Store management
  const {
    entryStage,
    currentAddress,
    coordinates,
    hasLocation,
    nearbyStores,
    allStores,
    activeStores,
    deliveryStores,
    collectionStores,
    selectedStore,
    fulfillmentType,
    setFulfillmentType,
    hasDeliveryCoverage,
    loading: storesLoading,
    isLocationModalOpen,
    setIsLocationModalOpen,
    isStorePickerOpen,
    setIsStorePickerOpen,
    isFulfilmentModalOpen,
    setIsFulfilmentModalOpen,
    resolveAndSetLocation,
    selectStore,
  } = useLocationAndStores();

  // Stories hook (filters stories based on selected store or nearby eligible stores)
  const {
    stories,
    loading: storiesLoading,
    activeStoryIndex,
    openStory,
    closeStory,
    nextStory,
    prevStory,
  } = useStories(selectedStore?.id);

  // Auto-prompt location picker when initial splash completes and customer has no location yet (guarded by location_prompted and location_prompt_dismissed)
  React.useEffect(() => {
    if (!showSplash && entryStage === 'LOCATION' && !hasLocation) {
      const prompted = localStorage.getItem('location_prompted');
      const dismissed = localStorage.getItem('location_prompt_dismissed');
      if (!prompted && !dismissed) {
        localStorage.setItem('location_prompted', 'true');
        setIsLocationModalOpen(true);
      }
    }
  }, [showSplash, entryStage, hasLocation, setIsLocationModalOpen]);

  // Catalog hook (root vs store, arbitrary nested categories)
  const {
    catalog,
    products,
    renderableProducts,
    summaries,
    selectedCategoryId,
    currentSubcategories,
    breadcrumbs,
    loading: catalogLoading,
    error: catalogError,
    navigateToCategory,
    refreshCatalog,
    resetCache,
    client,
  } = useCatalog(selectedStore?.id);

  // Basket hook (authoritative BFF basket, quantity adjustments, store-switch diff)
  const {
    basket,
    allBaskets,
    isMultiLocation,
    loading: basketLoading,
    totalItemsCount,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    addMultipleItems,
    removeItem,
    swapBasketItem,
    autoSwapSubstitutes,
    snoozeAudit,
    snoozeWarning,
    clearSnoozeWarning,
    setBasket,
    updateItemSubstitution,
    getItemQuantity,
    clearAllBaskets,
    storeSwitchDiff,
    clearStoreSwitchDiff,
    addBundleToBasket,
  } = useBasket(selectedStore);

  React.useEffect(() => {
    if (!pendingStoreProductAdd || selectedStore?.id !== pendingStoreProductAdd.storeId) return;
    const product = pendingStoreProductAdd.product;
    setPendingStoreProductAdd(null);
    setIsStorePickerOpen(false);
    setStorePickerTargetProduct(null);
    void updateQuantity(product, 1);
  }, [pendingStoreProductAdd, selectedStore?.id, updateQuantity, setIsStorePickerOpen]);

  // Product search hook
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    summaries: searchSummaries,
    loading: searchLoading,
  } = useProductSearch(selectedStore?.id);

  // Handle adding all items for an 'AND' deal or meal deal
  const handleAddAllToBasket = async (plus: string[], dealTitle?: string) => {
    if (!plus || plus.length === 0) return;

    if (!selectedStore) {
      setIsStorePickerOpen(true);
      return;
    }

    const itemsToAdd: Array<{ product: Product; quantity?: number }> = [];
    for (const plu of plus) {
      const prod = products.find((p) => p.plu === plu);
      if (prod) {
        itemsToAdd.push({ product: prod, quantity: 1 });
      }
    }

    if (itemsToAdd.length > 0) {
      await addMultipleItems(itemsToAdd);
      setDealToastMessage(
        `Added all ${itemsToAdd.length} items for "${dealTitle || 'Meal Deal'}" to your basket!`
      );
      setTimeout(() => setDealToastMessage(null), 4500);
    }
  };

  // Handle filtering catalog by a deal
  const handleFilterByDeal = (deal: DeliverectDeal) => {
    setActiveDealFilter(deal);
    setActiveTab('home');
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  const handleClearDealFilter = () => {
    setActiveDealFilter(null);
  };

  const handleResetCache = useCallback(async () => {
    try {
      if (typeof client.resetCache === 'function') {
        await client.resetCache();
      } else {
        await fetch('/api/v1/cache/reset', { method: 'POST' });
      }
      sessionStorage.clear();
      localStorage.removeItem('cached_catalog');
      window.dispatchEvent(new CustomEvent('catalog-cache-reset'));
      await refreshCatalog();
      setDealToastMessage('Cache reset & live Deliverect catalog synced successfully!');
      setTimeout(() => setDealToastMessage(null), 4000);
    } catch (err) {
      console.error('Failed to reset cache:', err);
    }
  }, [client, refreshCatalog]);

  // Handle Story Action (Product, Category, Search, Offer)
  const handleStoryAction = (action?: StoryAction) => {
    if (!action) return;
    if (action.type === 'PRODUCT' && action.targetPlu) {
      const targetProd = products.find((p) => p.plu === action.targetPlu);
      if (targetProd) {
        setSelectedProduct(targetProd);
      }
    } else if (action.type === 'CATEGORY' && action.targetCategoryId) {
      navigateToCategory(action.targetCategoryId);
      setActiveTab('home');
    } else if (action.type === 'SEARCH' && action.searchQuery) {
      setSearchQuery(action.searchQuery);
      setActiveTab('search');
    } else if (action.type === 'OFFER') {
      if (action.targetPlu) {
        const targetProd = products.find((p) => p.plu === action.targetPlu);
        if (targetProd) setSelectedProduct(targetProd);
      }
    }
  };

  // If tenant resolution completes and no tenant is resolved in live staging/production
  if (!tenantLoading && !tenant && appMode !== 'demo') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <StoreIcon className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Storefront Unavailable</h1>
          <p className="text-sm text-gray-600 mb-6">
            {tenantError || `No active brand or storefront is mapped to "${window.location.hostname}".`}
          </p>
          <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3 border border-gray-100 mb-6 font-mono break-all">
            Domain: {window.location.hostname}
          </div>
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Open Platform Admin
            </button>
          )}
        </div>
      </div>
    );
  }

  // Initial Branded Splash Loading State
  if (showSplash) {
    return (
      <BrandSplashScreen
        tenant={tenant}
        onFinish={() => setShowSplash(false)}
      />
    );
  }

  return (
    <div
      id="app-root-layout"
      className="min-h-screen w-full bg-gray-50 text-gray-900 flex flex-col justify-between selection:bg-emerald-500 selection:text-white"
    >
      <div className="w-full">
        {/* Sticky/Frozen Header Wrapper across Mobile and Desktop */}
        <div id="sticky-header-container" className="sticky top-0 z-40 w-full max-w-full bg-white/95 backdrop-blur-md">
          {/* White-label Header */}
          <Header
            currentAddress={currentAddress}
            selectedStore={selectedStore}
            fulfillmentType={fulfillmentType}
            onFulfillmentChange={setFulfillmentType}
            onOpenLocationPicker={() => setIsLocationModalOpen(true)}
            onOpenStorePicker={() => setIsStorePickerOpen(true)}
            onOpenCart={() => setIsCartOpen(true)}
            onOpenSearch={() => setActiveTab('search')}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              if (activeTab === 'orders' || activeTab === 'account') {
                setActiveTab('home');
              }
            }}
            cartItemCount={totalItemsCount}
            onOpenAdmin={onOpenAdmin}
          />
        </div>

        {/* Tab Views */}
        <main className="w-full max-w-full">
          {activeTab === 'home' && (
            <HomeScreen
              stories={stories}
              storiesLoading={storiesLoading}
              onSelectStory={openStory}
              products={renderableProducts}
              summaries={summaries}
              productsLoading={catalogLoading}
              catalogError={catalogError}
              onRetryCatalog={refreshCatalog}
              selectedStore={selectedStore}
              onOpenStorePicker={(product?: Product) => {
                setStorePickerTargetProduct(product || null);
                setIsStorePickerOpen(true);
              }}
              categories={currentSubcategories}
              breadcrumbs={breadcrumbs}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={navigateToCategory}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onUpdateQuantity={updateQuantity}
              getBasketQuantity={getItemQuantity}
              basketItems={basket?.items || []}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              totalCatalogResults={searchResults}
              totalCatalogSummaries={searchSummaries}
              searchLoading={searchLoading}
              activeDealFilter={activeDealFilter}
              onFilterByDeal={handleFilterByDeal}
              onClearDealFilter={handleClearDealFilter}
              onOpenDealDialog={(deal) => setActiveDealForModal(deal)}
              bundles={catalog?.bundleCatalog?.bundles || []}
              onOpenBundleDialog={(bundle) => setActiveBundleForModal(bundle)}
              onAddItemsToBasket={handleAddAllToBasket}
              activeStores={activeStores}
              onSelectStore={selectStore}
              onOpenAislesModal={() => setIsAislesModalOpen(true)}
            />
          )}

          {activeTab === 'search' && (
            <SearchScreen
              query={searchQuery}
              onQueryChange={setSearchQuery}
              results={searchResults}
              summaries={searchSummaries}
              loading={searchLoading}
              onSelectProduct={(p) => setSelectedProduct(p)}
              onUpdateQuantity={updateQuantity}
              isStoreSelected={selectedStore !== null}
              onPromptSelectStore={(product?: Product) => {
                setStorePickerTargetProduct(product || null);
                setIsStorePickerOpen(true);
              }}
              getBasketQuantity={getItemQuantity}
              basketItems={basket?.items || []}
            />
          )}

          {activeTab === 'orders' && <OrdersScreen />}

          {activeTab === 'account' && <AccountScreen onOpenAdmin={onOpenAdmin} />}
        </main>
      </div>

      {/* Floating Persistent Cart Bar (when items in cart) */}
      <FloatingCartBar
        basket={basket}
        allBaskets={allBaskets}
        isMultiLocation={isMultiLocation}
        itemCount={totalItemsCount}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenAisles={() => setIsAislesModalOpen(true)}
      />

      {/* Story Fullscreen Viewer Modal */}
      <StoryViewerModal
        stories={stories}
        currentIndex={activeStoryIndex}
        onClose={closeStory}
        onNext={nextStory}
        onPrev={prevStory}
        onStoryAction={handleStoryAction}
        products={products}
        selectedStoreName={selectedStore?.name}
        onSelectProduct={(p) => setSelectedProduct(p)}
        onOpenDealDialog={(story) => {
          closeStory();
          const deal = getDealForStory(story, products);
          if (deal) setActiveDealForModal(deal);
        }}
        onFilterByDeal={(story) => {
          closeStory();
          const deal = getDealForStory(story, products);
          if (deal) handleFilterByDeal(deal);
        }}
        onAddItemsToBasket={handleAddAllToBasket}
      />

      {/* Deliverect Meal Deal & Multi-Buy Dialog */}
      <MealDealDialog
        deal={activeDealForModal}
        isOpen={activeDealForModal !== null}
        onClose={() => setActiveDealForModal(null)}
        products={products}
        onAddAllToBasket={(plus, dealTitle) => {
          handleAddAllToBasket(plus, dealTitle);
          setActiveDealForModal(null);
        }}
        onFilterByDeal={(deal) => {
          handleFilterByDeal(deal);
          setActiveDealForModal(null);
        }}
        onSelectProduct={(p) => {
          setActiveDealForModal(null);
          setSelectedProduct(p);
        }}
      />

      {/* Deliverect Combo Bundle Selection Dialog */}
      <BundleSelectionDialog
        bundle={activeBundleForModal}
        isOpen={activeBundleForModal !== null}
        onClose={() => setActiveBundleForModal(null)}
        onAddBundleToBasket={async (bundle, selectedModifiers, quantity) => {
          await addBundleToBasket(bundle, selectedModifiers, quantity);
          setActiveBundleForModal(null);
          setDealToastMessage(`Added "${bundle.name}" meal combo to your basket!`);
          setTimeout(() => setDealToastMessage(null), 4500);
        }}
      />

      {/* Deal Toast Notification Banner */}
      {dealToastMessage && (
        <div
          id="deal-toast-notification"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-emerald-950 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-emerald-500/40 flex items-center gap-2.5 max-w-[90vw] animate-bounce"
        >
          <BadgePercent className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 truncate">{dealToastMessage}</span>
          <button
            type="button"
            onClick={() => setDealToastMessage(null)}
            className="p-1 text-emerald-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Real-time Snooze / Out of Stock Toast Alert */}
      {snoozeWarning && (
        <div
          id="snooze-warning-toast"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-amber-950 text-white text-xs font-bold shadow-2xl backdrop-blur-md border border-amber-500/50 flex items-center gap-2.5 max-w-[90vw] animate-bounce"
        >
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="flex-1">{snoozeWarning}</span>
          <button
            type="button"
            onClick={clearSnoozeWarning}
            className="p-1 text-amber-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        availabilitySummary={selectedProduct ? (searchSummaries[selectedProduct.plu] || summaries[selectedProduct.plu]) : undefined}
        basketQuantity={selectedProduct ? getItemQuantity(selectedProduct.plu) : 0}
        basketItems={basket?.items || []}
        sessionAgeAcknowledged={sessionAgeAcknowledged}
        onAcknowledgeAge={handleAcknowledgeAge}
        onClose={() => setSelectedProduct(null)}
        onUpdateQuantity={updateQuantity}
        isStoreSelected={selectedStore !== null}
        onPromptSelectStore={() => {
          setStorePickerTargetProduct(selectedProduct);
          setSelectedProduct(null);
          setIsStorePickerOpen(true);
        }}
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        isOpen={isLocationModalOpen}
        currentAddress={currentAddress}
        coordinates={coordinates}
        stores={nearbyStores.length > 0 ? nearbyStores : allStores}
        onClose={() => {
          localStorage.setItem('location_prompt_dismissed', 'true');
          localStorage.setItem('location_prompted', 'true');
          setIsLocationModalOpen(false);
        }}
        onSelectAddress={async (q) => {
          await resolveAndSetLocation(q);
        }}
        loading={storesLoading}
      />

      {/* Fulfilment Choice Modal */}
      <FulfilmentModal
        isOpen={isFulfilmentModalOpen}
        currentAddress={currentAddress}
        deliveryStoresCount={deliveryStores.length}
        collectionStoresCount={collectionStores.length}
        hasDeliveryCoverage={hasDeliveryCoverage}
        onSelectFulfillment={(mode) => setFulfillmentType(mode)}
        onClose={() => setIsFulfilmentModalOpen(false)}
        dismissible={true}
      />

      {/* Store Picker Modal */}
      <StorePickerModal
        isOpen={isStorePickerOpen}
        stores={nearbyStores.length > 0 ? nearbyStores : allStores}
        selectedStore={selectedStore}
        userCoordinates={coordinates}
        userAddress={currentAddress}
        onSelectStore={selectStore}
        onClose={() => {
          setIsStorePickerOpen(false);
          setStorePickerTargetProduct(null);
        }}
        loading={storesLoading}
        targetProduct={storePickerTargetProduct}
        onAddProductFromStore={(store, product) => {
          setPendingStoreProductAdd({ storeId: store.id, product });
          selectStore(store);
        }}
      />

      {/* Store Switch Reconciliation Diff Modal */}
      <StoreSwitchDiffModal
        diff={storeSwitchDiff}
        onConfirm={clearStoreSwitchDiff}
        onClose={clearStoreSwitchDiff}
      />

      {/* Cart Drawer Modal */}
      <CartDrawerModal
        isOpen={isCartOpen}
        basket={basket}
        candidateProducts={products}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onSwapItem={swapBasketItem}
        onSwapAllSubstitutes={autoSwapSubstitutes}
        snoozeAudit={snoozeAudit}
        onUpdateSubstitution={updateItemSubstitution}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
        onOpenDealPopup={(deal) => {
          setActiveDealForModal(deal);
        }}
        loading={basketLoading}
      />

      {/* All Aisles & Categories Directory Modal */}
      <AislesModal
        isOpen={isAislesModalOpen}
        onClose={() => setIsAislesModalOpen(false)}
        categories={catalog?.categories || []}
        products={products}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={(catId) => {
          navigateToCategory(catId);
          setActiveTab('home');
          setIsAislesModalOpen(false);
        }}
        storeName={selectedStore?.name}
      />

      {/* Checkout Modal - mounted conditionally when open to guarantee consistent hook execution order */}
      {isCheckoutOpen && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          basket={basket}
          store={selectedStore}
          deliveryAddress={currentAddress}
          onClose={() => setIsCheckoutOpen(false)}
          onStoreSwitched={selectStore}
          onBasketUpdated={setBasket}
          onOpenDealPopup={(deal) => {
            setActiveDealForModal(deal);
          }}
          onOrderSuccess={() => {
            clearAllBaskets();
            setIsCheckoutOpen(false);
          }}
        />
      )}
    </div>
  );
};
