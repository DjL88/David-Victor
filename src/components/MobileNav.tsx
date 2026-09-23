import React from 'react';
import { Home, LayoutGrid, Search, Clock, User } from 'lucide-react';
import { useTenant } from '../tenant/TenantContext';
import { useI18n } from '../i18n/I18nContext';

export type MobileTab = 'home' | 'search' | 'orders' | 'account' | 'aisles';

interface MobileNavProps {
  activeTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
  onOpenAisles?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenAisles,
}) => {
  const { tenant } = useTenant();
  const { t } = useI18n();
  const primaryColour = tenant?.primaryColour || '#0d9488';

  const tabs: Array<{ id: MobileTab; label: string; icon: typeof Home; isAction?: boolean }> = [
    { id: 'home', label: t('nav.home'), icon: Home },
    { id: 'aisles', label: t('nav.aisles'), icon: LayoutGrid, isAction: true },
    { id: 'search', label: t('nav.search'), icon: Search },
    { id: 'orders', label: t('nav.orders'), icon: Clock },
    { id: 'account', label: t('nav.account'), icon: User },
  ];

  const handleTabClick = (tab: { id: MobileTab; isAction?: boolean }) => {
    if (tab.id === 'aisles') {
      if (onOpenAisles) {
        onOpenAisles();
      }
      onChangeTab('home');
      return;
    }
    onChangeTab(tab.id);
  };

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg px-2 py-1.5"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              type="button"
              onClick={() => handleTabClick(tab)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
                isActive ? 'font-bold' : 'font-medium text-gray-400 hover:text-gray-700'
              }`}
              style={{ color: isActive ? primaryColour : undefined }}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
