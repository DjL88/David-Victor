import { useState, useEffect, useCallback } from 'react';
import { Story } from '../commerce/models';
import { useTenant } from '../tenant/TenantContext';

export function useStories(selectedStoreId?: string) {
  const { client } = useTenant();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);

  const fetchStories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.getStories({ storeId: selectedStoreId });
      setStories(Array.isArray(res) ? res : []);
    } catch (err) {
      console.warn('[useStories] Could not load stories from backend:', err);
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [client, selectedStoreId]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const openStory = useCallback((index: number) => {
    setActiveStoryIndex(index);
  }, []);

  const closeStory = useCallback(() => {
    setActiveStoryIndex(null);
  }, []);

  const nextStory = useCallback(() => {
    setActiveStoryIndex((prev) => {
      if (prev === null) return null;
      if (prev < stories.length - 1) {
        return prev + 1;
      }
      return null;
    });
  }, [stories.length]);

  const prevStory = useCallback(() => {
    setActiveStoryIndex((prev) => {
      if (prev === null) return null;
      if (prev > 0) {
        return prev - 1;
      }
      return prev;
    });
  }, []);

  return {
    stories,
    loading,
    activeStoryIndex,
    activeStory: activeStoryIndex !== null ? stories[activeStoryIndex] : null,
    openStory,
    closeStory,
    nextStory,
    prevStory,
    refreshStories: fetchStories,
  };
}
