import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Story, StoryAction, Product, formatMoney } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import { resolveStoryMediaUrl } from '../../utils/storyMediaUtils';
import { parseStoryMedia, isGenericPlaceholder } from '../../utils/storyMediaUtils';
import { getDealForStory } from '../../commerce/dealModels';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  Layers,
  Plus,
  Volume2,
  VolumeX,
  Sparkles,
  Play,
} from 'lucide-react';

interface StoryViewerModalProps {
  stories: Story[];
  currentIndex: number | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  onStoryAction: (action: StoryAction, story?: Story) => void;
  products?: Product[];
  selectedStoreName?: string;
  onSelectProduct?: (product: Product) => void;
  onAddItemsToBasket?: (plus: string[], dealTitle?: string) => void;
  onOpenDealDialog?: (story: Story) => void;
  onFilterByDeal?: (story: Story) => void;
}

const DEFAULT_IMAGE_DURATION_MS = 6000;
const DEFAULT_VIDEO_DURATION_MS = 12000;

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  stories,
  currentIndex,
  onClose,
  onNext,
  onPrev,
  onStoryAction,
  products = [],
  selectedStoreName,
  onSelectProduct,
  onAddItemsToBasket,
  onOpenDealDialog,
  onFilterByDeal,
}) => {
  const { tenant } = useTenant();
  const [progress, setProgress] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [directVideoFailed, setDirectVideoFailed] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isOpen = currentIndex !== null && currentIndex >= 0 && currentIndex < stories.length;
  const currentStory = isOpen ? stories[currentIndex] : null;

  // Extract media info
  const currentFrame = currentStory?.items?.[0];
  const rawMediaUrl = currentFrame?.mediaUrl || currentStory?.mediaUrl || '';
  const explicitMediaType = currentFrame?.mediaType || currentStory?.mediaType;
  
  const parsedMedia = useMemo(() => {
    return parseStoryMedia(rawMediaUrl, explicitMediaType);
  }, [rawMediaUrl, explicitMediaType]);

  // Check for genuine Deliverect deal
  const activeDeal = useMemo(() => {
    if (!currentStory) return null;
    return getDealForStory(currentStory, products);
  }, [currentStory, products]);

  // Find linked products from catalogue
  const linkedProducts = useMemo(() => {
    if (!currentStory?.linkedProductPlus || currentStory.linkedProductPlus.length === 0) {
      return [];
    }
    return currentStory.linkedProductPlus
      .map((plu) => products.find((p) => p.plu === plu))
      .filter((p): p is Product => p !== undefined);
  }, [currentStory, products]);

  // Reset state on story switch
  useEffect(() => {
    setProgress(0);
    setDirectVideoFailed(false);
  }, [currentIndex]);

  // Direct video play / pause synchronization
  useEffect(() => {
    if (!isOpen || parsedMedia.provider !== 'direct' || !videoRef.current) return;

    if (isPaused) {
      videoRef.current.pause();
    } else {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay handled gracefully
        });
      }
    }
  }, [isOpen, isPaused, parsedMedia.provider, currentIndex]);

  // Timer-based progress bar for images and embedded videos (YouTube/Vimeo/Loom)
  useEffect(() => {
    if (!isOpen || isPaused || progress >= 100) return;
    if (parsedMedia.provider === 'direct' && !directVideoFailed) return;

    const frameSecs = currentFrame?.duration || (parsedMedia.mediaType === 'video' ? 12 : 6);
    const durationMs = frameSecs * 1000;
    const intervalMs = 40;
    const step = (intervalMs / durationMs) * 100;

    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + step;
        return next >= 100 ? 100 : next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, progress, parsedMedia.provider, parsedMedia.mediaType, directVideoFailed, currentFrame?.duration]);

  // Auto-advance when progress reaches 100%
  useEffect(() => {
    if (isOpen && progress >= 100) {
      onNext();
    }
  }, [isOpen, progress, onNext]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNext, onPrev]);

  if (!isOpen || !currentStory) return null;

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory) return;

    if (
      currentStory.stockMatchMode === 'AND' &&
      currentStory.linkedProductPlus &&
      currentStory.linkedProductPlus.length > 0
    ) {
      onAddItemsToBasket?.(currentStory.linkedProductPlus, currentStory.title);
    }

    if (currentStory.action) {
      onStoryAction(currentStory.action, currentStory);
    }
    onClose();
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.duration && !isNaN(video.duration) && video.duration > 0) {
      setProgress((video.currentTime / video.duration) * 100);
    }
  };

  const handleVideoEnded = () => {
    setProgress(100);
    onNext();
  };

  const effectiveThumbnail =
    (currentStory.thumbnailUrl && !isGenericPlaceholder(currentStory.thumbnailUrl)
      ? currentStory.thumbnailUrl
      : parsedMedia.thumbnailUrl) || undefined;

  return (
    <div
      id="story-viewer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none overflow-x-hidden"
    >
      {/* Story Container (Card Shape) */}
      <div
        className="relative w-full max-w-md h-full max-h-[92vh] sm:rounded-3xl overflow-hidden bg-slate-950 flex flex-col justify-between shadow-2xl"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* BACKGROUND MEDIA CANVAS */}
        <div className="absolute inset-0 z-0 bg-slate-950 overflow-hidden flex items-center justify-center">
          {parsedMedia.provider === 'youtube' && parsedMedia.embedUrl ? (
            /* YouTube Iframe Player */
            <div className="relative w-full h-full pointer-events-none">
              <iframe
                key={`${currentStory.id}-${parsedMedia.videoId}`}
                src={parsedMedia.embedUrl}
                title={currentStory.title}
                className="w-[140%] h-[120%] -ml-[20%] -mt-[10%] object-cover border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : parsedMedia.provider === 'vimeo' && parsedMedia.embedUrl ? (
            /* Vimeo Iframe Player */
            <div className="relative w-full h-full pointer-events-none">
              <iframe
                key={`${currentStory.id}-${parsedMedia.videoId}`}
                src={parsedMedia.embedUrl}
                title={currentStory.title}
                className="w-[140%] h-[120%] -ml-[20%] -mt-[10%] object-cover border-0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : parsedMedia.provider === 'loom' && parsedMedia.embedUrl ? (
            /* Loom Iframe Player */
            <div className="relative w-full h-full pointer-events-none">
              <iframe
                key={`${currentStory.id}-${parsedMedia.videoId}`}
                src={parsedMedia.embedUrl}
                title={currentStory.title}
                className="w-full h-full object-cover border-0"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          ) : parsedMedia.provider === 'direct' && !directVideoFailed ? (
            /* Native Direct Video (MP4 / WebM / Cloud Video) */
            <video
              ref={videoRef}
              key={`${currentStory.id}-${parsedMedia.rawUrl}`}
              src={parsedMedia.rawUrl}
              poster={effectiveThumbnail}
              aria-label={currentStory.title}
              autoPlay
              muted={isMuted}
              playsInline
              preload="auto"
              className="w-full h-full object-cover"
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onError={() => setDirectVideoFailed(true)}
            />
          ) : (
            /* Image / Fallback Background */
            <img
              src={parsedMedia.rawUrl || effectiveThumbnail}
              alt={currentStory.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to effective thumbnail or placeholder
                if (e.currentTarget.src !== effectiveThumbnail) {
                  e.currentTarget.src = effectiveThumbnail;
                }
              }}
            />
          )}

          {/* Gradients for high-contrast legible text */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85 pointer-events-none" />
        </div>

        {/* TAP NAVIGATION TOUCH ZONES (Left 35% for Previous, Right 65% for Next) */}
        <div className="absolute inset-0 z-10 flex pointer-events-auto">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={onPrev}
            aria-label="Previous story"
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={onNext}
            aria-label="Next story"
          />
        </div>

        {/* TOP CONTROLS & SEGMENTED PROGRESS BARS */}
        <div className="relative z-20 p-4 pt-5 pointer-events-none">
          {/* Progress Bars for all stories in sequence */}
          <div className="flex items-center gap-1.5 mb-3">
            {stories.map((s, idx) => {
              let fill = 0;
              if (idx < currentIndex) fill = 100;
              else if (idx === currentIndex) fill = progress;

              return (
                <div
                  key={s.id}
                  className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden"
                >
                  <div
                    className="h-full bg-white transition-all duration-75 ease-linear rounded-full"
                    style={{ width: `${fill}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Header Bar */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white p-0.5 border border-white/50 shadow-xs shrink-0">
                <img
                  src={tenant?.iconUrl || tenant?.logoUrl || effectiveThumbnail}
                  alt={tenant?.brandName}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight drop-shadow-xs">
                  {currentStory.author || tenant?.brandName || 'Market Lane'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-white/80 leading-tight">
                    {currentStory.tag || 'Featured Story'}
                  </span>
                  {parsedMedia.mediaType === 'video' && (
                    <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[9px] font-bold text-white flex items-center gap-1">
                      <Play className="w-2 h-2 fill-white" />
                      <span>{parsedMedia.provider === 'youtube' ? 'YouTube' : 'Video'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sound Toggle (Direct Videos) */}
              {parsedMedia.provider === 'direct' && !directVideoFailed && (
                <button
                  type="button"
                  id="toggle-story-sound-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted((prev) => !prev);
                  }}
                  className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-xs cursor-pointer"
                  aria-label={isMuted ? 'Unmute story' : 'Mute story'}
                >
                  {isMuted ? (
                    <VolumeX className="w-4 h-4 text-white/80" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  )}
                </button>
              )}

              {/* Close Button */}
              <button
                type="button"
                id="close-story-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-xs cursor-pointer"
                aria-label="Close stories"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Side Chevron Indicators */}
        <div className="hidden sm:block absolute left-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {currentIndex > 0 && (
            <div className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-xs">
              <ChevronLeft className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {currentIndex < stories.length - 1 && (
            <div className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-xs">
              <ChevronRight className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* BOTTOM STORY CONTENT & CALL TO ACTION */}
        <div className="relative z-20 p-5 pb-7 flex flex-col gap-3 pointer-events-auto">
          <div>
            <h2 className="text-xl font-extrabold text-white leading-tight drop-shadow-md">
              {currentStory.title}
            </h2>
            {currentStory.caption && (
              <p className="text-xs text-white/90 mt-1 leading-relaxed drop-shadow-sm line-clamp-3">
                {currentStory.caption}
              </p>
            )}
          </div>

          {/* Linked Stock Verification Card */}
          {linkedProducts.length > 0 && (
            <div className="bg-black/70 backdrop-blur-md rounded-2xl p-3 border border-white/15 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-200">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {activeDeal
                    ? `Combo Deal • All ${linkedProducts.length} Items in Stock`
                    : `Featured Products (${linkedProducts.length})`}
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                  {currentStory.stockMatchMode === 'AND' ? 'All Required' : 'Any Available'}
                </span>
              </div>

              {/* Product items scroll */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {linkedProducts.map((p) => {
                  if (!p) return null;
                  const prodName = p.name || p.plu || 'Product';
                  return (
                    <button
                      key={p.plu}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProduct?.(p);
                        onClose();
                      }}
                      className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-left group cursor-pointer"
                    >
                      <img
                        src={p.imageUrl}
                        alt={prodName}
                        className="w-7 h-7 rounded-lg object-cover bg-gray-800"
                      />
                      <div className="max-w-[110px]">
                        <p className="text-[11px] font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                          {prodName}
                        </p>
                        <p className="text-[10px] text-emerald-400 font-mono font-bold">
                          {formatMoney(p.price)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Deal Breakdown Button or Add All button */}
              {activeDeal && onOpenDealDialog ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDealDialog(currentStory);
                    onClose();
                  }}
                  className="w-full py-1.5 px-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-300" />
                  <span>View Combo Deal Details</span>
                </button>
              ) : onAddItemsToBasket && linkedProducts.length > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const plus = linkedProducts.map((p) => p.plu);
                    onAddItemsToBasket(plus, currentStory.title);
                    onClose();
                  }}
                  className="w-full py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Add All ({linkedProducts.length}) to Basket</span>
                </button>
              ) : null}
            </div>
          )}

          {/* Action Button */}
          {currentStory.action && (
            <button
              type="button"
              id="story-action-button"
              onClick={handleActionClick}
              className="w-full py-3 px-4 rounded-2xl bg-white text-gray-900 font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:bg-gray-100 transition-all active:scale-98 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
              <span>{currentStory.action.buttonLabel || 'Shop Story Feature'}</span>
              <ArrowRight className="w-4 h-4 ml-auto text-gray-500" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
