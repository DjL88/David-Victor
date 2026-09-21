import React, { useState, useEffect } from 'react';
import { TenantConfig } from '../commerce/models';
import { ShoppingBag, Truck, Check, X } from 'lucide-react';

interface BrandSplashScreenProps {
  tenant: TenantConfig | null;
  onFinish?: () => void;
  isManualPreview?: boolean;
}

export const BrandSplashScreen: React.FC<BrandSplashScreenProps> = ({
  tenant,
  onFinish,
  isManualPreview = false,
}) => {
  const [progress, setProgress] = useState(15);
  const [statusText, setStatusText] = useState('Connecting to local stores...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  const brandName = tenant?.brandName || 'Storefront';
  const tagline = tenant?.tagline || 'Delivery & Collection in Minutes';
  const primaryColor = tenant?.primaryColour || '#059669';
  const secondaryColor = tenant?.secondaryColour || '#f59e0b';
  const fontFamily = tenant?.fontFamily || 'Plus Jakarta Sans, sans-serif';

  // Extract initials for the brand emblem
  const brandInitials = brandName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'SF';

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(45);
      setStatusText('Checking fresh inventory & local specials...');
    }, 400);

    const t2 = setTimeout(() => {
      setProgress(85);
      setStatusText('Finding your nearest stores & delivery routes...');
    }, 900);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusText('Ready! Welcome to ' + brandName);
    }, 1400);

    const t4 = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => {
        onFinish?.();
      }, 400);
    }, isManualPreview ? 2800 : 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [brandName, onFinish, isManualPreview]);

  return (
    <div
      id="brand-splash-screen"
      style={{ fontFamily }}
      className={`fixed inset-0 z-100 flex flex-col items-center justify-between p-6 bg-linear-to-b from-gray-900 via-gray-950 to-black text-white transition-opacity duration-400 select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background ambient lighting accents */}
      <div
        className="absolute top-1/4 -left-20 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: primaryColor }}
      />
      <div
        className="absolute bottom-1/4 -right-20 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: secondaryColor }}
      />

      {/* Top Bar / Preview Dismiss */}
      <div className="w-full max-w-md flex items-center justify-between z-10 pt-4">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-gray-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Local Freshness Guaranteed</span>
        </div>

        <div className="flex items-center gap-2">
          {onFinish && (
            <button
              type="button"
              onClick={onFinish}
              className="text-[11px] font-semibold text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full transition-colors"
            >
              Skip
            </button>
          )}
          {isManualPreview && (
            <button
              type="button"
              onClick={onFinish}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
              title="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Center Brand Identity */}
      <div className="flex flex-col items-center text-center z-10 my-auto max-w-sm px-4">
        {/* Animated Brand Emblem / Square Icon */}
        <div className="relative mb-6">
          <div
            className="absolute -inset-2 rounded-3xl opacity-40 blur-md animate-pulse"
            style={{ backgroundColor: primaryColor }}
          />
          <div
            className="relative w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl border border-white/20 backdrop-blur-xl overflow-hidden p-2.5"
            style={{
              background: `linear-gradient(135deg, ${primaryColor} 0%, #111827 100%)`,
            }}
          >
            {tenant?.faviconUrl || tenant?.iconUrl || tenant?.logoUrl ? (
              <img
                src={tenant.faviconUrl || tenant.iconUrl || tenant.logoUrl}
                alt={brandName}
                className="w-full h-full object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span className="text-3xl font-black tracking-wider text-white">
                {brandInitials}
              </span>
            )}
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-2">
          {brandName}
        </h1>

        {/* Tagline */}
        <p className="text-xs sm:text-sm text-gray-400 font-medium leading-relaxed max-w-xs mb-8">
          {tagline}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: primaryColor,
              boxShadow: `0 0 12px ${primaryColor}`,
            }}
          />
        </div>

        {/* Dynamic Status Text */}
        <p className="text-[11px] font-medium text-gray-400 animate-fade-in flex items-center justify-center gap-1.5">
          {progress === 100 ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          )}
          <span>{statusText}</span>
        </p>
      </div>

      {/* Footer Badges */}
      <div className="w-full max-w-md flex items-center justify-center gap-4 text-[11px] text-gray-500 pb-4 z-10">
        <span className="flex items-center gap-1">
          <Truck className="w-3.5 h-3.5" />
          On-Demand Dispatch
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <ShoppingBag className="w-3.5 h-3.5" />
          Multi-Location Shopping
        </span>
      </div>
    </div>
  );
};
