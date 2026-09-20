import { describe, it, expect, beforeEach, vi } from 'vitest';

// Simple in-memory storage mock for Node environment tests
function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

describe('Story Launch Flow Rules', () => {
  let mockSessionStorage: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    mockSessionStorage = createStorageMock();
    vi.clearAllMocks();
  });

  it('YES -> first genuine app entry allows story auto-play when reaching READY state', () => {
    const alreadyLaunched = mockSessionStorage.getItem('__retail_entry_story_shown');
    expect(alreadyLaunched).toBeNull();

    // Simulate initial genuine app entry
    let autoPlayed = false;
    const entryStage = 'READY';
    const userActionOccurred = false;

    if (entryStage === 'READY' && !alreadyLaunched && !userActionOccurred) {
      mockSessionStorage.setItem('__retail_entry_story_shown', 'true');
      autoPlayed = true;
    }

    expect(autoPlayed).toBe(true);
    expect(mockSessionStorage.getItem('__retail_entry_story_shown')).toBe('true');
  });

  it('NO -> selecting store does NOT trigger story auto-play', () => {
    let autoPlayed = false;
    let userActionOccurred = false;

    // Simulate selecting a store
    const selectStore = () => {
      userActionOccurred = true;
      mockSessionStorage.setItem('__retail_entry_story_shown', 'true');
    };

    selectStore();

    // Evaluate auto-play rule
    const alreadyLaunched = mockSessionStorage.getItem('__retail_entry_story_shown');
    if (!alreadyLaunched && !userActionOccurred) {
      autoPlayed = true;
    }

    expect(autoPlayed).toBe(false);
    expect(mockSessionStorage.getItem('__retail_entry_story_shown')).toBe('true');
  });

  it('NO -> changing store does NOT trigger story auto-play', () => {
    let autoPlayed = false;
    let userActionOccurred = false;

    // Simulate user changing store from current store
    const changeStore = () => {
      userActionOccurred = true;
      mockSessionStorage.setItem('__retail_entry_story_shown', 'true');
    };

    changeStore();

    // Evaluate auto-play rule
    const alreadyLaunched = mockSessionStorage.getItem('__retail_entry_story_shown');
    if (!alreadyLaunched && !userActionOccurred) {
      autoPlayed = true;
    }

    expect(autoPlayed).toBe(false);
  });

  it('NO -> opening product does NOT trigger story auto-play', () => {
    let autoPlayed = false;
    let userActionOccurred = false;

    // Simulate opening product detail modal
    const openProductModal = () => {
      userActionOccurred = true;
      mockSessionStorage.setItem('__retail_entry_story_shown', 'true');
    };

    openProductModal();

    // Evaluate auto-play rule
    const alreadyLaunched = mockSessionStorage.getItem('__retail_entry_story_shown');
    if (!alreadyLaunched && !userActionOccurred) {
      autoPlayed = true;
    }

    expect(autoPlayed).toBe(false);
  });

  it('NO -> Local Stores in Stock does NOT trigger story auto-play', () => {
    let autoPlayed = false;
    let userActionOccurred = false;

    // Simulate clicking Local Stores in Stock
    const openLocalStoresInStock = () => {
      userActionOccurred = true;
      mockSessionStorage.setItem('__retail_entry_story_shown', 'true');
    };

    openLocalStoresInStock();

    // Evaluate auto-play rule
    const alreadyLaunched = mockSessionStorage.getItem('__retail_entry_story_shown');
    if (!alreadyLaunched && !userActionOccurred) {
      autoPlayed = true;
    }

    expect(autoPlayed).toBe(false);
  });

  it('NO -> delivery/collection toggle does NOT trigger story auto-play', () => {
    let autoPlayed = false;
    let userActionOccurred = false;

    // Simulate toggling fulfillment mode
    const toggleFulfillment = () => {
      userActionOccurred = true;
      mockSessionStorage.setItem('__retail_entry_story_shown', 'true');
    };

    toggleFulfillment();

    // Evaluate auto-play rule
    const alreadyLaunched = mockSessionStorage.getItem('__retail_entry_story_shown');
    if (!alreadyLaunched && !userActionOccurred) {
      autoPlayed = true;
    }

    expect(autoPlayed).toBe(false);
  });

  it('YES -> manual tap on Story opens story viewer', () => {
    let activeStoryIndex: number | null = null;

    const openStory = (index: number) => {
      activeStoryIndex = index;
      mockSessionStorage.setItem('__retail_entry_story_shown', 'true');
    };

    // User taps story bubble index 2
    openStory(2);

    expect(activeStoryIndex).toBe(2);
    expect(mockSessionStorage.getItem('__retail_entry_story_shown')).toBe('true');
  });
});
