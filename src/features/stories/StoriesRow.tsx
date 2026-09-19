import React, { useState } from 'react';
import { Story } from '../../commerce/models';
import { StoryBubbleSkeleton } from '../../components/SkeletonLoader';
import { useTenantStyles } from '../../tenant/useTenant';
import { Flame, Film } from 'lucide-react';

interface StoriesRowProps {
  stories: Story[];
  loading: boolean;
  onSelectStory: (index: number) => void;
}

const isVideoUrl = (url?: string, type?: string) => {
  if (!url) return false;
  if (type === 'video' || type === 'STORY_VIDEO') return true;
  try {
    const decoded = decodeURIComponent(url.toLowerCase().split('?')[0]);
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
      url.startsWith('data:video/') ||
      url.includes('video/mp4') ||
      url.includes('video%2Fmp4')
    );
  } catch {
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov');
  }
};

export const StoriesRow: React.FC<StoriesRowProps> = ({
  stories,
  loading,
  onSelectStory,
}) => {
  const { brandName } = useTenantStyles();
  const [erroredMedia, setErroredMedia] = useState<Record<string, boolean>>({});

  if (loading) {
    return (
      <div className="py-2 overflow-x-auto no-scrollbar w-full max-w-full">
        <div className="flex items-center gap-3.5 px-4">
          {[...Array(6)].map((_, i) => (
            <StoryBubbleSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!stories || stories.length === 0) {
    return null;
  }

  return (
    <div id="stories-section" className="py-2.5 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-1.5">
          <Flame className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-bold text-gray-900 tracking-tight">
            Stories & Trending
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-gray-500">
          Tap to view
        </span>
      </div>

      <div className="overflow-x-auto no-scrollbar scroll-smooth scroll-px-4 px-4 py-1.5 w-full max-w-full">
        <div className="flex items-center gap-4 px-4 min-w-max pt-2 pb-3 pr-8">
          {stories.map((story, index) => {
            const isThumbVideo = isVideoUrl(story.thumbnailUrl);
            const thumbIsImage = story.thumbnailUrl && !isThumbVideo;
            const displayMedia = thumbIsImage ? story.thumbnailUrl : (story.mediaUrl || story.thumbnailUrl);
            const isVid = !thumbIsImage && isVideoUrl(displayMedia, story.mediaType);
            const videoSrc = displayMedia && isVid
              ? (displayMedia.includes('#') ? displayMedia : `${displayMedia}#t=0.001`)
              : displayMedia;
            const hasError = erroredMedia[story.id];

            return (
              <button
                key={story.id}
                id={`story-bubble-${story.id}`}
                type="button"
                onClick={() => onSelectStory(index)}
                className="group flex flex-col items-center gap-1.5 p-1 focus:outline-hidden transition-transform active:scale-95 cursor-pointer"
              >
                {/* Instagram-style Ring Gradient */}
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <div className="p-0.5 rounded-full bg-white">
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden bg-gray-900 flex items-center justify-center relative">
                      {hasError ? (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-950 text-white font-extrabold text-sm">
                          {story.title.slice(0, 2).toUpperCase()}
                        </div>
                      ) : isVid && videoSrc ? (
                        <video
                          ref={(el) => {
                            if (el) {
                              el.muted = true;
                              el.defaultMuted = true;
                            }
                          }}
                          src={videoSrc}
                          muted
                          playsInline
                          autoPlay={false}
                          preload="auto"
                          onError={() => setErroredMedia((prev) => ({ ...prev, [story.id]: true }))}
                          className="w-full h-full object-cover group-hover:rotate-1 transition-transform pointer-events-none"
                        />
                      ) : (
                        <img
                          src={displayMedia}
                          alt={story.title}
                          loading="lazy"
                          onError={() => setErroredMedia((prev) => ({ ...prev, [story.id]: true }))}
                          className="w-full h-full object-cover group-hover:rotate-1 transition-transform"
                        />
                      )}

                      {/* Small Video Badge Indicator if Video Story */}
                      {isVid && !hasError && (
                        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white shadow-xs pointer-events-none">
                          <Film className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  </div>

                  {story.tag && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-indigo-600 text-white shadow-2xs whitespace-nowrap">
                      {story.tag}
                    </span>
                  )}
                </div>

                <span className="text-xs font-medium text-gray-800 max-w-[76px] truncate text-center group-hover:text-indigo-600 transition-colors">
                  {story.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
