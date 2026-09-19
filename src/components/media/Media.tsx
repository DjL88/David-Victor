import React, { useState, useEffect, useRef } from 'react';
import { Package, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { useTenant } from '../../tenant/TenantContext';

export type MediaLoadStatus = 'loading' | 'loaded' | 'failed';

interface BaseMediaProps {
  src?: string;
  alt: string;
  className?: string;
  timeoutMs?: number;
  onStatusChange?: (status: MediaLoadStatus) => void;
}

/**
 * ProductImage
 * Displays a branded placeholder with item initials or brand primary background on failure.
 */
export const ProductImage: React.FC<
  BaseMediaProps & {
    productName: string;
    badgeText?: string;
  }
> = ({ src, alt, className = 'w-full h-full object-cover', productName, badgeText, onStatusChange }) => {
  const { tenant } = useTenant();
  const [hasError, setHasError] = useState(false);

  // If src changes (e.g. when filtering), reset error state so the new image loads
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const handleLoad = () => {
    onStatusChange?.('loaded');
  };

  const handleError = () => {
    setHasError(true);
    onStatusChange?.('failed');
  };

  // Only display fallback placeholder if src does not exist or image failed with error
  if (!src || hasError) {
    return (
      <div
        className={`relative flex flex-col items-center justify-center p-3 text-center bg-gray-100 ${className}`}
        style={{
          background: `linear-gradient(135deg, ${tenant?.primaryColour || '#059669'}10, #f1f5f9)`,
        }}
      >
        <Package
          className="w-8 h-8 mb-1.5 opacity-40"
          style={{ color: tenant?.primaryColour || '#059669' }}
        />
        <span className="text-[11px] font-bold text-gray-600 line-clamp-2 leading-tight px-1">
          {productName}
        </span>
        <span className="text-[9px] font-semibold text-gray-600 uppercase tracking-wider mt-1">
          {tenant?.brandName || 'Grocery'}
        </span>
        {badgeText && (
          <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white shadow-xs text-gray-700">
            {badgeText}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        key={src}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        className="w-full h-full object-cover"
      />
      {badgeText && (
        <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs shadow-xs text-gray-800">
          {badgeText}
        </span>
      )}
    </div>
  );
};

/**
 * CategoryImage
 * Displays a clean category placeholder with category icon on failure.
 */
export const CategoryImage: React.FC<
  BaseMediaProps & {
    categoryName: string;
  }
> = ({ src, alt, className = 'w-full h-full object-cover', categoryName, onStatusChange }) => {
  const { tenant } = useTenant();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const handleError = () => {
    setHasError(true);
    onStatusChange?.('failed');
  };

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-100 p-2 text-center rounded-xl border border-gray-200/60 ${className}`}
        style={{
          background: `linear-gradient(135deg, ${tenant?.primaryColour || '#059669'}08, #f8fafc)`,
        }}
      >
        <Tag className="w-6 h-6 text-gray-400 mb-1" />
        <span className="text-xs font-semibold text-gray-600 line-clamp-1">{categoryName}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        key={src}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={() => onStatusChange?.('loaded')}
        onError={handleError}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

/**
 * StoryImage
 * If image fails or breaks, triggers onStoryFailure so Story is completely hidden.
 */
export const StoryImage: React.FC<
  BaseMediaProps & {
    onStoryFailure?: () => void;
  }
> = ({ src, alt, className = 'w-full h-full object-cover', onStoryFailure }) => {
  const [status, setStatus] = useState<MediaLoadStatus>(src ? 'loading' : 'failed');

  const handleError = () => {
    setStatus('failed');
    onStoryFailure?.();
  };

  if (status === 'failed' || !src) {
    return null; // Story image failure: hide the Story completely
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gray-900/60 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onLoad={() => setStatus('loaded')}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};

/**
 * StoryVideo
 * If video playback or decode fails, triggers onStoryFailure to hide Story.
 */
export const StoryVideo: React.FC<{
  src: string;
  poster?: string;
  className?: string;
  onStoryFailure?: () => void;
}> = ({ src, poster, className = 'w-full h-full object-cover', onStoryFailure }) => {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return null; // Video failure hides the Story completely
  }

  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      playsInline
      muted
      loop
      onError={() => {
        setFailed(true);
        onStoryFailure?.();
      }}
      className={className}
    />
  );
};

/**
 * BrandImage (Logo)
 * Renders logo; upon failure, renders brand name / text fallback.
 */
export const BrandImage: React.FC<{
  logoUrl?: string;
  brandName: string;
  className?: string;
}> = ({ logoUrl, brandName, className = 'h-9 object-contain' }) => {
  const { tenant } = useTenant();
  const [failed, setFailed] = useState(!logoUrl);

  if (failed || !logoUrl) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-xs"
          style={{ backgroundColor: tenant?.primaryColour || '#059669' }}
        >
          {brandName.charAt(0)}
        </div>
        <span
          className="font-black tracking-tight text-lg"
          style={{ color: tenant?.textColour || '#0f172a' }}
        >
          {brandName}
        </span>
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={brandName}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

/**
 * HeroImage
 * Renders hero backdrop; upon failure, renders configured fallback gradient background.
 */
export const HeroImage: React.FC<{
  imageUrl?: string;
  fallbackGradient?: string;
  className?: string;
  children?: React.ReactNode;
}> = ({
  imageUrl,
  fallbackGradient = 'linear-gradient(135deg, #059669, #047857)',
  className = 'relative w-full rounded-2xl overflow-hidden p-6 md:p-10 text-white',
  children,
}) => {
  const [failed, setFailed] = useState(!imageUrl);

  return (
    <div
      className={className}
      style={{
        background: failed || !imageUrl ? fallbackGradient : undefined,
      }}
    >
      {imageUrl && !failed && (
        <img
          src={imageUrl}
          alt="Hero"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover -z-10 brightness-75"
        />
      )}
      {children}
    </div>
  );
};
