import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Address, Store } from '../commerce/models';
import { CmsPage } from '../commerce/cmsModels';
import { useTenant } from '../tenant/TenantContext';
import { useTenantStyles } from '../tenant/useTenant';
import { useI18n } from '../i18n/I18nContext';
import { auth, onAuthStateChanged, User as FirebaseUser } from '../firebase';
import {
  MapPin,
  Store as StoreIcon,
  ChevronDown,
  ShoppingBag,
  Truck,
  Package,
  User,
  Clock,
  Heart,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

interface HeaderProps {
  currentAddress: Address | null;
  selectedStore: Store | null;
  fulfillmentType: 'delivery' | 'pickup';
  onFulfillmentChange: (type: 'delivery' | 'pickup') => void;
  onOpenLocationPicker: () => void;
  onOpenStorePicker: () => void;
  onOpenCart: () => void;
  onOpenSearch?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  cartItemCount: number;
  onOpenAdmin?: () => void;
  onNavigateTab?: (tab: 'home' | 'search' | 'orders' | 'account') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentAddress,
  selectedStore,
  fulfillmentType,
  onFulfillmentChange,
  onOpenLocationPicker,
  onOpenStorePicker,
  onOpenCart,
  cartItemCount,
  onOpenAdmin,
  onNavigateTab,
}) => {
  const { tenant, appMode } = useTenant();
  const { primaryBtnStyle } = useTenantStyles();
  const { locale, t } = useI18n();
  // Delivery checkout is not yet wired to the real Deliverect basket path outside demo
  // mode (see docs/NORTH_STAR.md §11); gate the toggle so customers can't select a
  // fulfilment type that will fail at add-to-basket/checkout time.
  const deliveryFulfillmentEnabled = appMode === 'demo';
  const headerRef = useRef<HTMLElement>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [allHeaderPages, setAllHeaderPages] = useState<CmsPage[]>([]);

  useEffect(() => {
    fetch('/api/v1/cms/pages')
      .then((res) => res.ok ? res.json() : { pages: [] })
      .then((data) => {
        const pages = (data.pages || []) as CmsPage[];
        setAllHeaderPages(pages);
      })
      .catch(() => setAllHeaderPages([]));
  }, [tenant?.tenantId]);

  const headerPages = useMemo(() => {
    const eligible = allHeaderPages.filter(
      (page) => page.status === 'published' && ['header', 'both'].includes(page.navigationVisibility)
    );
    const bySlug = new Map<string, CmsPage[]>();
    eligible.forEach((page) => {
      const group = bySlug.get(page.slug) || [];
      group.push(page);
      bySlug.set(page.slug, group);
    });
    return Array.from(bySlug.values())
      .map((group) =>
        group.find((page) => page.locale === locale) ||
        group.find((page) => page.locale === tenant?.locale) ||
        group.find((page) => page.locale === 'en-GB') ||
        group[0]
      )
      .filter((page): page is CmsPage => Boolean(page))
      .sort((a, b) => (a.navigationOrder ?? 999) - (b.navigationOrder ?? 999));
  }, [allHeaderPages, locale, tenant?.locale]);

  const openCmsPage = (page: CmsPage) => {
    sessionStorage.setItem('__cms_page_slug', page.slug);
    onNavigateTab?.('account');
  };

  // Subscribe to Firebase Auth for real customer identity
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Close account dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    if (isAccountMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAccountMenuOpen]);

  return (
    <header
      ref={headerRef}
      id="main-storefront-header"
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs w-full max-w-full"
    >
      {/* Main Brand, Location, Search, Account & Basket Row */}
      <div className="w-full max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        {/* Brand Logo & Name */}
        <div
          onClick={() => onNavigateTab?.('home')}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <div
            className={`${tenant?.headerLogoMode === 'ICON_WITH_TEXT' || !tenant?.headerLogoMode ? 'w-9' : ''} h-9 overflow-hidden flex items-center justify-center shrink-0`}
            style={tenant?.headerLogoMode && tenant.headerLogoMode !== 'ICON_WITH_TEXT' ? { width: Math.min(tenant.headerLogoMaxWidth || 160, 240) } : undefined}
          >
            <img
              src={tenant?.headerLogoMode === 'ICON_WITH_TEXT' || !tenant?.headerLogoMode ? (tenant?.faviconUrl || tenant?.iconUrl || tenant?.logoUrl) : tenant?.logoUrl}
              alt={tenant?.brandName}
              className="w-full h-full object-contain"
            />
          </div>
          {(tenant?.headerLogoMode === 'ICON_WITH_TEXT' || !tenant?.headerLogoMode) && <div>
            <span className="text-base font-black text-gray-900 leading-tight block">
              {tenant?.brandName}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 block truncate max-w-[110px] sm:max-w-none">
              {tenant?.tagline}
            </span>
          </div>}
        </div>

        {/* Location & Store Selectors (Tablet / Desktop) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {/* Address Button */}
          <button
            type="button"
            id="header-location-btn"
            onClick={onOpenLocationPicker}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200/80 text-xs font-bold text-gray-800 transition-colors cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-gray-700 shrink-0" />
            <span className="max-w-[120px] lg:max-w-[150px] truncate">
              {currentAddress?.line1 || t('header.setLocation')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {/* Store Selector Button */}
          <button
            type="button"
            id="header-store-btn"
            onClick={onOpenStorePicker}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              selectedStore
                ? 'bg-gray-100 border-gray-300 text-gray-900'
                : 'bg-gray-50 border-gray-200 text-gray-700'
            }`}
          >
            <StoreIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="max-w-[130px] lg:max-w-[160px] truncate">
              {selectedStore?.name || t('header.allStores')}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Delivery / Pickup Toggle */}
          {tenant?.featureFlags?.enableCollection !== false ? (
            <div className="flex items-center bg-gray-100 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={deliveryFulfillmentEnabled ? () => onFulfillmentChange('delivery') : undefined}
                disabled={!deliveryFulfillmentEnabled}
                title={deliveryFulfillmentEnabled ? undefined : 'Delivery checkout is coming soon — Collection is available now.'}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  !deliveryFulfillmentEnabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : fulfillmentType === 'delivery'
                    ? 'bg-white text-gray-900 shadow-2xs cursor-pointer'
                    : 'text-gray-500 hover:text-gray-800 cursor-pointer'
                }`}
              >
                <Truck className="w-3 h-3" />
                <span>{t('header.delivery')}</span>
              </button>
              <button
                type="button"
                onClick={() => onFulfillmentChange('pickup')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  fulfillmentType === 'pickup'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <ShoppingBag className="w-3 h-3" />
                <span>{t('header.collect')}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center bg-gray-100 px-2.5 py-1 rounded-xl text-xs font-bold text-gray-700">
              <Truck className="w-3 h-3 mr-1 text-gray-600" />
              <span>{t('header.deliveryOnly')}</span>
            </div>
          )}
        </div>

        {/* Right Actions: Account Menu + Basket */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop Account / Profile Menu */}
          <div ref={accountMenuRef} className="relative hidden md:block">
            <button
              type="button"
              id="header-account-btn"
              onClick={() => setIsAccountMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200/80 text-xs font-bold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
              title={t('nav.account')}
            >
              <User className="w-4 h-4 text-gray-600" />
              <span>{t('nav.account')}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {isAccountMenuOpen && (
              <div
                id="header-account-dropdown"
                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 text-xs text-gray-700 animate-in fade-in slide-in-from-top-1"
              >
                <div className="px-3.5 py-2 border-b border-gray-100">
                  <p className="font-bold text-gray-900">
                    {currentUser ? currentUser.displayName || currentUser.email?.split('@')[0] || 'Customer' : 'Guest Customer'}
                  </p>
                  {currentUser?.email ? (
                    <p className="text-[11px] text-gray-500 truncate">{currentUser.email}</p>
                  ) : (
                    <p className="text-[11px] text-gray-400">{t('account.notSignedIn')}</p>
                  )}
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onNavigateTab?.('account');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <User className="w-4 h-4 text-gray-600" />
                    <span>{t('header.profilePreferences')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onNavigateTab?.('orders');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <Clock className="w-4 h-4 text-gray-600" />
                    <span>{t('header.ordersTracking')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onNavigateTab?.('account');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <Heart className="w-4 h-4 text-gray-600" />
                    <span>{t('nav.favourites')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onNavigateTab?.('orders');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <RotateCcw className="w-4 h-4 text-gray-600" />
                    <span>{t('nav.buyAgain')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onOpenLocationPicker();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2.5 cursor-pointer font-medium"
                  >
                    <MapPin className="w-4 h-4 text-gray-600" />
                    <span>{t('account.savedAddresses')}</span>
                  </button>
                </div>

                {onOpenAdmin && (appMode === 'demo' || Boolean(currentUser)) && (
                  <div className="pt-1 border-t border-gray-100">
                    <button
                      type="button"
                      id="header-dropdown-admin-btn"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onOpenAdmin();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-amber-50 text-amber-900 flex items-center gap-2.5 cursor-pointer font-semibold"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>{t('nav.admin')}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Action Button */}
          <motion.button
            key={`cart-btn-${cartItemCount}`}
            type="button"
            id="header-cart-btn"
            onClick={onOpenCart}
            style={primaryBtnStyle}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 0.25 }}
            className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">{t('header.basket')}</span>
            {cartItemCount > 0 && (
              <motion.span
                key={`cart-badge-${cartItemCount}`}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="w-5 h-5 rounded-full bg-white text-gray-900 font-extrabold text-[11px] flex items-center justify-center shadow-2xs"
              >
                {cartItemCount}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>

      {headerPages.length > 0 && (
        <nav aria-label="Brand pages" className="w-full max-w-7xl mx-auto px-4 pb-2 flex items-center gap-4 overflow-x-auto">
          {headerPages.map((page) => <button key={page.id} type="button" onClick={() => openCmsPage(page)} className="text-xs font-bold whitespace-nowrap text-gray-600 hover:text-gray-950">{page.navigationLabel || page.title}</button>)}
        </nav>
      )}

      {/* Mobile Location & Store Sub-Bar */}
      <div className="md:hidden px-4 pb-1.5 flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          id="header-mobile-location-btn"
          onClick={onOpenLocationPicker}
          className="flex-1 flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl bg-gray-50 border border-gray-200/70 text-gray-800 font-bold truncate text-left cursor-pointer"
        >
          <MapPin className="w-3 h-3 text-gray-700 shrink-0" />
          <span className="truncate">{currentAddress?.line1 || t('header.setLocation')}</span>
          <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
        </button>

        <button
          type="button"
          id="header-mobile-store-btn"
          onClick={onOpenStorePicker}
          className={`flex-1 flex items-center gap-1.5 py-1.5 px-2.5 rounded-xl border font-bold truncate text-left cursor-pointer ${
            selectedStore
              ? 'bg-gray-100 border-gray-300 text-gray-900'
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <StoreIcon className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {selectedStore?.name || t('header.allStores')}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
        </button>
      </div>
    </header>
  );
};
