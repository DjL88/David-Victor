import React, { useEffect } from 'react';

export function ensureBwydiFontLoaded() {
  if (typeof document === 'undefined') return;
  try {
    if (document.getElementById('bwydi-font-face')) return;
    const style = document.createElement('style');
    style.id = 'bwydi-font-face';
    style.textContent = `
      @font-face {
        font-family: 'Croogla';
        src: url("https://db.onlinewebfonts.com/t/9645b9f58651aa6b35d5e34795cc30b6.woff2") format("woff2"),
             url("https://db.onlinewebfonts.com/t/9645b9f58651aa6b35d5e34795cc30b6.woff") format("woff"),
             url("https://db.onlinewebfonts.com/t/9645b9f58651aa6b35d5e34795cc30b6.ttf") format("truetype");
        font-weight: 400 700;
        font-style: normal;
        font-display: swap;
      }
      .font-croogla {
        font-family: 'Croogla4F', 'Croogla', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
    `;
    document.head.appendChild(style);
  } catch (err) {
    console.warn('[BwydiLogo] Font loading fallback active:', err);
  }
}

export interface BwydiLogoProps {
  variant?: 'full' | 'icon' | 'composite';
  color?: 'aubergine' | 'green' | 'mono' | 'white';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  subtitle?: string;
  className?: string;
  id?: string;
}

const SIZE_CONFIGS = {
  xs: {
    iconSize: 'w-5 h-5',
    logoHeight: 'h-5',
    textSize: 'text-sm',
    subtitleSize: 'text-[9px]',
    gap: 'gap-1.5',
  },
  sm: {
    iconSize: 'w-7 h-7',
    logoHeight: 'h-7',
    textSize: 'text-lg',
    subtitleSize: 'text-[10px]',
    gap: 'gap-2',
  },
  md: {
    iconSize: 'w-9 h-9',
    logoHeight: 'h-9',
    textSize: 'text-2xl',
    subtitleSize: 'text-xs',
    gap: 'gap-2.5',
  },
  lg: {
    iconSize: 'w-12 h-12',
    logoHeight: 'h-12',
    textSize: 'text-3xl',
    subtitleSize: 'text-xs',
    gap: 'gap-3',
  },
  xl: {
    iconSize: 'w-16 h-16',
    logoHeight: 'h-16',
    textSize: 'text-4xl',
    subtitleSize: 'text-sm',
    gap: 'gap-3.5',
  },
};

export const BwydiLogo: React.FC<BwydiLogoProps> = ({
  variant = 'composite',
  color = 'aubergine',
  size = 'md',
  subtitle,
  className = '',
  id,
}) => {
  useEffect(() => {
    ensureBwydiFontLoaded();
  }, []);

  const config = SIZE_CONFIGS[size];

  const [imgError, setImgError] = React.useState(false);

  // Pick direct raster image if 'full' variant requested
  if (variant === 'full' && !imgError) {
    const fullLogoSrc = color === 'green' ? '/bwydi-green.png' : '/bwydi-aubergine.png';
    return (
      <div id={id} className={`inline-flex items-center ${config.gap} ${className}`}>
        <img
          src={fullLogoSrc}
          alt="bwydi"
          onError={() => setImgError(true)}
          className={`${config.logoHeight} w-auto object-contain shrink-0`}
        />
        {subtitle && (
          <span className={`font-semibold tracking-wider uppercase text-gray-400 ${config.subtitleSize}`}>
            {subtitle}
          </span>
        )}
      </div>
    );
  }

  // Icon only
  if (variant === 'icon' && !imgError) {
    const iconSrc = color === 'mono' ? '/bwydi-bulb-icon-mono.png' : '/bwydi-bulb-icon.png';
    return (
      <img
        id={id}
        src={iconSrc}
        alt="bwydi logo icon"
        onError={() => setImgError(true)}
        className={`${config.iconSize} object-contain shrink-0 ${className}`}
      />
    );
  }

  // Composite: Crisp bulb icon + Typographic "bwydi" in genuine Croogla font
  const iconSrc = color === 'mono' ? '/bwydi-bulb-icon-mono.png' : '/bwydi-bulb-icon.png';
  
  let textColorClass = 'text-[#3c1b3f]';
  if (color === 'green') {
    textColorClass = 'text-[#498835]';
  } else if (color === 'white') {
    textColorClass = 'text-white';
  } else if (color === 'mono') {
    textColorClass = 'text-gray-900';
  }

  return (
    <div id={id} className={`inline-flex items-center ${config.gap} select-none ${className}`}>
      {!imgError && (
        <img
          src={iconSrc}
          alt="bwydi"
          onError={() => setImgError(true)}
          className={`${config.iconSize} object-contain shrink-0`}
        />
      )}
      <div className="flex flex-col leading-none">
        <span
          className={`font-croogla font-normal tracking-tight lowercase ${config.textSize} ${textColorClass} drop-shadow-2xs`}
        >
          bwydi
        </span>
        {subtitle && (
          <span className={`font-medium tracking-wider uppercase text-gray-400 mt-0.5 ${config.subtitleSize}`}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};
