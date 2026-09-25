import React, { useCallback, useEffect, useRef, useState } from 'react';

interface BrandSplashScreenProps {
  onFinish?: () => void;
}

export const BrandSplashScreen: React.FC<BrandSplashScreenProps> = ({ onFinish }) => {
  const finishedRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsFadingOut(true);
    window.setTimeout(() => onFinish?.(), 250);
  }, [onFinish]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    setReducedMotion(prefersReducedMotion);
    const fallback = window.setTimeout(finish, prefersReducedMotion ? 800 : 4500);
    return () => window.clearTimeout(fallback);
  }, [finish]);

  return (
    <div
      id="brand-splash-screen"
      role="status"
      aria-label="Loading the retailer storefront"
      className={`fixed inset-0 z-100 flex items-center justify-center overflow-hidden bg-[#073d49] transition-opacity duration-300 ${
        isFadingOut ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {reducedMotion ? (
        <img
          src="/brand/lt-logo-white.png"
          alt="Leitch Technologies"
          className="h-auto w-36 max-w-[45vw] object-contain"
        />
      ) : (
        <video
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={finish}
          onError={finish}
          className="h-full w-full object-cover"
          aria-label="Leitch Technologies launch animation"
        >
          <source src="/brand/lt-logo-whoosh-splash-3s.mp4" type="video/mp4" />
        </video>
      )}

      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-sm transition hover:bg-black/40 hover:text-white"
      >
        Skip
      </button>
    </div>
  );
};
