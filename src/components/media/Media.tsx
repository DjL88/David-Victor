import React, { useState, useEffect, useRef } from 'react';
import { Package, Tag, AlertCircle, Loader2, Play } from 'lucide-react';
import { useTenant } from '../../tenant/TenantContext';
import { parseStoryMedia, isGenericPlaceholder } from '../../utils/storyMediaUtils';

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
 * Supports direct video, YouTube, Vimeo, Loom, and fallback previews.
 */
export const StoryVideo: React.FC<{
  src: string;
  poster?: string;
  className?: string;
  onStoryFailure?: () => void;
}> = ({ src, poster, className = 'w-full h-full object-cover', onStoryFailure }) => {
  const [failed, setFailed] = useState(false);
  const parsed = parseStoryMedia(src);

  if (failed || !src) {
    if (poster) {
      return <img src={poster} alt="Story video preview" className={className} />;
    }
    return null;
  }

  if (parsed.provider === 'youtube' && parsed.embedUrl) {
    return (
      <iframe
        src={parsed.embedUrl}
        title="Story video"
        className={`border-0 ${className}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (parsed.provider === 'vimeo' && parsed.embedUrl) {
    return (
      <iframe
        src={parsed.embedUrl}
        title="Story video"
        className={`border-0 ${className}`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  if (parsed.provider === 'loom' && parsed.embedUrl) {
    return (
      <iframe
        src={parsed.embedUrl}
        title="Story video"
        className={`border-0 ${className}`}
        allow="autoplay; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <video
      src={parsed.rawUrl}
      poster={poster || parsed.thumbnailUrl}
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
 * StoryThumbnailMedia
 * Renders authentic video preview or image thumbnail for story bubbles and preview cards.
 * Handles:
 * 1. Direct Video files (MP4/WebM) via autoplaying muted micro-loop video
 * 2. YouTube auto-generated high-res thumbnails with cascade fallbacks
 * 3. Vimeo / Loom video preview frames
 * 4. Custom story thumbnail images (ignoring generic placeholder fallbacks)
 */
export const StoryThumbnailMedia: React.FC<{
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | string;
  thumbnailUrl?: string;
  alt: string;
  className?: string;
  onStoryFailure?: () => void;
}> = ({
  mediaUrl,
  mediaType,
  thumbnailUrl,
  alt,
  className = 'w-full h-full object-cover',
  onStoryFailure,
}) => {
  const [ytErrorCount, setYtErrorCount] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const parsed = parseStoryMedia(mediaUrl, mediaType);

  // Trigger silent autoplay on mount for direct videos
  useEffect(() => {
    if (videoRef.current && parsed.provider === 'direct') {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      const p = videoRef.current.play();
      if (p !== undefined) {
        p.catch(() => {
          // Handled silently
        });
      }
    }
  }, [parsed.rawUrl, parsed.provider]);

  // 1. YouTube Video - Instant official high-res video frame thumbnail
  if (parsed.provider === 'youtube' && parsed.videoId) {
    const ytThumbnails = [
      `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${parsed.videoId}/hqdefault.jpg`,
      `https://img.youtube.com/vi/${parsed.videoId}/0.jpg`,
      `https://img.youtube.com/vi/${parsed.videoId}/mqdefault.jpg`,
    ];
    const currentYtSrc = ytThumbnails[Math.min(ytErrorCount, ytThumbnails.length - 1)];

    return (
      <img
        src={currentYtSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="eager"
        onError={() => {
          if (ytErrorCount < ytThumbnails.length - 1) {
            setYtErrorCount((prev) => prev + 1);
          }
        }}
        className={className}
      />
    );
  }

  // 2. Vimeo Video - Instant video snapshot frame
  if (parsed.provider === 'vimeo' && parsed.videoId) {
    return (
      <img
        src={`https://vumbnail.com/${parsed.videoId}.jpg`}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="eager"
        onError={(e) => {
          e.currentTarget.src = `https://vumbnail.com/${parsed.videoId}_large.jpg`;
        }}
        className={className}
      />
    );
  }

  // 3. Loom Video - Instant video snapshot frame
  if (parsed.provider === 'loom' && parsed.videoId) {
    return (
      <img
        src={`https://cdn.loom.com/sessions/thumbnails/${parsed.videoId}-00001.jpg`}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="eager"
        onError={(e) => {
          e.currentTarget.src = `https://cdn.loom.com/sessions/thumbnails/${parsed.videoId}-with-play.gif`;
        }}
        className={className}
      />
    );
  }

  // 4. Direct Video file (MP4, WebM, MOV, Cloud storage)
  if (parsed.provider === 'direct' && parsed.rawUrl) {
    const posterSrc =
      thumbnailUrl && !isGenericPlaceholder(thumbnailUrl)
        ? thumbnailUrl
        : undefined;

    return (
      <div className="relative w-full h-full overflow-hidden bg-slate-900 flex items-center justify-center">
        {posterSrc && (
          <img
            src={posterSrc}
            alt={alt}
            referrerPolicy="no-referrer"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              videoLoaded ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}
        <video
          ref={videoRef}
          src={parsed.rawUrl}
          poster={posterSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={() => {
            setVideoLoaded(true);
            void videoRef.current?.play().catch(() => undefined);
          }}
          onCanPlay={() => setVideoLoaded(true)}
          className={`${className} pointer-events-none object-cover w-full h-full`}
        />
      </div>
    );
  }

  // 5. Valid custom thumbnail image (if not a placeholder)
  const isCustomThumbValid =
    thumbnailUrl &&
    thumbnailUrl.trim() !== '' &&
    !isGenericPlaceholder(thumbnailUrl);

  if (isCustomThumbValid) {
    return (
      <img
        src={thumbnailUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="eager"
        className={className}
      />
    );
  }

  // 6. Standard Image Story
  if (parsed.rawUrl) {
    return (
      <img
        src={parsed.rawUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="eager"
        className={className}
      />
    );
  }

  // 7. Video fallback (if mediaType === 'video' but url is resolving)
  if (mediaType === 'video' && mediaUrl) {
    return (
      <video
        ref={videoRef}
        src={`${mediaUrl}#t=0.1`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={`${className} pointer-events-none object-cover w-full h-full`}
      />
    );
  }

  // Default fallback image
  return (
    <img
      src={thumbnailUrl || mediaUrl || ''}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="eager"
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
