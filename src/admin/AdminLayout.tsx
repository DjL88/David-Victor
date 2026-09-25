import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AdminUser, TenantConfig } from '../commerce/models';
import { defaultAdminClient } from '../commerce/HttpAdminClient';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';
import { useTenant } from '../tenant/TenantContext';
import { BrandsScreen } from './screens/BrandsScreen';
import { BrandingScreen } from './screens/BrandingScreen';
import { StoriesAdminScreen } from './screens/StoriesAdminScreen';
import { HeroBannersAdminScreen } from './screens/HeroBannersAdminScreen';
import { FeesAdminScreen } from './screens/FeesAdminScreen';
import { ProductRulesScreen } from './screens/ProductRulesScreen';
import { FeaturesScreen } from './screens/FeaturesScreen';
import { LanguageTerminologyScreen } from './screens/LanguageTerminologyScreen';
import { StoreConfigScreen } from './screens/StoreConfigScreen';
import { AuditHistoryScreen } from './screens/AuditHistoryScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { SearchMerchScreen } from './screens/SearchMerchScreen';
import { MediaHealthScreen } from './screens/MediaHealthScreen';
import { PagesAdminScreen } from './screens/PagesAdminScreen';
import { DomainsScreen } from './screens/DomainsScreen';
import { CatalogAdminScreen } from './screens/CatalogAdminScreen';
import { IntegrationsAdminScreen } from './screens/IntegrationsAdminScreen';
import { ConnectionHealthScreen } from './screens/ConnectionHealthScreen';
import { MembershipsScreen } from './screens/MembershipsScreen';
import { AdminWorkspaceProvider, type AdminGuideStep, type AdminNavigateOptions } from './AdminWorkspaceContext';
import { AdminAssistantDrawer } from './AdminAssistantDrawer';
import {
  Palette,
  Film,
  Coins,
  Globe,
  ShieldCheck,
  Languages,
  SlidersHorizontal,
  CalendarClock,
  Truck,
  Store,
  History,
  Users,
  BarChart3,
  Search,
  Image as ImageIcon,
  FileText,
  Link2,
  Menu,
  X,
  ChevronRight,
  Building2,
  Activity,
  Flag,
  BotMessageSquare,
  ArrowUp,
} from 'lucide-react';

export type AdminTab =
  | 'brands'
  | 'memberships'
  | 'connection_health'
  | 'catalog'
  | 'integrations'
  | 'insights'
  | 'branding'
  | 'hero_banners'
  | 'search_merch'
  | 'pages'
  | 'domains'
  | 'media_health'
  | 'stories'
  | 'fees'
  | 'product_rules'
  | 'courier_settings'
  | 'order_scheduling'
  | 'languages'
  | 'features'
  | 'stores'
  | 'audit';

const CanIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <ellipse cx="12" cy="5" rx="6" ry="2" />
    <path d="M6 5v14c0 1.1 2.7 2 6 2s6-.9 6-2V5" />
    <path d="M6 10h12" />
    <path d="M6 18h12" />
  </svg>
);

interface AdminLayoutProps {
  onExitAdmin: () => void;
  initialUser?: AdminUser;
}

interface NavSection {
  title: string;
  items: Array<{
    id: AdminTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    issueCount?: number;
  }>;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onExitAdmin, initialUser }) => {
  const { appMode } = useTenant();
  const isDemo = appMode === 'demo';

  // Demo identities are a sandbox convenience only. Live admin entry should provide the authenticated user.
  const demoFallbackUser = ALL_MOCK_ADMIN_USERS[0];
  const resolvedUser = initialUser || (isDemo ? demoFallbackUser : undefined);

  // Never manufacture an administrator identity outside Demo. Authentication
  // must supply the resolved AdminUser before the privileged workspace mounts.
  if (!resolvedUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Admin sign-in required</h1>
          <p className="mt-2 text-sm text-slate-600">No authenticated administrator identity is available for this environment.</p>
          <button type="button" onClick={onExitAdmin} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Return to storefront</button>
        </div>
      </div>
    );
  }

  const [currentUser, setCurrentUser] = useState<AdminUser>(resolvedUser);
  const [currentTenantId, setCurrentTenantId] = useState<string>(currentUser.tenantId);
  const [activeTab, setActiveTab] = useState<AdminTab>(() => currentUser.role === 'platformSuperAdmin' ? 'brands' : 'catalog');
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [allTenants, setAllTenants] = useState<TenantConfig[]>([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [tenantLoadError, setTenantLoadError] = useState<string>('');
  const [connectionIssueCount, setConnectionIssueCount] = useState<number>(0);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [assistantGuide, setAssistantGuide] = useState<{ steps: AdminGuideStep[]; index: number } | null>(null);
  const adminMainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    defaultAdminClient.setActiveAdminUser?.(currentUser);
    if (currentUser.role === 'platformSuperAdmin' && currentTenantId) {
      void defaultAdminClient.switchTenantAsSuperAdmin(currentTenantId);
    }
  }, [currentUser, currentTenantId]);

  useEffect(() => {
    loadTenant();
    void loadConnectionReadiness();
  }, [currentTenantId]);

  useEffect(() => {
    loadAllTenants();
  }, []);

  useEffect(() => {
    const main = adminMainRef.current;
    if (!main) return;

    const handleScroll = () => setShowBackToTop(main.scrollTop > 480);
    handleScroll();
    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    adminMainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    setShowBackToTop(false);
  }, [activeTab, currentTenantId]);

  // Altie guidance is identity-scoped. Tenant/user/role changes must discard any
  // pending walkthrough before the new identity can see or act on stale context.
  useEffect(() => {
    setAssistantGuide(null);
    setIsAssistantOpen(false);
  }, [currentTenantId, currentUser.id, currentUser.role, currentUser.tenantId]);

  const loadAllTenants = async () => {
    try {
      const list = await defaultAdminClient.listAllTenants();
      const seen = new Set<string>();
      const deduped = (list || []).filter((t) => {
        if (!t?.tenantId || seen.has(t.tenantId)) return false;
        seen.add(t.tenantId);
        return true;
      });
      setAllTenants(deduped);

      // A Platform SuperAdmin identity may still carry an old tenantId after
      // that brand has been deleted. Never keep the workspace pinned to a tenant
      // that no longer exists; select the first live tenant instead.
      if (
        currentUser.role === 'platformSuperAdmin' &&
        deduped.length > 0 &&
        !deduped.some((tenant) => tenant.tenantId === currentTenantId)
      ) {
        const nextTenantId = deduped[0].tenantId;
        setCurrentTenantId(nextTenantId);
        void defaultAdminClient.switchTenantAsSuperAdmin(nextTenantId);
      }
    } catch (e) {
      console.warn('Failed to load dynamic tenants list:', e);
    }
  };

  const loadConnectionReadiness = async () => {
    if (!defaultAdminClient.getOperationalReadiness) {
      setConnectionIssueCount(0);
      return;
    }
    try {
      const summary = await defaultAdminClient.getOperationalReadiness(currentTenantId);
      setConnectionIssueCount(Math.max(0, Number(summary?.issueCount || 0)));
    } catch (error) {
      // Readiness is advisory shell data. Failure must never block Admin navigation.
      console.warn('Failed to load operational readiness:', error);
      setConnectionIssueCount(0);
    }
  };

  const loadTenant = async () => {
    setTenantLoadError('');
    try {
      const config = await defaultAdminClient.getBranding(currentTenantId);
      setTenantConfig(config);
    } catch (e) {
      console.error(e);
      setTenantConfig(null);
      setTenantLoadError('Unable to load this brand configuration.');
    }
  };

  // Switch admin user for testing RBAC and tenant isolation
  const handleUserSwitch = (userId: string) => {
    const user = ALL_MOCK_ADMIN_USERS.find((u) => u.id === userId);
    if (!user) return;
    setCurrentUser(user);
    defaultAdminClient.setActiveAdminUser?.(user);
    if (user.role === 'platformSuperAdmin') {
      const liveTenantId =
        allTenants.find((tenant) => tenant.tenantId === currentTenantId)?.tenantId ||
        allTenants[0]?.tenantId ||
        user.tenantId;
      if (liveTenantId) setCurrentTenantId(liveTenantId);
    } else {
      setCurrentTenantId(user.tenantId);
    }
  };

  const navSections: NavSection[] = [];

  navSections.push({
    title: 'Platform',
    items: currentUser.role === 'platformSuperAdmin'
      ? [
          { id: 'brands', label: 'Brands', icon: Building2 },
          { id: 'memberships', label: 'Team & Access', icon: Users },
        ]
      : [
          { id: 'memberships', label: 'Team & Access', icon: Users },
        ],
  });

  navSections.push(
    {
      title: 'Shop',
      items: [
        { id: 'stores', label: 'Locations', icon: Store },
        { id: 'catalog', label: 'Products & Stock', icon: CanIcon },
        { id: 'fees', label: 'Fees', icon: Coins },
      ],
    },
    {
      title: 'Rules',
      items: [
        { id: 'product_rules', label: 'Product rules', icon: ShieldCheck },
        { id: 'courier_settings', label: 'Courier settings', icon: Truck },
        { id: 'order_scheduling', label: 'Order scheduling', icon: CalendarClock },
      ],
    },
    {
      title: 'Brand',
      items: [
        { id: 'branding', label: 'Branding', icon: Palette },
        { id: 'languages', label: 'Languages & wording', icon: Languages },
        { id: 'features', label: 'Feature switches', icon: SlidersHorizontal },
      ],
    },
    {
      title: 'Marketing',
      items: [
        { id: 'hero_banners', label: 'Banners', icon: Flag },
        { id: 'stories', label: 'Stories', icon: Film },
        { id: 'search_merch', label: 'Search & Recommendations', icon: Search },
        { id: 'pages', label: 'Pages', icon: FileText },
      ],
    },
    {
      title: 'Connections',
      items: [
        { id: 'integrations', label: 'Deliverect Setup', icon: Link2 },
        { id: 'connection_health', label: 'Connection Status', icon: Activity, issueCount: connectionIssueCount },
        { id: 'domains', label: 'Domains', icon: Globe },
        { id: 'media_health', label: 'Media Health', icon: ImageIcon },
      ],
    },
    {
      title: 'Reports',
      items: [
        { id: 'insights', label: 'Insights', icon: BarChart3 },
        { id: 'audit', label: 'Audit History', icon: History },
      ],
    }
  );

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
    setAssistantGuide(null);
  };

  const showAssistantDestination = useCallback((
    tab: AdminTab,
    target?: string,
    prefill?: Record<string, unknown>
  ) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
    setIsAssistantOpen(false);

    // Wait for the screen to mount, then let that screen consume safe draft values.
    // Prefills only update React form state; they never call a save API.
    window.setTimeout(() => {
      if (prefill && Object.keys(prefill).length > 0) {
        window.dispatchEvent(new CustomEvent('admin-ai-prefill', {
          detail: { section: tab, target, prefill },
        }));
      }

      window.setTimeout(() => {
        const selector = target ? `[data-admin-ai-target="${target}"]` : null;
        const element = selector ? document.querySelector<HTMLElement>(selector) : null;
        const destination = element || adminMainRef.current;

        destination?.scrollIntoView?.({ behavior: 'smooth', block: element ? 'center' : 'start' });

        if (element) {
          element.classList.remove('admin-ai-highlight');
          void element.offsetWidth;
          element.classList.add('admin-ai-highlight');

          const focusable = (
            element.matches('input, select, textarea, button, [tabindex]')
              ? element
              : element.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]')
          );
          focusable?.focus({ preventScroll: true });

          window.setTimeout(() => element.classList.remove('admin-ai-highlight'), 3600);
        }
      }, prefill ? 140 : 0);
    }, 180);
  }, []);

  const handleAssistantNavigate = useCallback((
    tab: AdminTab,
    target?: string,
    options?: AdminNavigateOptions
  ) => {
    const steps = options?.steps?.filter((step) => step?.section) || [];
    if (steps.length > 0) {
      setAssistantGuide({ steps, index: 0 });
      const first = steps[0];
      showAssistantDestination(first.section, first.target, first.prefill || options?.prefill);
      return;
    }

    setAssistantGuide(null);
    showAssistantDestination(tab, target, options?.prefill);
  }, [showAssistantDestination]);

  const goToGuideStep = useCallback((nextIndex: number) => {
    setAssistantGuide((current) => {
      if (!current) return current;
      const boundedIndex = Math.max(0, Math.min(nextIndex, current.steps.length - 1));
      const step = current.steps[boundedIndex];
      showAssistantDestination(step.section, step.target, step.prefill);
      return { ...current, index: boundedIndex };
    });
  }, [showAssistantDestination]);

  return (
    <AdminWorkspaceProvider
      tenantId={currentTenantId}
      section={activeTab}
      actor={currentUser}
      onNavigate={handleAssistantNavigate}
    >
    <div className="h-[100dvh] min-h-[100dvh] bg-gray-50 flex text-gray-900 font-sans overflow-hidden">
      {/* MOBILE NAV TRIGGER ONLY — desktop Admin is side-navigation only. */}
      <button
        type="button"
        onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
        className="fixed left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 lg:hidden p-2.5 rounded-xl bg-gray-900 text-white shadow-lg"
        aria-label="Toggle admin menu"
        aria-expanded={isMobileNavOpen}
      >
        {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* ADMIN WORKSPACE: LEFT SIDEBAR + MAIN CONTENT AREA */}
        {/* BACKDROP FOR MOBILE NAVIGATION */}
        {isMobileNavOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-xs"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}

        {/* LEFT ADMIN SIDEBAR MENU */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 top-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col justify-between overflow-y-auto transform transition-transform duration-200 ease-in-out shrink-0 ${
            isMobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-3.5 space-y-6">
            <div className="px-2 pt-1">
              <div className="min-h-14 flex items-center gap-3">
                {(tenantConfig?.logoUrl || tenantConfig?.iconUrl) ? (
                  <img
                    src={tenantConfig.logoUrl || tenantConfig.iconUrl}
                    alt={tenantConfig?.brandName || 'Brand'}
                    className="max-h-12 max-w-[180px] w-auto object-contain object-left"
                  />
                ) : (
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white truncate">
                      {tenantConfig?.brandName || currentTenantId}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500">Admin</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl bg-white/5 p-3 text-white text-xs">
              <div><span className="block text-gray-400">Signed in</span><span>{currentUser.name}</span><span className="block text-gray-400 break-words">{currentUser.role}</span></div>
              {currentUser.role === 'platformSuperAdmin' && <label className="block">Tenant<select aria-label="Menu tenant" value={currentTenantId} onChange={(event) => setCurrentTenantId(event.target.value)} className="mt-1 w-full bg-gray-800 text-white rounded-lg p-2">{allTenants.length ? allTenants.map((tenant, idx) => <option key={`admin-mob-tenant-${tenant.tenantId}-${idx}`} value={tenant.tenantId}>{tenant.brandName} ({tenant.tenantId})</option>) : <option value={currentTenantId}>{currentTenantId}</option>}</select></label>}
              {isDemo && <label className="block">Demo user<select aria-label="Demo user" value={currentUser.id} onChange={(event) => handleUserSwitch(event.target.value)} className="mt-1 w-full bg-gray-800 rounded-lg p-2">{ALL_MOCK_ADMIN_USERS.map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select></label>}
            </div>
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <h3 className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                  {section.title}
                </h3>
                <div className="space-y-0.5 mt-1.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : 'text-gray-300 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-white' : 'text-gray-400'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {Boolean(item.issueCount) && (
                          <span
                            className="ml-2 min-w-5 rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-amber-950"
                            aria-label={`${item.issueCount} connection ${item.issueCount === 1 ? 'issue' : 'issues'} need attention`}
                          >
                            {item.issueCount! > 99 ? '99+' : item.issueCount}
                          </span>
                        )}
                        {isActive && !item.issueCount && (
                          <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* SIDEBAR ASSISTANT ENTRY */}
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-xs font-bold text-white hover:bg-white/10 transition-colors flex items-center gap-2.5"
              aria-label="Open Altie"
            >
              <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                <BotMessageSquare className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block">Ask Altie</span>
                <span className="block text-[10px] font-medium text-gray-400 mt-0.5">Context-aware · safe changes</span>
              </span>
            </button>
          </div>

          {/* SIDEBAR FOOTER — deliberately platform-neutral for white-label Admin. */}
          <div className="p-3 border-t border-gray-800/80 text-[11px] text-gray-400 space-y-2">
            <div className="flex justify-between items-center px-1">
              <span>Environment</span>
              <span className="font-mono text-indigo-300 font-bold">
                {isDemo ? 'Demo Sandbox' : 'Cloud Staging'}
              </span>
            </div>
            <div className="flex justify-between items-center px-1">
              <span>Brand config</span>
              <span className={`font-semibold ${tenantLoadError ? 'text-rose-300' : tenantConfig ? 'text-emerald-400' : 'text-gray-400'}`}>
                {tenantLoadError ? 'Unavailable' : tenantConfig ? 'Loaded' : 'Loading…'}
              </span>
            </div>
            <button
              type="button"
              onClick={onExitAdmin}
              className="mt-2 w-full rounded-lg border border-white/10 px-3 py-2 text-left font-bold text-gray-300 hover:bg-white/5 hover:text-white"
            >
              Return to storefront
            </button>
          </div>
        </aside>

        {/* ACTIVE SCREEN CONTENT */}
        <main ref={adminMainRef} className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scroll-smooth p-4 pt-16 lg:p-8 min-w-0">
          <div className="max-w-6xl mx-auto">
            {tenantLoadError && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800 flex items-center justify-between gap-3"><span>{tenantLoadError}</span><button type="button" onClick={loadTenant} className="font-bold underline">Retry</button></div>}
            {activeTab === 'brands' && (
              <BrandsScreen
                currentUser={currentUser}
                onSelectTenant={(tId) => {
                  setCurrentTenantId(tId);
                  loadAllTenants();
                  setActiveTab('branding');
                }}
              />
            )}
            {activeTab === 'memberships' && (
              <MembershipsScreen
                currentUser={currentUser}
                currentTenantId={currentTenantId}
              />
            )}
            {activeTab === 'catalog' && <CatalogAdminScreen tenantId={currentTenantId} />}
            {activeTab === 'connection_health' && <ConnectionHealthScreen tenantId={currentTenantId} />}
            {activeTab === 'integrations' && (
              <IntegrationsAdminScreen
                tenantId={currentTenantId}
                canManagePlatformCredentials={currentUser.role === 'platformSuperAdmin'}
              />
            )}
            {activeTab === 'insights' && <InsightsScreen tenantId={currentTenantId} />}
            {activeTab === 'branding' && (
              <BrandingScreen
                tenantId={currentTenantId}
                currentUser={currentUser}
                onBrandingUpdated={setTenantConfig}
              />
            )}
            {activeTab === 'hero_banners' && (
              <HeroBannersAdminScreen
                tenantId={currentTenantId}
                currentUser={currentUser}
              />
            )}
            {activeTab === 'search_merch' && <SearchMerchScreen tenantId={currentTenantId} />}
            {activeTab === 'pages' && <PagesAdminScreen tenantId={currentTenantId} />}
            {activeTab === 'domains' && <DomainsScreen tenantId={currentTenantId} allTenants={allTenants} />}
            {activeTab === 'media_health' && <MediaHealthScreen tenantId={currentTenantId} />}
            {activeTab === 'stories' && (
              <StoriesAdminScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'fees' && (
              <FeesAdminScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'product_rules' && (
              <ProductRulesScreen tenantId={currentTenantId} currentUser={currentUser} view="product" />
            )}
            {activeTab === 'courier_settings' && (
              <ProductRulesScreen tenantId={currentTenantId} currentUser={currentUser} view="dispatch" />
            )}
            {activeTab === 'order_scheduling' && (
              <ProductRulesScreen tenantId={currentTenantId} currentUser={currentUser} view="scheduling" />
            )}
            {activeTab === 'languages' && (
              <LanguageTerminologyScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'features' && (
              <FeaturesScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'stores' && (
              <StoreConfigScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'audit' && <AuditHistoryScreen tenantId={currentTenantId} />}
          </div>
        </main>

      {showBackToTop && !isAssistantOpen && !assistantGuide && (
        <button
          type="button"
          onClick={() => adminMainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-800 shadow-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      )}

      {!isAssistantOpen && !assistantGuide && (
        <button
          type="button"
          onClick={() => setIsAssistantOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gray-950 px-4 py-3 text-xs font-extrabold text-white shadow-2xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
          aria-label="Ask Altie"
          title="Ask Altie about this page"
        >
          <BotMessageSquare className="w-4 h-4 text-indigo-300" />
          <span className="hidden sm:inline">Ask Altie</span>
        </button>
      )}

      {assistantGuide && (() => {
        const step = assistantGuide.steps[assistantGuide.index];
        const isFirst = assistantGuide.index === 0;
        const isLast = assistantGuide.index === assistantGuide.steps.length - 1;
        return (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] z-[65] rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <BotMessageSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                    Altie walkthrough · {assistantGuide.index + 1} of {assistantGuide.steps.length}
                  </span>
                </div>
                <p className="mt-1 text-xs font-extrabold text-gray-950">{step.label}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{step.instruction}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssistantGuide(null)}
                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Exit guided setup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3" aria-label="Altie walkthrough progress">
              <div className="h-1.5 overflow-hidden rounded-full bg-indigo-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${((assistantGuide.index + 1) / assistantGuide.steps.length) * 100}%` }}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                disabled={isFirst}
                onClick={() => goToGuideStep(assistantGuide.index - 1)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-[10px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-35"
              >
                Back
              </button>
              <span className="text-[9px] font-semibold text-gray-400">Prefills are drafts only</span>
              <button
                type="button"
                onClick={() => {
                  if (isLast) setAssistantGuide(null);
                  else goToGuideStep(assistantGuide.index + 1);
                }}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-extrabold text-white hover:bg-indigo-700"
              >
                {isLast ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        );
      })()}

      <AdminAssistantDrawer open={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
    </div>
    </AdminWorkspaceProvider>
  );
};
