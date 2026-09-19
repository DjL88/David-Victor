import React from 'react';
import { useTenant } from '../../tenant/TenantContext';
import { useTenantStyles } from '../../tenant/useTenant';
import { Clock, Truck, ArrowRight } from 'lucide-react';

interface HomeHeroBannerProps {
  onSelectStoreClick: () => void;
  selectedStoreName?: string;
}

export const HomeHeroBanner: React.FC<HomeHeroBannerProps> = ({
  onSelectStoreClick,
  selectedStoreName,
}) => {
  const { tenant } = useTenant();
  const { primaryBtnStyle } = useTenantStyles();

  return (
    <div id="home-hero-banner" className="px-4 py-2">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-800 via-teal-800 to-indigo-900 text-white p-5 sm:p-7 shadow-sm">
        {/* Subtle background glow */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-bold text-emerald-200 mb-2.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-emerald-300" />
            <span>Fast Courier Delivery Direct to Door</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-2">
            Fresh local groceries, curated by {tenant?.brandName}
          </h1>

          <p className="text-xs sm:text-sm text-gray-200 mb-4 leading-relaxed line-clamp-2">
            Order woodfired pizzas, British strawberries, bakery staples and chilled drinks in minutes.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              id="hero-choose-store-btn"
              onClick={onSelectStoreClick}
              className="py-2.5 px-4 rounded-xl bg-white text-gray-900 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-transform hover:bg-gray-100"
            >
              <Truck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{selectedStoreName ? `Fulfilling from ${selectedStoreName}` : 'Select Nearby Store'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] text-gray-300 font-medium">
              Free courier delivery over £25
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
