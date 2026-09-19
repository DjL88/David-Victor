import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Story, StoryAction, Product, formatMoney } from '../../commerce/models';
import { useTenant } from '../../tenant/TenantContext';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ShoppingBag,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  Layers,
  Filter,
  Plus,
  Volume2,
  VolumeX,
  Film,
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

const STORY_DURATION_MS = 6000;

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
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [mediaError, setMediaError] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isOpen = currentIndex !== null && currentIndex >= 0 && currentIndex < stories.length;
  const currentStory = isOpen ? stories[currentIndex] : null;

  // Active story frames (support multi-frame/multi-slide stories with graceful fallback)
  const activeFrames = useMemo(() => {
    if (currentStory?.items && currentStory.items.length > 0) {
      return currentStory.items;
    }
    return [
      {
        id: currentStory?.id || 'frame-1',
        mediaUrl: currentStory?.mediaUrl || '',
        mediaType: currentStory?.mediaType || 'image',
        caption: currentStory?.caption,
        duration: 5,
      },
    ];
  }, [currentStory]);

  const currentFrame = activeFrames[activeFrameIndex] || activeFrames[0];
  const currentMediaUrl = currentFrame?.mediaUrl || currentStory?.mediaUrl || '';
  const currentMediaType = currentFrame?.mediaType || currentStory?.mediaType || 'image';

  // Video detection helper supporting MP4, WebM, MOV, data URIs, and explicit types
  const isVideo = useMemo(() => {
    if (!currentMediaUrl) return false;
    if (currentMediaType === 'video' || currentMediaType === 'STORY_VIDEO') return true;
    try {
      const decoded = decodeURIComponent(currentMediaUrl.toLowerCase().split('?')[0]);
      return (
        decoded.endsWith('.mp4') ||
        decoded.includes('.mp4') ||
        decoded.endsWith('.webm') ||
        decoded.includes('.webm') ||
        decoded.endsWith('.mov') ||
        decoded.includes('.mov') ||
        decoded.endsWith('.m4v') ||
        decoded.includes('.m4v') ||
        decoded.endsWith('.ogg') ||
        decoded.includes('.ogg') ||
        currentMediaUrl.startsWith('data:video/') ||
        currentMediaUrl.includes('video/mp4') ||
        currentMediaUrl.includes('video%2Fmp4')
      );
    } catch {
      const lower = currentMediaUrl.toLowerCase();
      return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov');
    }
  }, [currentMediaUrl, currentMediaType]);

  // Frame duration in milliseconds
  const frameDurationMs = useMemo(() => {
    if (currentFrame?.duration && currentFrame.duration > 0) {
      return currentFrame.duration * 1000;
    }
    return STORY_DURATION_MS;
  }, [currentFrame]);

  // Find linked products from catalogue
  const linkedProducts = useMemo(() => {
    if (!currentStory?.linkedProductPlus || currentStory.linkedProductPlus.length === 0) {
      return [];
    }
    return currentStory.linkedProductPlus
      .map((plu) => products.find((p) => p.plu === plu))
      .filter((p): p is Product => p !== undefined);
  }, [currentStory, products]);

  // Reset frame, progress, and media error on story change
  useEffect(() => {
    setActiveFrameIndex(0);
    setProgress(0);
    setMediaError(false);
  }, [currentIndex]);

  // Reset progress and media error on frame change
  useEffect(() => {
    setProgress(0);
    setMediaError(false);
  }, [activeFrameIndex]);

  // Advance frame navigation handlers
  const handleNextFrame = useCallback(() => {
    if (activeFrameIndex < activeFrames.length - 1) {
      setActiveFrameIndex((prev) => prev + 1);
    } else {
      onNext();
    }
  }, [activeFrameIndex, activeFrames.length, onNext]);

  const handlePrevFrame = useCallback(() => {
    if (activeFrameIndex > 0) {
      setActiveFrameIndex((prev) => prev - 1);
    } else {
      onPrev();
    }
  }, [activeFrameIndex, onPrev]);

  // Handle story progress tick
  useEffect(() => {
    if (!isOpen || isPaused || progress >= 100) return;

    const interval = 50;
    const step = (interval / frameDurationMs) * 100;

    const timer = window.setInterval(() => {
      setProgress((prev) => Math.min(100, prev + step));
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [isOpen, isPaused, progress >= 100, frameDurationMs]);

  // Advance to next frame safely when progress reaches 100%
  useEffect(() => {
    if (isOpen && progress >= 100) {
      handleNextFrame();
    }
  }, [isOpen, progress, handleNextFrame]);

  // Pause / Resume HTML5 video element synchronously with user interaction
  useEffect(() => {
    if (videoRef.current) {
      if (isPaused) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNextFrame();
      if (e.key === 'ArrowLeft') handlePrevFrame();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNextFrame, handlePrevFrame]);

  if (!isOpen || !currentStory) return null;

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentStory) return;

    // "if story is an 'AND' then add all items to basket"
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

  const activeCaption = currentFrame?.caption || currentStory.caption;

  return (
    <div
      id="story-viewer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md select-none overflow-x-hidden"
    >
      {/* Desktop Container */}
      <div
        className="relative w-full max-w-md h-full max-h-[92vh] sm:rounded-3xl overflow-hidden bg-black flex flex-col justify-between shadow-2xl overflow-x-hidden"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Story Background Media (Auto detects Video vs Image) */}
        <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
          {isVideo ? (
            <video
              ref={(el) => {
                videoRef.current = el;
                if (el) {
                  el.muted = isMuted;
                  el.defaultMuted = isMuted;
                }
              }}
              key={currentMediaUrl}
              src={currentMediaUrl}
              playsInline
              autoPlay
              muted={isMuted}
              preload="auto"
              loop={false}
              onEnded={handleNextFrame}
              onLoadedData={() => setMediaError(false)}
              onPlay={() => setMediaError(false)}
              onError={(e) => {
                console.warn('[StoryViewer] Video media error:', e);
                setMediaError(true);
              }}
              className="w-full h-full object-cover"
            >
              <source src={currentMediaUrl} type="video/mp4" />
              <source src={currentMediaUrl} />
            </video>
          ) : (
            <img
              key={currentMediaUrl}
              src={currentMediaUrl}
              alt={currentStory.title}
              onError={() => {
                console.warn('[StoryViewer] Image media error');
                setMediaError(true);
              }}
              className="w-full h-full object-cover"
            />
          )}

          {/* Graceful Fallback if Media Asset is unavailable or blocked */}
          {mediaError && (
            <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-6 text-center z-1">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">
                <Film className="w-6 h-6 text-white/70" />
              </div>
              <p className="text-sm font-bold text-white mb-1">{currentStory.title}</p>
              <p className="text-xs text-white/60 max-w-xs">
                {isVideo ? 'Video format could not be played.' : 'Media asset could not be loaded.'}
              </p>
            </div>
          )}

          {/* Subtle Top & Bottom Gradients for readable text */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
        </div>

        {/* Tap Navigation Zones (Left 1/3 = Prev Frame, Right 2/3 = Next Frame) */}
        <div className="absolute inset-0 z-10 flex">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={handlePrevFrame}
            aria-label="Previous story frame"
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={handleNextFrame}
            aria-label="Next story frame"
          />
        </div>

        {/* Top Controls & Segmented Progress Bars */}
        <div className="relative z-20 p-4 pt-5">
          {/* Progress Bars (Segments for each frame of this story) */}
          <div className="flex items-center gap-1.5 mb-3">
            {activeFrames.map((f, idx) => {
              let fill = 0;
              if (idx < activeFrameIndex) fill = 100;
              else if (idx === activeFrameIndex) fill = progress;

              return (
                <div
                  key={f.id || idx}
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-white p-0.5 border border-white/50">
                <img
                  src={tenant?.iconUrl || tenant?.logoUrl}
                  alt={tenant?.brandName}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-white leading-tight drop-shadow-xs">
                  {tenant?.brandName}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-white/80 leading-tight">
                    {currentStory.tag || 'Official Brand Story'}
                  </p>
                  {activeFrames.length > 1 && (
                    <span className="text-[9px] text-white/60 font-mono">
                      • {activeFrameIndex + 1}/{activeFrames.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Sound Mute/Unmute Toggle for Video Stories */}
              {isVideo && (
                <button
                  type="button"
                  id="toggle-story-sound-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted((prev) => !prev);
                  }}
                  className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors backdrop-blur-xs cursor-pointer"
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  title={isMuted ? 'Unmute audio' : 'Mute audio'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                </button>
              )}

              <button
                type="button"
                id="close-story-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors backdrop-blur-xs"
                aria-label="Close stories"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Arrow Indicators */}
        <div className="hidden sm:block absolute left-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {(currentIndex > 0 || activeFrameIndex > 0) && (
            <div className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-xs">
              <ChevronLeft className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className="hidden sm:block absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
          {(currentIndex < stories.length - 1 || activeFrameIndex < activeFrames.length - 1) && (
            <div className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-xs">
              <ChevronRight className="w-5 h-5" />
            </div>
          )}
        </div>

        {/* Bottom Story Information & Interactive Call to Action */}
        <div className="relative z-20 p-5 pb-7 flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white leading-tight drop-shadow-md">
              {currentStory.title}
            </h2>
            {activeCaption && (
              <p className="text-xs text-white/90 mt-1 leading-relaxed drop-shadow-sm line-clamp-3">
                {activeCaption}
              </p>
            )}
          </div>

          {/* Linked Products & AND/OR Stock Verification Indicator */}
          {linkedProducts.length > 0 && (
            <div className="bg-black/70 backdrop-blur-md rounded-2xl p-3 border border-white/15 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-200">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {currentStory.stockMatchMode === 'AND'
                    ? `Combo Deal • All ${linkedProducts.length} Items in Stock`
                    : `In Stock at ${selectedStoreName || 'Local Store'}`}
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                  {currentStory.stockMatchMode === 'AND' ? 'Bundle (AND)' : 'Flavours (OR)'}
                </span>
              </div>

              {/* Product items horizontal scroll */}
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

              {/* Options to Filter Catalogue or Open Dialog of All Items */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                {onOpenDealDialog && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDealDialog(currentStory);
                      onClose();
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-300" />
                    <span>View Deal Breakdown</span>
                  </button>
                )}

                {onFilterByDeal && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFilterByDeal(currentStory);
                      onClose();
                    }}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Filter Catalogue</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Interactive CTA button: If AND, adds all items to basket */}
          <button
            type="button"
            id="story-action-cta"
            onClick={handleActionClick}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl active:scale-[0.98] transition-all cursor-pointer ${
              currentStory.stockMatchMode === 'AND'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-black'
                : 'bg-white hover:bg-gray-100 text-gray-900'
            }`}
          >
            {currentStory.stockMatchMode === 'AND' ? (
              <>
                <ShoppingBag className="w-4 h-4 text-gray-950" />
                <span>
                  {currentStory.action?.buttonLabel ||
                    `Add All ${linkedProducts.length} Items to Basket`}
                </span>
                <span className="ml-1 px-2 py-0.5 rounded-full bg-black/20 text-gray-950 text-[10px] font-black uppercase tracking-wider">
                  AND Deal
                </span>
              </>
            ) : currentStory.action?.type === 'PRODUCT' ? (
              <>
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>{currentStory.action?.buttonLabel || 'View Product'}</span>
              </>
            ) : currentStory.action?.type === 'CATEGORY' ? (
              <>
                <ArrowRight className="w-4 h-4 text-emerald-600" />
                <span>{currentStory.action?.buttonLabel || 'Explore Category'}</span>
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 text-emerald-600" />
                <span>{currentStory.action?.buttonLabel || 'Learn More'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
