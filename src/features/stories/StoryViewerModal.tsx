import React, { useState, useEffect } from 'react';
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
  const [mediaFailed, setMediaFailed] = useState<boolean>(false);

  const isOpen = currentIndex !== null && currentIndex >= 0 && currentIndex < stories.length;
  const currentStory = isOpen ? stories[currentIndex] : null;

  // Find linked products from catalogue
  const linkedProducts = React.useMemo(() => {
    if (!currentStory?.linkedProductPlus || currentStory.linkedProductPlus.length === 0) {
      return [];
    }
    return currentStory.linkedProductPlus
      .map((plu) => products.find((p) => p.plu === plu))
      .filter((p): p is Product => p !== undefined);
  }, [currentStory, products]);

  // Reset progress on story change
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  // Handle story progress tick
  useEffect(() => {
    if (!isOpen || isPaused || progress >= 100) return;

    const interval = 50;
    const step = (interval / STORY_DURATION_MS) * 100;

    const timer = window.setInterval(() => {
      setProgress((prev) => Math.min(100, prev + step));
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [isOpen, isPaused, progress >= 100]);

  // Advance to next story safely after render cycle when progress reaches 100%
  useEffect(() => {
    if (isOpen && progress >= 100) {
      onNext();
    }
  }, [isOpen, progress, onNext]);

  // Handle keyboard navigation
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
        {/* Story Background Media */}
        <div className="absolute inset-0 z-0">
          {!currentMediaUrl || mediaFailed ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white/80 px-6 text-center">
              <p className="text-sm font-semibold">Story media is unavailable</p>
            </div>
          ) : isVideoMedia ? (
            <video
              key={currentStory.id}
              src={currentMediaUrl}
              poster={currentStory.thumbnailUrl}
              aria-label={currentStory.title}
              autoPlay
              muted
              playsInline
              loop
              preload="metadata"
              className="w-full h-full object-cover"
              onPlay={() => setIsPaused(false)}
              onPause={() => setIsPaused(true)}
              onError={() => setMediaFailed(true)}
            />
          ) : (
            <img
              src={currentMediaUrl}
              alt={currentStory.title}
              className="w-full h-full object-cover"
            />
          )}
          {/* Subtle Top & Bottom Gradients for readable text */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
        </div>

        {/* Tap Navigation Zones */}
        <div className="absolute inset-0 z-10 flex">
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

        {/* Top Controls & Segmented Progress Bars */}
        <div className="relative z-20 p-4 pt-5">
          {/* Progress Bars */}
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
                <p className="text-[10px] text-white/80 leading-tight">
                  {currentStory.tag || 'Official Brand Story'}
                </p>
              </div>
            </div>

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

        {/* Desktop Arrow Indicators */}
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

        {/* Bottom Story Information & Interactive Call to Action */}
        <div className="relative z-20 p-5 pb-7 flex flex-col gap-3">
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

          {/* Linked Products & AND/OR Stock Verification Indicator */}
          {linkedProducts.length > 0 && (
            <div className="bg-black/70 backdrop-blur-md rounded-2xl p-3 border border-white/15 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-gray-200">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {currentStory.stockMatchMode === 'AND'
                    ? `Meal Deal • All ${linkedProducts.length} Items in Stock`
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
