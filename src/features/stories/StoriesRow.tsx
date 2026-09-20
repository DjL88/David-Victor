import React from 'react';
import { Story } from '../../commerce/models';
import { StoryBubbleSkeleton } from '../../components/SkeletonLoader';
import { StoryThumbnailMedia } from '../../components/media/Media';
import { parseStoryMedia } from '../../utils/storyMediaUtils';
import { Flame, Play } from 'lucide-react';

interface StoriesRowProps {
  stories: Story[];
  loading: boolean;
  onSelectStory: (index: number) => void;
}

export const StoriesRow: React.FC<StoriesRowProps> = ({
  stories,
  loading,
  onSelectStory,
}) => {
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
    <div id="stories-section" className="pt-1 pb-0 mb-1 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between px-4 mb-1.5">
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

      <div className="overflow-x-auto no-scrollbar scroll-smooth scroll-px-4 px-4 pt-1 pb-0 w-full max-w-full">
        <div className="flex items-center gap-4.5 px-2 min-w-max pt-1 pb-1 pr-6">
          {stories.map((story, index) => {
            const firstFrame = story.items?.[0];
            const sourceMediaUrl = firstFrame?.mediaUrl || story.mediaUrl || '';
            let mediaUrl = sourceMediaUrl;
            try { mediaUrl = decodeURI(sourceMediaUrl); } catch { /* keep original valid URL */ }
            const explicitMediaType = firstFrame?.mediaType || story.mediaType;
            const parsed = parseStoryMedia(mediaUrl, explicitMediaType);
            const isVideo = parsed.mediaType === 'video';

            return (
              <button
                key={story.id}
                id={`story-bubble-${story.id}`}
                type="button"
                onClick={() => onSelectStory(index)}
                className="group flex flex-col items-center gap-1.5 p-0.5 focus:outline-hidden transition-transform active:scale-95 cursor-pointer"
              >
                {/* Instagram-style Ring Gradient */}
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-indigo-600 shadow-xs group-hover:scale-105 transition-transform duration-200">
                  <div className="p-0.5 rounded-full bg-white">
                    <div className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-full overflow-hidden bg-gray-100 flex items-center justify-center relative">
                      <StoryThumbnailMedia
                        mediaUrl={mediaUrl}
                        mediaType={explicitMediaType}
                        thumbnailUrl={story.thumbnailUrl}
                        alt={story.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>

                  {/* Video Play Badge Indicator */}
                  {isVideo && (
                    <div className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 backdrop-blur-xs flex items-center justify-center border border-white/70 shadow-2xs">
                      <Play className="w-2.5 h-2.5 text-white fill-white translate-x-0.2" />
                    </div>
                  )}

                  {/* Tag badge */}
                  {story.tag && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded-full bg-indigo-600 text-white shadow-2xs whitespace-nowrap">
                      {story.tag}
                    </span>
                  )}
                </div>

                <span className="text-xs font-medium text-gray-800 max-w-[88px] truncate text-center group-hover:text-indigo-600 transition-colors">
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
