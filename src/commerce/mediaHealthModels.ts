/**
 * Media Health Domain Model
 * Tracks health and validation states of catalog and CMS media assets.
 */

export type MediaAssetType = 'product' | 'category' | 'story' | 'brand' | 'hero' | 'cms';

export type MediaHealthStatus = 'healthy' | 'warning' | 'failing' | 'unreachable';

export interface MediaHealth {
  id: string;
  url: string;
  assetType: MediaAssetType;
  referenceName: string; // e.g. "Artisan Sourdough Boule"
  referenceId: string; // PLU, storyId, or categoryId
  status: MediaHealthStatus;
  lastCheckedAt: string;
  httpStatus?: number;
  contentType?: string;
  failureReason?: string;
}

export interface MediaHealthSummary {
  totalAssets: number;
  healthyCount: number;
  warningCount: number;
  failingCount: number;
  lastScanAt: string;
}
