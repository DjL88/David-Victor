import React from 'react';
import { Home, Search, Clock, User } from 'lucide-react';
import { useTenant } from '../tenant/TenantContext';

export type MobileTab = 'home' | 'search' | 'orders' | 'account';

interface MobileNavProps {
  activeTab: MobileTab;
  onChangeTab: (tab: MobileTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onChangeTab,
}) => {
  const { tenant } = useTenant();
  const primaryColour = tenant?.primaryColour || '#0d9488';

  const tabs: Array<{ id: MobileTab; label: string; icon: typeof Home }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'orders', label: 'Orders', icon: Clock },
    { id: 'account', label: 'Account', icon: User },
  ];

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
              onClick={() => onChangeTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isActive ? 'font-bold' : 'font-medium text-gray-400 hover:text-gray-700'
              }`}
              style={{ color: isActive ? primaryColour : undefined }}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
