/**
 * CMS Structured Page Builder Domain Models
 * Secure, component-based CMS blocks referencing dynamic Deliverect entities
 * without copying price or stock, and preventing arbitrary script injection.
 */

export type CmsBlockType =
  | 'Hero'
  | 'RichText'
  | 'Image'
  | 'Video'
  | 'CTA'
  | 'Stories'
  | 'ProductCarousel'
  | 'CategoryCarousel'
  | 'OfferCarousel'
  | 'StoreFinder'
  | 'FAQ'
  | 'Divider'
  | 'Spacer';

export interface BaseCmsBlock {
  id: string;
  type: CmsBlockType;
  order: number;
}

export interface HeroBlock extends BaseCmsBlock {
  type: 'Hero';
  headline: string;
  subheadline?: string;
  badge?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaAction?: {
    type: 'CATEGORY' | 'PRODUCT' | 'SEARCH' | 'URL';
    target: string;
  };
}

export interface RichTextBlock extends BaseCmsBlock {
  type: 'RichText';
  content: string; // Plain text or safe sanitized markdown paragraphs
}

export interface ImageBlock extends BaseCmsBlock {
  type: 'Image';
  imageUrl: string;
  altText: string;
  caption?: string;
  aspectRatio?: '16:9' | '4:3' | '1:1';
}

export interface VideoBlock extends BaseCmsBlock {
  type: 'Video';
  videoUrl: string;
  posterUrl?: string;
  caption?: string;
  autoplay?: boolean;
}

export interface CtaBlock extends BaseCmsBlock {
  type: 'CTA';
  title: string;
  description?: string;
  buttonLabel: string;
  actionUrl: string;
  variant: 'primary' | 'secondary' | 'outline';
}

export interface StoriesBlock extends BaseCmsBlock {
  type: 'Stories';
  title?: string;
  storeScoped?: boolean;
}

export interface ProductCarouselBlock extends BaseCmsBlock {
  type: 'ProductCarousel';
  title: string;
  subtitle?: string;
  productPlus: string[]; // Authoritatively referenced by PLU
}

export interface CategoryCarouselBlock extends BaseCmsBlock {
  type: 'CategoryCarousel';
  title: string;
  categoryIds: string[]; // Authoritatively referenced by ID
}

export interface OfferCarouselBlock extends BaseCmsBlock {
  type: 'OfferCarousel';
  title: string;
  subtitle?: string;
  badge?: string;
  bannerIds?: string[];
  productPlus?: string[];
}

export interface StoreFinderBlock extends BaseCmsBlock {
  type: 'StoreFinder';
  title: string;
  description?: string;
}

export interface FaqBlock extends BaseCmsBlock {
  type: 'FAQ';
  title: string;
  items: Array<{ question: string; answer: string }>;
}

export interface DividerBlock extends BaseCmsBlock {
  type: 'Divider';
  style: 'subtle' | 'bold' | 'dashed';
}

export interface SpacerBlock extends BaseCmsBlock {
  type: 'Spacer';
  heightPx: number; // e.g. 24, 48, 64
}

export type CmsBlock =
  | HeroBlock
  | RichTextBlock
  | ImageBlock
  | VideoBlock
  | CtaBlock
  | StoriesBlock
  | ProductCarouselBlock
  | CategoryCarouselBlock
  | OfferCarouselBlock
  | StoreFinderBlock
  | FaqBlock
  | DividerBlock
  | SpacerBlock;

export type NavigationVisibility = 'header' | 'footer' | 'both' | 'hidden';

export interface CmsPageVariant {
  familyId: string;
  sourceLocale?: string;
  translationState?: 'source' | 'draft' | 'reviewed';
  showFallbackNotice?: boolean;
  markets?: string[];
  regions?: string[];
  locationIds?: string[];
  timeZone?: string;
  unpublishAt?: string;
  social?: { title?: string; description?: string; imageUrl?: string };
}

export interface CmsPage {
  id: string;
  tenantId: string;
  slug: string; // e.g. "about-us", "our-farms", "sustainability"
  title: string;
  seoTitle: string;
  seoDescription: string;
  locale: string; // e.g. "en-GB"
  /** Locale/market variant metadata authored by the retailer. Empty targeting means globally eligible. */
  variant?: CmsPageVariant;
  status: 'draft' | 'published' | 'archived';
  publishDate?: string;
  navigationVisibility: NavigationVisibility;
  /** Show this page in the storefront Account > Information & Policies area. */
  showInAccount?: boolean;
  navigationLabel?: string;
  navigationOrder?: number;
  blocks: CmsBlock[];
  createdAt: string;
  updatedAt: string;
}
