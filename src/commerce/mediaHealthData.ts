import { MediaHealth, MediaHealthSummary } from './mediaHealthModels';

export const MOCK_MEDIA_HEALTH_ASSETS: Record<string, MediaHealth[]> = {
  'brand-alpha': [
    {
      id: 'mh-1',
      url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
      assetType: 'brand',
      referenceName: 'Brand Alpha Logo',
      referenceId: 'brand-alpha',
      status: 'healthy',
      httpStatus: 200,
      contentType: 'image/jpeg',
      lastCheckedAt: '2026-03-16T21:00:00Z',
    },
    {
      id: 'mh-2',
      url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600',
      assetType: 'product',
      referenceName: 'Slow Fermented Sourdough Boule 600g',
      referenceId: 'PLU-SOURDOUGH-01',
      status: 'healthy',
      httpStatus: 200,
      contentType: 'image/jpeg',
      lastCheckedAt: '2026-03-16T21:05:00Z',
    },
    {
      id: 'mh-3',
      url: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600',
      assetType: 'product',
      referenceName: 'Free Range Organic Rich Yolk Large Eggs',
      referenceId: 'PLU-ORGANIC-EGGS-6PK',
      status: 'healthy',
      httpStatus: 200,
      contentType: 'image/jpeg',
      lastCheckedAt: '2026-03-16T21:05:00Z',
    },
    {
      id: 'mh-4',
      url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=600',
      assetType: 'product',
      referenceName: 'Estate Whole Organic Fresh Milk 2 Litres',
      referenceId: 'PLU-ORGANIC-MILK-2L',
      status: 'healthy',
      httpStatus: 200,
      contentType: 'image/jpeg',
      lastCheckedAt: '2026-03-16T21:05:00Z',
    },
    {
      id: 'mh-5',
      url: 'https://cdn.artisan-suppliers.invalid/assets/heritage-rye-broken.jpg',
      assetType: 'product',
      referenceName: 'Heritage Rye Flour 1.5kg',
      referenceId: 'PLU-RYE-09',
      status: 'failing',
      httpStatus: 404,
      contentType: 'text/html',
      failureReason: 'HTTP 404 Not Found (Upstream supplier CDN expired)',
      lastCheckedAt: '2026-03-16T21:10:00Z',
    },
    {
      id: 'mh-6',
      url: 'https://media.farmgate.example/stream/slow-churn-butter.mp4',
      assetType: 'story',
      referenceName: 'Morning Farm Butter Churn Story',
      referenceId: 'story-dairy-churn',
      status: 'unreachable',
      httpStatus: 504,
      failureReason: 'Gateway Timeout (Exceeded 5000ms socket timeout)',
      lastCheckedAt: '2026-03-16T21:12:00Z',
    },
    {
      id: 'mh-7',
      url: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200',
      assetType: 'cms',
      referenceName: 'Hero Banner: About Our Growers',
      referenceId: 'page-about',
      status: 'healthy',
      httpStatus: 200,
      contentType: 'image/jpeg',
      lastCheckedAt: '2026-03-16T21:15:00Z',
    },
  ],
};

export function getMediaHealthSummary(assets: MediaHealth[]): MediaHealthSummary {
  const healthyCount = assets.filter((a) => a.status === 'healthy').length;
  const warningCount = assets.filter((a) => a.status === 'warning').length;
  const failingCount = assets.filter((a) => a.status === 'failing' || a.status === 'unreachable').length;

  return {
    totalAssets: assets.length,
    healthyCount,
    warningCount,
    failingCount,
    lastScanAt: new Date().toISOString(),
  };
}
