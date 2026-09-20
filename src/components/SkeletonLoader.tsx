import React from 'react';

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-xs animate-pulse flex flex-col justify-between">
      <div className="w-full aspect-square rounded-xl bg-gray-200 mb-3" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-200 rounded-md w-1/3" />
        <div className="h-4 bg-gray-200 rounded-md w-4/5" />
        <div className="h-4 bg-gray-200 rounded-md w-2/3" />
      </div>
      <div className="mt-4 pt-2 border-t border-gray-50 flex items-center justify-between">
        <div className="h-5 bg-gray-200 rounded-md w-12" />
        <div className="h-8 bg-gray-200 rounded-full w-16" />
      </div>
    </div>
  );
};

export const StoryBubbleSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0 animate-pulse">
      <div className="w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-full bg-gray-200" />
      <div className="h-2.5 bg-gray-200 rounded-md w-14" />
    </div>
  );
};

export const CategoryPillSkeleton: React.FC = () => {
  return (
    <div className="h-10 w-28 bg-gray-200 rounded-full shrink-0 animate-pulse" />
  );
};
