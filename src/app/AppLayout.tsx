import React, { lazy, Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { defaultRuleEngine } from '../rules/RuleEngine';
import { visualRulesToRetailRules } from '../rules/visualRuleAdapter';
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
import { CmsPageScreen } from '../features/cms/CmsPageScreen';
import { StoryViewerModal } from '../features/stories/StoryViewerModal';
import { ProductDetailModal } from '../features/product/ProductDetailModal';
import { LocationPickerModal } from '../features/location/LocationPickerModal';
import { FulfilmentModal } from '../features/location/FulfilmentModal';
import { StorePickerModal } from '../features/stores/StorePickerModal';
import { StoreSwitchDiffModal } from '../features/stores/StoreSwitchDiffModal';
import { CartDrawerModal } from '../features/cart/CartDrawerModal';
import { BrandSplashScreen } from '../components/BrandSplashScreen';

const CheckoutModal = lazy(() =>
  import('../features/checkout/CheckoutModal').then((module) => ({ default: module.CheckoutModal }))
);
import { AislesModal } from '../features/catalog/AislesModal';
import { CatalogFilterState } from '../features/catalog/DietaryPreferencesModal';
import { MealDealDialog } from '../components/deals/MealDealDialog';
import { BundleSelectionDialog } from '../components/deals/BundleSelectionDialog';
import { DeliverectDeal, getDealForStory } from '../commerce/dealModels';
import { BundleProduct } from '../commerce/bundleModels';
import { Product, StoryAction } from '../commerce/models';
import { defaultAnalyticsClient, AnalyticsEventType } from '../analytics';
import { Loader2, BadgePercent, X, Store as StoreIcon, AlertTriangle } from 'lucide-react';
import {
  findCategoryByRouteSlug,
  flattenCategories,
  parseStorefrontRoute,
  pathForCategory,
  pathForProduct,
  pathForSearch,
  pathForTab,
  pushStorefrontUrl,
  replaceStorefrontUrl,
  type StorefrontRoute,
} from '../navigation/storefrontRouter';

interface AppLayoutProps {
  onOpenAdmin?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ onOpenAdmin }) => {
  const { tenant, loading: tenantLoading, error: tenantError, appMode } = useTenant();

  // Branded initial splash screen state
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // URL-backed storefront navigation. Route state is intentionally dependency-free
  // so branded web, Capacitor and notification deep links share the same URL contract.
  const initialRoute = parseStorefrontRoute();
  const initialTab: MobileTab =
    initialRoute.kind === 'search' ? 'search' :
    initialRoute.kind === 'orders' ? 'orders' :
    initialRoute.kind === 'account' ? 'account' :
    'home';

  const [activeRoute, setActiveRoute] = useState<StorefrontRoute>(initialRoute);
  const [activeTab, setActiveTab] = useState<MobileTab>(initialTab);

  const navigateToTab = useCallback((tab: MobileTab) => {
    const nextPath = pathForTab(tab);
    pushStorefrontUrl(nextPath);
    setActiveRoute(parseStorefrontRoute(new URL(nextPath, window.location.origin).pathname));
    if (tab === activeTab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveTab(tab);
  }, [activeTab]);

  // Never carry a deep scroll position into a different storefront section.
  // This also prevents the first Stories row being restored underneath the sticky header on mobile.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab]);

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
  const [catalogFilterState, setCatalogFilterState] = useState<CatalogFilterState>({
    onlyFavourites: false,
    onlyBuyAgain: false,
    selectedDietaryTags: [],
    excludedAllergens: [],
  });

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

  const isSelectingLocationOrProduct =
    isLocationModalOpen ||
    isStorePickerOpen ||
    isFulfilmentModalOpen ||
    selectedProduct !== null ||
    pendingStoreProductAdd !== null ||
    storePickerTargetProduct !== null ||
    entryStage === 'LOCATION' ||
    entryStage === 'FULFILMENT' ||
    entryStage === 'STORE_SELECTION';

  // Stories hook (filters stories based on selected store or nearby eligible stores)
  const {
    stories,
    loading: storiesLoading,
    activeStoryIndex,
    openStory,
    closeStory,
    nextStory,
    prevStory,
  } = useStories(selectedStore?.id, !isSelectingLocationOrProduct);

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

  // Track SESSION_STARTED and BRAND_VIEW when tenant is loaded
  React.useEffect(() => {
    if (tenant) {
      defaultAnalyticsClient.setContext(tenant.tenantId, tenant.locale || 'en-GB');
      defaultAnalyticsClient.track({
        type: AnalyticsEventType.SESSION_STARTED,
        properties: {
          tenantName: tenant.brandName,
        },
      });
      defaultAnalyticsClient.track({
        type: AnalyticsEventType.BRAND_VIEW,
        properties: {
          tenantId: tenant.tenantId,
          tenantName: tenant.brandName,
        },
      });
    }
  }, [tenant?.tenantId]);

  // Auto-launch Story index 0 on initial app load ONLY if not in location selection or product flows
  React.useEffect(() => {
    if (isSelectingLocationOrProduct) {
      sessionStorage.setItem('__retail_entry_story_shown', 'true');
      return;
    }

    if (entryStage === 'READY' && stories.length > 0) {
      const alreadyLaunched = sessionStorage.getItem('__retail_entry_story_shown');
      if (!alreadyLaunched) {
        sessionStorage.setItem('__retail_entry_story_shown', 'true');
        openStory(0);
        defaultAnalyticsClient.track({
          type: AnalyticsEventType.ENTRY_STORIES_STARTED,
          properties: {
            storyCount: stories.length,
            storyId: stories[0]?.id,
            storyTitle: stories[0]?.title,
          },
        });
      }
    }
  }, [
    entryStage,
    stories,
    openStory,
    isSelectingLocationOrProduct,
  ]);

  // Catalog hook (root vs store, arbitrary nested categories)
  const {
    catalog,
    products,
    renderableProducts,
    summaries,
    bundleSummaries,
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

  // Loads the tenant's admin-configured merchandising/visual rules into the
  // live RuleEngine singleton. Previously nothing ever called setRules(), so
  // every rule created in admin (hide product, age gates, quantity limits,
  // badges) had zero effect on the storefront regardless of configuration.
  useEffect(() => {
    let cancelled = false;
    client
      .getActiveRules?.()
      .then((rules) => {
        if (!cancelled) defaultRuleEngine.setRules(visualRulesToRetailRules(rules || []));
      })
      .catch((err: unknown) => console.warn('[AppLayout] Could not load active rules:', err));
    return () => {
      cancelled = true;
    };
  }, [client, tenant?.tenantId]);

  // Keeps the RuleEngine's ambient context (country/store/fulfillment) in
  // sync with the selected store, so country-scoped rules and per-store
  // evaluation actually have something real to match against — every real
  // call site (ProductCard, HomeScreen, checkout limits) evaluates with an
  // empty context otherwise.
  useEffect(() => {
    defaultRuleEngine.setDefaultContext({
      country: selectedStore?.geography?.country || selectedStore?.address?.country,
      nation: selectedStore?.geography?.nation,
      region: selectedStore?.geography?.region,
      county: selectedStore?.geography?.county,
      storeId: selectedStore?.id,
      fulfillmentType,
    });
  }, [
    selectedStore?.geography?.country,
    selectedStore?.geography?.nation,
    selectedStore?.geography?.region,
    selectedStore?.geography?.county,
    selectedStore?.address?.country,
    selectedStore?.id,
    fulfillmentType,
  ]);

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
  } = useBasket(selectedStore, fulfillmentType);

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

  const resolvingRouteRef = useRef<string | null>(null);

  const routeToProduct = useCallback((product: Product) => {
    const returnPath = window.location.pathname + window.location.search;
    setSelectedProduct(product);
    const path = pathForProduct(product);
    pushStorefrontUrl(path, { returnPath });
    setActiveRoute({ kind: 'product', plu: product.plu });
  }, []);

  const routeToCategory = useCallback((categoryId: string | null) => {
    navigateToCategory(categoryId);
    setActiveTab('home');

    if (!categoryId) {
      pushStorefrontUrl('/');
      setActiveRoute({ kind: 'home' });
      return;
    }

    const category = flattenCategories(catalog?.categories || []).find((item) => item.id === categoryId);
    if (category) {
      const path = pathForCategory(category);
      pushStorefrontUrl(path);
      setActiveRoute({ kind: 'aisle', slug: path.split('/').filter(Boolean)[1] || categoryId });
    }
  }, [catalog?.categories, navigateToCategory]);

  const routeToBasket = useCallback(() => {
    const returnPath = window.location.pathname + window.location.search;
    pushStorefrontUrl('/basket', { returnPath });
    setActiveRoute({ kind: 'basket' });
    setIsCartOpen(true);
  }, [setIsCartOpen]);

  const routeToCheckout = useCallback(() => {
    const returnPath = window.location.pathname + window.location.search;
    pushStorefrontUrl('/checkout', { returnPath });
    setActiveRoute({ kind: 'checkout' });
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }, [setIsCartOpen]);

  const closeRoutedOverlay = useCallback((kind: 'product' | 'basket' | 'checkout') => {
    if (activeRoute.kind !== kind) return;
    const returnPath =
      typeof window.history.state?.returnPath === 'string'
        ? window.history.state.returnPath
        : '/';

    setSelectedProduct(null);
    setIsCartOpen(false);
    setIsCheckoutOpen(false);
    replaceStorefrontUrl(returnPath);
    const returnRoute = parseStorefrontRoute(
      new URL(returnPath, window.location.origin).pathname,
      new URL(returnPath, window.location.origin).search
    );
    setActiveRoute(returnRoute);
    setActiveTab(
      returnRoute.kind === 'search' ? 'search' :
      returnRoute.kind === 'orders' ? 'orders' :
      returnRoute.kind === 'account' ? 'account' :
      'home'
    );
  }, [activeRoute.kind, setIsCartOpen]);

  const updateSearchQueryRoute = useCallback((query: string) => {
    setSearchQuery(query);
    if (activeRoute.kind === 'search' || activeTab === 'search') {
      const path = pathForSearch(query);
      replaceStorefrontUrl(path);
      setActiveRoute({ kind: 'search', query });
    }
  }, [activeRoute.kind, activeTab, setSearchQuery]);

  const routeToSearch = useCallback((query: string = '') => {
    setSearchQuery(query);
    const path = pathForSearch(query);
    pushStorefrontUrl(path);
    setActiveRoute({ kind: 'search', query });
    setActiveTab('search');
  }, [setSearchQuery]);

  useEffect(() => {
    const handlePopState = () => {
      const route = parseStorefrontRoute();
      setActiveRoute(route);

      if (route.kind === 'search') {
        setActiveTab('search');
        setSearchQuery(route.query);
      } else if (route.kind === 'orders') {
        setActiveTab('orders');
      } else if (route.kind === 'account') {
        setActiveTab('account');
      } else {
        setActiveTab('home');
      }

      setIsCartOpen(route.kind === 'basket');
      setIsCheckoutOpen(route.kind === 'checkout');
      if (route.kind !== 'product') setSelectedProduct(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setIsCartOpen, setSearchQuery]);

  useEffect(() => {
    if (activeRoute.kind === 'search') {
      setActiveTab('search');
      if (searchQuery !== activeRoute.query) setSearchQuery(activeRoute.query);
      return;
    }

    if (activeRoute.kind === 'orders') {
      setActiveTab('orders');
      return;
    }

    if (activeRoute.kind === 'account') {
      setActiveTab('account');
      return;
    }

    if (activeRoute.kind === 'basket') {
      setActiveTab('home');
      setIsCartOpen(true);
      return;
    }

    if (activeRoute.kind === 'checkout') {
      setActiveTab('home');
      setIsCartOpen(false);
      setIsCheckoutOpen(true);
      return;
    }

    if (activeRoute.kind === 'aisle') {
      setActiveTab('home');
      const category = findCategoryByRouteSlug(catalog?.categories || [], activeRoute.slug);
      if (category && selectedCategoryId !== category.id) {
        navigateToCategory(category.id);
      }
      return;
    }

    if (activeRoute.kind === 'product') {
      setActiveTab('home');
      if (selectedProduct?.plu === activeRoute.plu) return;

      const localMatch = [...products, ...searchResults, ...(catalog?.products || [])]
        .find((product) => product.plu === activeRoute.plu || product.canonicalPlu === activeRoute.plu);
      if (localMatch) {
        setSelectedProduct(localMatch);
        return;
      }

      if (resolvingRouteRef.current === activeRoute.plu) return;
      resolvingRouteRef.current = activeRoute.plu;

      void client
        .searchProducts(activeRoute.plu, selectedStore?.id, { limit: 20 })
        .then((result) => {
          const match = result.products.find(
            (product) => product.plu === activeRoute.plu || product.canonicalPlu === activeRoute.plu
          );
          if (match) setSelectedProduct(match);
        })
        .catch((err) => console.warn('[StorefrontRouter] Could not resolve product route:', err))
        .finally(() => {
          if (resolvingRouteRef.current === activeRoute.plu) resolvingRouteRef.current = null;
        });
      return;
    }

    if (activeRoute.kind === 'home') {
      setActiveTab('home');
    }
  }, [
    activeRoute,
    catalog?.categories,
    catalog?.products,
    client,
    navigateToCategory,
    products,
    searchQuery,
    searchResults,
    selectedCategoryId,
    selectedProduct?.plu,
    selectedStore?.id,
    setIsCartOpen,
    setSearchQuery,
  ]);

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
        routeToProduct(targetProd);
      }
    } else if (action.type === 'CATEGORY' && action.targetCategoryId) {
      routeToCategory(action.targetCategoryId);
    } else if (action.type === 'SEARCH' && action.searchQuery) {
      routeToSearch(action.searchQuery);
    } else if (action.type === 'OFFER') {
      if (action.targetPlu) {
        const targetProd = products.find((p) => p.plu === action.targetPlu);
        if (targetProd) routeToProduct(targetProd);
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
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-3 border border-gray-200 bg-white text-gray-800 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Retry Storefront
            </button>
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
        <div id="sticky-header-container" className="sticky top-0 z-40 isolate w-full max-w-full bg-white/95 backdrop-blur-md">
          {/* White-label Header */}
          <Header
            currentAddress={currentAddress}
            selectedStore={selectedStore}
            fulfillmentType={fulfillmentType}
            onFulfillmentChange={setFulfillmentType}
            onOpenLocationPicker={() => setIsLocationModalOpen(true)}
            onOpenStorePicker={() => setIsStorePickerOpen(true)}
            onOpenCart={routeToBasket}
            onOpenSearch={() => navigateToTab('search')}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              if (activeTab === 'orders' || activeTab === 'account') {
                navigateToTab('home');
              }
            }}
            cartItemCount={totalItemsCount}
            onOpenAdmin={onOpenAdmin}
            onNavigateTab={navigateToTab}
          />
        </div>

        {/* Tab Views */}
        <main className="w-full max-w-full">
          {activeTab === 'home' && activeRoute.kind !== 'cms' && (
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
              onSelectCategory={routeToCategory}
              onSelectProduct={routeToProduct}
              onUpdateQuantity={updateQuantity}
              getBasketQuantity={getItemQuantity}
              basketItems={basket?.items || []}
              searchQuery={searchQuery}
              onSearchChange={updateSearchQueryRoute}
              totalCatalogResults={searchResults}
              totalCatalogSummaries={searchSummaries}
              searchLoading={searchLoading}
              activeDealFilter={activeDealFilter}
              onFilterByDeal={handleFilterByDeal}
              onClearDealFilter={handleClearDealFilter}
              onOpenDealDialog={(deal) => setActiveDealForModal(deal)}
              bundles={catalog?.bundleCatalog?.bundles || []}
              bundleSummaries={bundleSummaries}
              onOpenBundleDialog={(bundle) => setActiveBundleForModal(bundle)}
              onAddItemsToBasket={handleAddAllToBasket}
              activeStores={activeStores}
              onSelectStore={selectStore}
              onOpenAislesModal={() => setIsAislesModalOpen(true)}
              catalogFilterState={catalogFilterState}
              onCatalogFilterStateChange={setCatalogFilterState}
            />
          )}

          {activeRoute.kind === 'cms' && (
            <CmsPageScreen
              slug={activeRoute.slug}
              products={catalog?.products || products}
              categories={catalog?.categories || []}
              onSelectProduct={routeToProduct}
              onSelectCategory={routeToCategory}
              onAddToCart={(product) => void updateQuantity(product, getItemQuantity(product.plu) + 1)}
            />
          )}

          {activeTab === 'search' && (
            <SearchScreen
              query={searchQuery}
              onQueryChange={updateSearchQueryRoute}
              results={searchResults}
              summaries={searchSummaries}
              loading={searchLoading}
              onSelectProduct={routeToProduct}
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
        onOpenCart={routeToBasket}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileNav
        activeTab={activeTab}
        onChangeTab={navigateToTab}
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
        onSelectProduct={routeToProduct}
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
          routeToProduct(p);
        }}
      />

      {/* Deliverect Combo Bundle Selection Dialog */}
      <BundleSelectionDialog
        bundle={activeBundleForModal}
        isOpen={activeBundleForModal !== null}
        onClose={() => setActiveBundleForModal(null)}
        selectedStoreName={selectedStore?.name}
        onAddBundleToBasket={async (bundle, selectedModifiers, quantity) => {
          if (!selectedStore) {
            setActiveBundleForModal(null);
            setIsStorePickerOpen(true);
            return;
          }
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
        onClose={() => closeRoutedOverlay('product')}
        onUpdateQuantity={updateQuantity}
        isStoreSelected={selectedStore !== null}
        onPromptSelectStore={() => {
          setStorePickerTargetProduct(selectedProduct);
          closeRoutedOverlay('product');
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
          sessionStorage.setItem('__retail_entry_story_shown', 'true');
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
        deliveryEnabled={tenant?.featureFlags?.enableCollection === false ? false : deliveryStores.length > 0}
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
        onSelectStore={(store) => {
          sessionStorage.setItem('__retail_entry_story_shown', 'true');
          selectStore(store);
        }}
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
        onClose={() => closeRoutedOverlay('basket')}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onSwapItem={swapBasketItem}
        onSwapAllSubstitutes={autoSwapSubstitutes}
        snoozeAudit={snoozeAudit}
        onUpdateSubstitution={updateItemSubstitution}
        onProceedToCheckout={routeToCheckout}
        onOpenDealPopup={(deal) => {
          setActiveDealForModal(deal);
        }}
        bundles={catalog?.bundleCatalog?.bundles || []}
        onOpenBundleDialog={(bundle) => {
          // Full bundle builder remains available for explicit catalogue bundle adds.
          setIsCartOpen(false);
          setActiveBundleForModal(bundle);
        }}
        onCompleteBundleOffer={async (offer) => {
          const missing = offer.missingComponents[0];
          if (!missing) return;
          const section = (offer.bundle.sections || offer.bundle.modifierGroups || []).find((candidate) => candidate.id === missing.sectionId);
          const modifier = section?.modifiers.find((candidate) => candidate.id === missing.modifierId);
          if (!section || !modifier) return;

          // Existing basket units are claimed into the allocation; only this final
          // missing unit is added by the server-side bundle mutation.
          await addBundleToBasket(
            offer.bundle,
            [
              ...offer.matchedSelections,
              {
                modifierId: modifier.id,
                plu: modifier.plu,
                name: modifier.name,
                quantity: 1,
                price: modifier.priceMinor ?? modifier.price ?? 0,
                priceMinor: modifier.priceMinor ?? modifier.price ?? 0,
                standalonePlu: modifier.standalonePlu,
                standalonePriceMinor: modifier.standalonePriceMinor,
                sectionId: section.id,
                sectionName: section.name,
              },
            ],
            1,
            { claimExistingBasketItems: true }
          );
        }}
        loading={basketLoading}
      />

      {/* All Aisles & Categories Directory Modal */}
      <AislesModal
        isOpen={isAislesModalOpen}
        onClose={() => setIsAislesModalOpen(false)}
        categories={catalog?.categories || []}
        products={catalog?.products || products}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={(catId) => {
          routeToCategory(catId);
          setIsAislesModalOpen(false);
        }}
        storeName={selectedStore?.name}
        filterState={catalogFilterState}
      />

      {/* Checkout Modal - mounted conditionally when open to guarantee consistent hook execution order */}
      {isCheckoutOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-50 grid place-items-center bg-white/70 text-sm text-gray-500">Loading checkout…</div>}>
        <CheckoutModal
          isOpen={isCheckoutOpen}
          basket={basket}
          store={selectedStore}
          deliveryAddress={currentAddress}
          onClose={() => closeRoutedOverlay('checkout')}
          onStoreSwitched={selectStore}
          onBasketUpdated={setBasket}
          onOpenDealPopup={(deal) => {
            setActiveDealForModal(deal);
          }}
          onOrderSuccess={() => {
            clearAllBaskets();
            closeRoutedOverlay('checkout');
          }}
        />
        </Suspense>
      )}
    </div>
  );
};
