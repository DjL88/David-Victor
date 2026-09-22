import React, { useState, useEffect } from 'react';
import { AdminUser, TenantConfig } from '../commerce/models';
import { defaultAdminClient } from '../commerce/HttpAdminClient';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';
import { useTenant } from '../tenant/TenantContext';
import { BrandsScreen } from './screens/BrandsScreen';
import { BrandingScreen } from './screens/BrandingScreen';
import { StoriesAdminScreen } from './screens/StoriesAdminScreen';
import { HeroBannersAdminScreen } from './screens/HeroBannersAdminScreen';
import { FeesAdminScreen } from './screens/FeesAdminScreen';
import { CountryRulesScreen } from './screens/CountryRulesScreen';
import { ProductRulesScreen } from './screens/ProductRulesScreen';
import { FeaturesScreen } from './screens/FeaturesScreen';
import { StoreConfigScreen } from './screens/StoreConfigScreen';
import { PreviewScreen } from './screens/PreviewScreen';
import { AuditHistoryScreen } from './screens/AuditHistoryScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { SearchMerchScreen } from './screens/SearchMerchScreen';
import { MediaHealthScreen } from './screens/MediaHealthScreen';
import { PagesAdminScreen } from './screens/PagesAdminScreen';
import { DomainsScreen } from './screens/DomainsScreen';
import { NotificationsAdminScreen } from './screens/NotificationsAdminScreen';
import { CatalogAdminScreen } from './screens/CatalogAdminScreen';
import { IntegrationsAdminScreen } from './screens/IntegrationsAdminScreen';
import { ConnectionHealthScreen } from './screens/ConnectionHealthScreen';
import { MembershipsScreen } from './screens/MembershipsScreen';
import { AdminWorkspaceProvider } from './AdminWorkspaceContext';
import { AdminAssistantDrawer } from './AdminAssistantDrawer';
import {
  Palette,
  Film,
  Coins,
  Globe,
  ShieldCheck,
  Sliders,
  Store,
  Eye,
  History,
  User,
  Users,
  BarChart3,
  Search,
  Image as ImageIcon,
  FileText,
  Bell,
  Package,
  Link2,
  Menu,
  X,
  ChevronRight,
  Building2,
  Sparkles,
  Activity,
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
  | 'notifications'
  | 'media_health'
  | 'stories'
  | 'fees'
  | 'country_rules'
  | 'product_rules'
  | 'features'
  | 'stores'
  | 'preview'
  | 'audit';

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
  }>;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onExitAdmin, initialUser }) => {
  const { appMode } = useTenant();
  const isDemo = appMode === 'demo';

  // Demo identities are a sandbox convenience only. Live admin entry should provide the authenticated user.
  const demoFallbackUser = ALL_MOCK_ADMIN_USERS[0];
  const [currentUser, setCurrentUser] = useState<AdminUser>(
    initialUser || demoFallbackUser
  );
  const [currentTenantId, setCurrentTenantId] = useState<string>(currentUser.tenantId);
  const [activeTab, setActiveTab] = useState<AdminTab>('insights');
  const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
  const [allTenants, setAllTenants] = useState<TenantConfig[]>([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [tenantLoadError, setTenantLoadError] = useState<string>('');
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);

  useEffect(() => {
    defaultAdminClient.setActiveAdminUser?.(currentUser);
  }, [currentUser]);

  useEffect(() => {
    loadTenant();
  }, [currentTenantId]);

  useEffect(() => {
    loadAllTenants();
  }, []);

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
    } catch (e) {
      console.warn('Failed to load dynamic tenants list:', e);
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
      setCurrentTenantId(user.tenantId || 'brand-alpha');
    } else {
      setCurrentTenantId(user.tenantId);
    }
  };

  const navSections: NavSection[] = [];

  if (currentUser.role === 'platformSuperAdmin') {
    navSections.push({
      title: 'Platform Architecture',
      items: [
        { id: 'brands', label: 'Brands & Provisioning', icon: Building2 },
        { id: 'memberships', label: 'Team & RBAC', icon: Users },
      ],
    });
  } else {
    navSections.push({
      title: 'Team & Access',
      items: [
        { id: 'memberships', label: 'Team Members', icon: Users },
      ],
    });
  }

  navSections.push(
    {
      title: 'Storefront Settings',
      items: [
        { id: 'catalog', label: 'Catalog & Stock', icon: Package },
        { id: 'stores', label: 'Locations', icon: Store },
        { id: 'fees', label: 'Fee Policies', icon: Coins },
        { id: 'media_health', label: 'Media Health', icon: ImageIcon },
        { id: 'country_rules', label: 'Country Rules', icon: Globe },
        { id: 'product_rules', label: 'Product Rules', icon: ShieldCheck },
        { id: 'preview', label: 'Live Preview', icon: Eye },
      ],
    },
    {
      title: 'Marketing Settings',
      items: [
        { id: 'branding', label: 'Branding & Fonts', icon: Palette },
        { id: 'hero_banners', label: 'Hero Banners & Content', icon: Sparkles },
        { id: 'stories', label: 'Stories Drops', icon: Film },
        { id: 'pages', label: 'Pages (CMS)', icon: FileText },
        { id: 'search_merch', label: 'Search Merchandising', icon: Search },
        { id: 'insights', label: 'Insights & Funnel', icon: BarChart3 },
      ],
    },
    {
      title: 'Technical Settings',
      items: [
        { id: 'connection_health', label: 'Connection Health', icon: Activity },
        { id: 'integrations', label: 'POS & API Sync', icon: Link2 },
        { id: 'domains', label: 'Domains & Routing', icon: Globe },
        { id: 'notifications', label: 'Notifications & Live', icon: Bell },
        { id: 'features', label: 'Feature Flags', icon: Sliders },
      ],
    },
    {
      title: 'Analytics & Governance',
      items: [
        { id: 'audit', label: 'Audit History', icon: History },
      ],
    }
  );

  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
  };

  return (
    <AdminWorkspaceProvider tenantId={currentTenantId} section={activeTab} actor={currentUser}>
    <div className="min-h-screen bg-gray-50 flex text-gray-900 font-sans overflow-hidden">
      {/* MOBILE NAV TRIGGER ONLY — desktop Admin is side-navigation only. */}
      <button
        type="button"
        onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
        className="fixed left-3 top-3 z-50 lg:hidden p-2.5 rounded-xl bg-gray-900 text-white shadow-lg"
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
              {currentUser.role === 'platformSuperAdmin' && <label className="block lg:hidden">Tenant<select aria-label="Menu tenant" value={currentTenantId} onChange={(event) => setCurrentTenantId(event.target.value)} className="mt-1 w-full bg-gray-800 text-white rounded-lg p-2">{allTenants.length ? allTenants.map((tenant, idx) => <option key={`admin-mob-tenant-${tenant.tenantId}-${idx}`} value={tenant.tenantId}>{tenant.brandName} ({tenant.tenantId})</option>) : <option value={currentTenantId}>{currentTenantId}</option>}</select></label>}
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
                        {isActive && (
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
              aria-label="Open Admin Assistant"
            >
              <span className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block">Ask Admin Assistant</span>
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
        <main className="flex-1 overflow-y-auto p-4 pt-16 lg:p-8 min-w-0">
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
            {activeTab === 'integrations' && <IntegrationsAdminScreen tenantId={currentTenantId} />}
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
            {activeTab === 'notifications' && <NotificationsAdminScreen tenantId={currentTenantId} />}
            {activeTab === 'media_health' && <MediaHealthScreen tenantId={currentTenantId} />}
            {activeTab === 'stories' && (
              <StoriesAdminScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'fees' && (
              <FeesAdminScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'country_rules' && (
              <CountryRulesScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'product_rules' && (
              <ProductRulesScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'features' && (
              <FeaturesScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'stores' && (
              <StoreConfigScreen tenantId={currentTenantId} currentUser={currentUser} />
            )}
            {activeTab === 'preview' && <PreviewScreen tenantId={currentTenantId} />}
            {activeTab === 'audit' && <AuditHistoryScreen tenantId={currentTenantId} />}
          </div>
        </main>
      <AdminAssistantDrawer open={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />
    </div>
    </AdminWorkspaceProvider>
  );
};
