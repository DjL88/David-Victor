// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Story } from '../commerce/models';

vi.mock('../tenant/TenantContext', () => ({
  useTenant: () => ({
    tenant: {
      tenantId: 'tenant-a',
      brandName: 'Test retailer',
      logoUrl: 'https://images.example.test/logo.png',
    },
  }),
}));

import { StoryViewerModal } from '../features/stories/StoryViewerModal';

const story = {
  id: 'story-a',
  title: 'A deliberately long translated story title that must remain readable on narrow screens',
  author: 'Test retailer',
  tag: 'Featured',
  linkedProductPlus: [],
  stockMatchMode: 'OR',
  items: [{
    id: 'frame-a',
    mediaUrl: 'https://images.example.test/story.png',
    mediaType: 'image',
    caption: 'Story caption',
    duration: 1,
  }],
  createdAt: '2026-09-26T12:00:00Z',
} as Story;

const directVideoStory = {
  ...story,
  id: 'story-video',
  items: [{
    id: 'frame-video',
    mediaUrl: 'https://images.example.test/story.mp4',
    mediaType: 'video',
    caption: 'Video story',
    duration: 5,
  }],
} as Story;

let host: HTMLDivElement;
let root: Root;
let opener: HTMLButtonElement;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
    matches: true,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));

  opener = document.createElement('button');
  opener.textContent = 'Open stories';
  document.body.appendChild(opener);
  opener.focus();

  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  opener.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function renderViewer(overrides: Partial<React.ComponentProps<typeof StoryViewerModal>> = {}) {
  const props: React.ComponentProps<typeof StoryViewerModal> = {
    stories: [story],
    currentIndex: 0,
    onClose: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onStoryAction: vi.fn(),
    ...overrides,
  };
  await act(async () => {
    root.render(<StoryViewerModal {...props} />);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
  return props;
}

describe('Story viewer accessibility', () => {
  it('exposes modal semantics, moves focus inside and contains keyboard tab focus', async () => {
    await renderViewer();
    const dialog = host.querySelector('[role="dialog"]');
    const close = host.querySelector<HTMLButtonElement>('#close-story-btn');

    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('story-viewer-title');
    expect(host.querySelector('#story-viewer-title')?.textContent).toContain('deliberately long translated');
    expect(document.activeElement).toBe(close);

    close?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(close);
  });

  it('supports Escape and restores focus to the opener when the dialog closes', async () => {
    const onClose = vi.fn();
    await renderViewer({ onClose });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    expect(document.activeElement).toBe(opener);

    root = createRoot(host);
  });

  it('does not auto-advance timed story motion when reduced motion is requested', async () => {
    vi.useFakeTimers();
    const onNext = vi.fn();
    const props: React.ComponentProps<typeof StoryViewerModal> = {
      stories: [story],
      currentIndex: 0,
      onClose: vi.fn(),
      onNext,
      onPrev: vi.fn(),
      onStoryAction: vi.fn(),
    };

    await act(async () => {
      root.render(<StoryViewerModal {...props} />);
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => vi.advanceTimersByTimeAsync(5000));

    expect(onNext).not.toHaveBeenCalled();
  });

  it('does not request native video autoplay on first render when reduced motion is already enabled', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);

    await renderViewer({ stories: [directVideoStory] });

    const video = host.querySelector<HTMLVideoElement>('video');
    expect(video).toBeTruthy();
    expect(video?.autoplay).toBe(false);
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });
});
