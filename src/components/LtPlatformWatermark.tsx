import React from 'react';

export const LtPlatformWatermark: React.FC = () => (
  <footer
    aria-label="Platform provider"
    className="flex w-full items-center justify-center gap-2 border-t border-gray-200/70 bg-white/70 px-4 pb-24 pt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400 md:pb-5"
  >
    <span>Powered by</span>
    <img
      src="/brand/lt-logo.png"
      alt="Leitch Technologies"
      className="h-14 w-14 object-contain"
    />
  </footer>
);
