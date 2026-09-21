import { MediaHealth, MediaHealthSummary, MediaAssetType } from '../src/commerce/mediaHealthModels';
import { FirestorePlatformService } from './firestoreService';
import { CmsService } from './cmsService';
import { AssetService } from './assetService';
import { getDeliverectAdapterAsync } from './deliverect';
import { catalogStore } from '../src/commerce/catalogStore';
import { Product, Category } from '../src/commerce/models';

export class MediaHealthService {
  private static healthCache: Record<string, { assets: MediaHealth[]; lastScanAt: string }> = {};

  /**
   * Scans and probes health of all registered media assets for a tenant via server-side HTTP checks.
   */
  static async scanTenantMediaHealth(
    tenantId: string = 'brand-alpha',
    forceProbe: boolean = false
  ): Promise<{ assets: MediaHealth[]; summary: MediaHealthSummary }> {
    const cached = this.healthCache[tenantId];
    if (!forceProbe && cached && Date.now() - new Date(cached.lastScanAt).getTime() < 120_000) {
      return {
        assets: cached.assets,
        summary: this.getSummary(cached.assets, cached.lastScanAt),
      };
    }

    const rawAssets: Array<{
      url: string;
      assetType: MediaAssetType;
      referenceName: string;
      referenceId: string;
    }> = [];

    // 1. Tenant Brand Assets (Logo, Favicon)
    try {
      const config = await FirestorePlatformService.getTenantConfig(tenantId);
      if (config?.logoUrl) {
        rawAssets.push({
          url: config.logoUrl,
          assetType: 'brand',
          referenceName: `${config.brandName || tenantId} Brand Logo`,
          referenceId: 'logoUrl',
        });
      }
      if (config?.faviconUrl) {
        rawAssets.push({
          url: config.faviconUrl,
          assetType: 'brand',
          referenceName: `${config.brandName || tenantId} Favicon`,
          referenceId: 'faviconUrl',
        });
      }
    } catch (e) {
      console.warn(`[MediaHealthService] Could not load tenant config for ${tenantId}:`, e);
    }

    // 2. Stories Media
    try {
      const stories = await FirestorePlatformService.getTenantStories(tenantId);
      for (const story of stories) {
        if (story.mediaUrl) {
          rawAssets.push({
            url: story.mediaUrl,
            assetType: 'story',
            referenceName: `${story.title || 'Story'} Media`,
            referenceId: story.id,
          });
        }
        if (story.items) {
          for (const [idx, item] of story.items.entries()) {
            if (item.mediaUrl) {
              rawAssets.push({
                url: item.mediaUrl,
                assetType: 'story',
                referenceName: `${story.title || 'Story'} (Item ${idx + 1})`,
                referenceId: `${story.id}_${item.id || idx}`,
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[MediaHealthService] Could not load stories for ${tenantId}:`, e);
    }

    // 3. Hero Banners
    try {
      const banners = await FirestorePlatformService.getTenantHeroBanners(tenantId);
      for (const banner of banners) {
        if (banner.backgroundImageUrl) {
          rawAssets.push({
            url: banner.backgroundImageUrl,
            assetType: 'hero',
            referenceName: banner.title || 'Hero Banner',
            referenceId: banner.id,
          });
        }
      }
    } catch (e) {
      console.warn(`[MediaHealthService] Could not load hero banners for ${tenantId}:`, e);
    }

    // 4. CMS Pages
    try {
      const pages = CmsService.list(tenantId);
      for (const page of pages) {
        for (const block of page.blocks || []) {
          if ((block as any).imageUrl) {
            rawAssets.push({
              url: (block as any).imageUrl,
              assetType: 'cms',
              referenceName: `${page.title}: ${block.type} Block`,
              referenceId: `${page.id}_${block.id}`,
            });
          }
        }
      }
    } catch (e) {
      console.warn(`[MediaHealthService] Could not load CMS pages for ${tenantId}:`, e);
    }

    // 5. Catalog Products & Categories
    try {
      const adapter = await getDeliverectAdapterAsync(tenantId);
      const rootCatalog = await adapter.getRootCatalog().catch(() => null);

      const productsMap = new Map<string, Product>();

      if (rootCatalog?.products) {
        for (const p of rootCatalog.products) {
          if (p && (p.plu || p.id)) {
            productsMap.set(p.plu || p.id, p);
          }
        }
      }

      const searchRes = await adapter.searchProducts('', undefined, { limit: 200 }).catch(() => null);
      if (searchRes?.products) {
        for (const p of searchRes.products) {
          if (p && (p.plu || p.id)) {
            productsMap.set(p.plu || p.id, p);
          }
        }
      }

      try {
        const demoProducts = catalogStore.getProducts();
        for (const p of demoProducts) {
          if (p && (p.plu || p.id) && !productsMap.has(p.plu || p.id)) {
            productsMap.set(p.plu || p.id, p);
          }
        }
      } catch (e) {
        // Ignore demo store fallback error
      }

      for (const product of productsMap.values()) {
        const urlsToTest: string[] = [];
        if (product.imageUrl) urlsToTest.push(product.imageUrl);
        if (product.image && !urlsToTest.includes(product.image)) urlsToTest.push(product.image);
        if (Array.isArray(product.images)) {
          for (const imgUrl of product.images) {
            if (imgUrl && typeof imgUrl === 'string' && !urlsToTest.includes(imgUrl)) {
              urlsToTest.push(imgUrl);
            }
          }
        }

        for (const [imgIdx, imgUrl] of urlsToTest.entries()) {
          rawAssets.push({
            url: imgUrl,
            assetType: 'product',
            referenceName: `${product.name}${urlsToTest.length > 1 ? ` (Img ${imgIdx + 1})` : ''}`,
            referenceId: product.plu || product.id,
          });
        }
      }

      // Categories
      const categoriesMap = new Map<string, Category>();
      if (rootCatalog?.categories) {
        for (const c of rootCatalog.categories) {
          if (c && c.id) {
            categoriesMap.set(c.id, c);
          }
        }
      }

      try {
        const demoCategories = catalogStore.getCategories();
        for (const c of demoCategories) {
          if (c && c.id && !categoriesMap.has(c.id)) {
            categoriesMap.set(c.id, c);
          }
        }
      } catch (e) {
        // Ignore
      }

      for (const category of categoriesMap.values()) {
        if (category.imageUrl) {
          rawAssets.push({
            url: category.imageUrl,
            assetType: 'category',
            referenceName: `Category: ${category.name}`,
            referenceId: category.id,
          });
        }
      }
    } catch (e) {
      console.warn(`[MediaHealthService] Could not load catalog products for ${tenantId}:`, e);
    }

    // 6. Uploaded Storage Assets
    try {
      const assets = await AssetService.listAssets(tenantId);
      for (const asset of assets) {
        if (asset.publicUrl) {
          let type: MediaAssetType = 'brand';
          if (asset.type.includes('STORY')) type = 'story';
          else if (asset.type.includes('HERO')) type = 'hero';
          else if (asset.type.includes('CMS')) type = 'cms';
          else if (asset.type.includes('PRODUCT')) type = 'product';

          if (!rawAssets.some((a) => a.url === asset.publicUrl)) {
            rawAssets.push({
              url: asset.publicUrl,
              assetType: type,
              referenceName: `Uploaded Asset: ${asset.fileName}`,
              referenceId: asset.id,
            });
          }
        }
      }
    } catch (e) {
      console.warn(`[MediaHealthService] Could not load uploaded assets for ${tenantId}:`, e);
    }

    // Deduplicate items by URL
    const uniqueMap = new Map<string, typeof rawAssets[0]>();
    for (const item of rawAssets) {
      if (!uniqueMap.has(item.url)) {
        uniqueMap.set(item.url, item);
      }
    }
    const assetList = Array.from(uniqueMap.values());

    // Probe health concurrently in chunks of 10
    const probedResults: MediaHealth[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < assetList.length; i += 10) {
      const chunk = assetList.slice(i, i + 10);
      const probedChunk = await Promise.all(
        chunk.map((item, idx) => this.probeAsset(item, `mh_${i + idx}_${Date.now()}`, now))
      );
      probedResults.push(...probedChunk);
    }

    this.healthCache[tenantId] = { assets: probedResults, lastScanAt: now };

    return {
      assets: probedResults,
      summary: this.getSummary(probedResults, now),
    };
  }

  private static async probeAsset(
    item: { url: string; assetType: MediaAssetType; referenceName: string; referenceId: string },
    id: string,
    now: string
  ): Promise<MediaHealth> {
    const { url, assetType, referenceName, referenceId } = item;

    if (url.startsWith('data:')) {
      return {
        id,
        url,
        assetType,
        referenceName,
        referenceId,
        status: 'healthy',
        httpStatus: 200,
        contentType: url.split(';')[0].replace('data:', '') || 'image/png',
        lastCheckedAt: now,
      };
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return {
        id,
        url,
        assetType,
        referenceName,
        referenceId,
        status: 'failing',
        httpStatus: 400,
        failureReason: 'Invalid URL protocol',
        lastCheckedAt: now,
      };
    }

    try {
      let res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(4000),
      });

      if (res.status === 405 || res.status === 403) {
        res = await fetch(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-1024' },
          signal: AbortSignal.timeout(4000),
        });
      }

      const status = res.status;
      const contentType = res.headers.get('content-type') || undefined;

      if ((status >= 200 && status < 300) || status === 304) {
        return {
          id,
          url,
          assetType,
          referenceName,
          referenceId,
          status: 'healthy',
          httpStatus: status === 304 ? 200 : status,
          contentType,
          lastCheckedAt: now,
        };
      } else {
        return {
          id,
          url,
          assetType,
          referenceName,
          referenceId,
          status: 'failing',
          httpStatus: status,
          contentType,
          failureReason: `HTTP ${status} (${res.statusText || 'Error response from CDN'})`,
          lastCheckedAt: now,
        };
      }
    } catch (err: any) {
      return {
        id,
        url,
        assetType,
        referenceName,
        referenceId,
        status: 'unreachable',
        httpStatus: 504,
        failureReason: `Gateway Timeout (${err.message || 'Connection failed'})`,
        lastCheckedAt: now,
      };
    }
  }

  private static getSummary(assets: MediaHealth[], scanTime: string): MediaHealthSummary {
    const healthyCount = assets.filter((a) => a.status === 'healthy').length;
    const warningCount = assets.filter((a) => a.status === 'warning').length;
    const failingCount = assets.filter((a) => a.status === 'failing' || a.status === 'unreachable').length;

    return {
      totalAssets: assets.length,
      healthyCount,
      warningCount,
      failingCount,
      lastScanAt: scanTime,
    };
  }
}
