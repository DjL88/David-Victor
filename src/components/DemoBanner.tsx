import React, { useState } from 'react';
import { useTenant } from '../tenant/TenantContext';
import { BwydiLogo } from './BwydiLogo';
import { Sparkles, Shield, ChevronDown, ChevronUp, Layers } from 'lucide-react';

interface DemoBannerProps {
  onOpenAdmin: () => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ onOpenAdmin }) => {
  const { appMode, tenant, switchTenant, availableTenants } = useTenant();
  const [isExpanded, setIsExpanded] = useState(false);

  // Strictly only visible in DEMO mode
  if (appMode !== 'demo') {
    return null;
  }

  return (
    <aside
      id="bwydi-demo-sandbox-banner"
      aria-label="Demo environment indicator"
      className="bg-gray-900 text-white border-b border-gray-800 text-xs select-none sticky top-0 z-50 shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
        {/* Left: bwydi Branding & Mode Badge */}
        <div className="flex items-center gap-2.5">
          <BwydiLogo
            variant="composite"
            color="white"
            size="xs"
            id="bwydi-demo-header-logo"
          />
          <div className="h-3.5 w-px bg-gray-700 hidden sm:block" />
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold border border-purple-400/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-purple-400" />
              Demo Sandbox
            </span>
            <span className="text-gray-400 hidden md:inline">
              Simulating white-label brand:
            </span>
            <span className="font-semibold text-emerald-400">
              {tenant?.brandName || 'Brand Alpha'}
            </span>
          </div>
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Tenant Switcher (only in demo) */}
          {availableTenants.length > 1 && (
            <div className="relative hidden sm:inline-flex items-center">
              <select
                aria-label="Switch demo brand"
                value={tenant?.tenantId || 'brand-alpha'}
                onChange={(e) => switchTenant(e.target.value)}
                className="bg-gray-800 text-gray-200 text-[11px] font-semibold rounded-lg px-2 py-1 pr-6 border border-gray-700 focus:outline-hidden cursor-pointer"
              >
                {availableTenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId} className="bg-gray-900 text-white">
                    Brand: {t.brandName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 pointer-events-none" />
            </div>
          )}

          {/* Switch to Admin */}
          <button
            type="button"
            onClick={onOpenAdmin}
            id="bwydi-open-admin-from-demo"
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Open bwydi Admin Portal"
          >
            <Shield className="w-3 h-3" />
            <span className="font-croogla lowercase font-bold tracking-wide">bwydi</span>
            <span className="hidden sm:inline">Admin</span>
          </button>

          {/* Toggle details */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-200 p-1 cursor-pointer sm:hidden"
            aria-label="Toggle demo details"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Drawer on Mobile */}
      {isExpanded && (
        <div className="sm:hidden px-4 py-2 border-t border-gray-800 bg-gray-950 flex flex-col gap-2">
          <p className="text-[11px] text-gray-400">
            This is a demonstration of <strong className="text-white font-croogla">bwydi</strong> multi-tenant white-label commerce. Public customers only see their specific brand.
          </p>
          {availableTenants.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Switch Brand:</span>
              <select
                aria-label="Switch demo brand mobile"
                value={tenant?.tenantId || 'brand-alpha'}
                onChange={(e) => switchTenant(e.target.value)}
                className="bg-gray-800 text-gray-200 text-xs font-semibold rounded-lg px-2 py-1 border border-gray-700"
              >
                {availableTenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId} className="bg-gray-900 text-white">
                    {t.brandName} ({t.tenantId})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
