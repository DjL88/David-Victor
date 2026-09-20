/**
 * storyMediaUtils.ts
 * Robust media parsing and video embed resolution for Story campaigns.
 * Supports direct video files (MP4, WebM, MOV), YouTube (standard, shorts, youtu.be),
 * Vimeo, Loom, and responsive fallback previews.
 */

export type StoryVideoProvider = 'direct' | 'youtube' | 'vimeo' | 'loom' | 'none';

export interface ParsedStoryMedia {
  rawUrl: string;
  mediaType: 'video' | 'image';
  provider: StoryVideoProvider;
  directVideoUrl?: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  videoId?: string;
  providerLabel: string;
}

/**
 * Identifies whether a given URL is a generic or placeholder image.
 */
export function isGenericPlaceholder(url?: string): boolean {
  if (!url) return true;
  const lower = url.trim().toLowerCase();
  return (
    lower.includes('1542838132') ||
    lower.includes('placeholder') ||
    lower.includes('dummyimage') ||
    lower.includes('via.placeholder')
  );
}

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  
  // Match standard, youtu.be, shorts, embeds, and mobile URLs
  const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?\s]{11}).*/i;
  const match = trimmed.match(regExp);
  if (match && match[1] && match[1].length === 11) {
    return match[1];
  }

  // Generic fallback pattern for 11-char video ID
  const fallback = trimmed.match(/(?:youtu\.be\/|v\/|embed\/|shorts\/|[?&]v=|\/v\/)([\w-]{11})/i);
  return fallback ? fallback[1] : null;
}

/**
 * Extracts Vimeo video ID from Vimeo URLs.
 */
export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(
    /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|))(\d+)/i
  );
  return match ? match[1] : null;
}

/**
 * Extracts Loom video ID from Loom URLs.
 */
export function extractLoomId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const match = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

/**
 * Determines if a raw URL points to a direct video file or video stream.
 */
export function isDirectVideoUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  
  if (trimmed.startsWith('data:video/') || trimmed.startsWith('blob:')) {
    return true;
  }

  // Check file extensions (with or without query string / hash)
  if (/\.(mp4|mov|m4v|webm|ogv|ogg|mkv)(?:[?#]|$)/i.test(trimmed)) {
    return true;
  }

  // Check Cloud Storage / Firebase / CDN video paths or MIME markers
  if (
    /(?:story-video|video%2f|contenttype=video|\/videos?\/)/i.test(trimmed)
  ) {
    return true;
  }

  return false;
}

/** Resolve Firebase Storage media through the BFF so embedded video range requests
 * are same-origin in AI Studio, Cloud Run and published storefronts. */
export function resolveStoryMediaUrl(rawUrl?: string): string {
  const url = (rawUrl || '').trim();
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && parsed.hostname === 'firebasestorage.googleapis.com') {
      return `/media/firebase?url=${encodeURIComponent(url)}`;
    }
  } catch { /* relative or malformed URLs remain unchanged for existing validation */ }
  return url;
}

/**
 * Comprehensively parses a media URL and resolves video embedding, thumbnail extraction,
 * and media classification.
 */
export function parseStoryMedia(rawUrl?: string, explicitMediaType?: string): ParsedStoryMedia {
  const sourceUrl = (rawUrl || '').trim();
  const url = resolveStoryMediaUrl(sourceUrl);

  if (!sourceUrl) {
    return {
      rawUrl: '',
      mediaType: 'image',
      provider: 'none',
      providerLabel: 'Empty Media',
    };
  }

  // 1. YouTube Detection
  const ytId = extractYouTubeId(url);
  if (ytId) {
    return {
      rawUrl: url,
      mediaType: 'video',
      provider: 'youtube',
      videoId: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${ytId}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&iv_load_policy=3`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      providerLabel: 'YouTube Video',
    };
  }

  // 2. Vimeo Detection
  const vimeoId = extractVimeoId(url);
  if (vimeoId) {
    return {
      rawUrl: url,
      mediaType: 'video',
      provider: 'vimeo',
      videoId: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&loop=1&autopause=0&background=1&title=0&byline=0&portrait=0`,
      thumbnailUrl: `https://vumbnail.com/${vimeoId}.jpg`,
      providerLabel: 'Vimeo Video',
    };
  }

  // 3. Loom Detection
  const loomId = extractLoomId(url);
  if (loomId) {
    return {
      rawUrl: url,
      mediaType: 'video',
      provider: 'loom',
      videoId: loomId,
      embedUrl: `https://www.loom.com/embed/${loomId}?autoplay=1&muted=1&hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`,
      providerLabel: 'Loom Video',
    };
  }

  // 4. Direct Video file check or explicit video tag
  if (isDirectVideoUrl(sourceUrl) || explicitMediaType === 'video') {
    return {
      rawUrl: url,
      mediaType: 'video',
      provider: 'direct',
      directVideoUrl: url,
      providerLabel: 'Direct Video (MP4/WebM)',
    };
  }

  // 5. Default Image
  return {
    rawUrl: url,
    mediaType: 'image',
    provider: 'none',
    thumbnailUrl: url,
    providerLabel: 'Image',
  };
}
