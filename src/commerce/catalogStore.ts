/**
 * Catalogue Projection & Cache
 *
 * ARCHITECTURAL ROLE:
 * This client-side store is NOT the authoritative product catalogue.
 * In Deliverect architecture, Deliverect / upstream POS systems own root products,
 * synchronizations, price master, and location-specific availability.
 *
 * The client holds this online-authoritative projection and cache for low-latency
 * browsing, optimistic offline-resilient UI state, and merchandising previews.
 */

import { Product, Category, StoreProductAvailability, moneyToMajor } from './models';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from './mockData';
import { MARKET_LANE_STORE_AVAILABILITY } from './marketLaneData';

const STORAGE_KEY_PRODUCTS = 'deliverect_commerce_real_products';
const STORAGE_KEY_CATEGORIES = 'deliverect_commerce_real_categories';
const STORAGE_KEY_INTEGRATIONS = 'deliverect_commerce_integrations';
const STORAGE_KEY_STORE_AVAILABILITY = 'deliverect_store_availability';

export function normalizeStoreId(storeId: string): string {
  if (!storeId) return storeId;
  if (storeId === 'store-moulsham-st') return 'store-market-lane-moulsham';
  if (storeId === 'store-billericay-west') return 'store-market-lane-billericay';
  return storeId;
}

export interface DeliverectIntegrationConfig {
  enabled: boolean;
  // All Deliverect Commerce calls route strictly through the BFF orchestration service (/api/commerce/*).
  // Direct browser-to-Deliverect calls are prohibited.
  bffProxyUrl: string;
  // Multi-tenant runtime mappings
  allowedDeliverectAccountId: string;
  storeChannelLinkMappings: Record<string, string>; // storeId -> channelLinkId
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  status: 'connected' | 'disconnected' | 'error';
}

export const DEFAULT_INTEGRATION_CONFIG: DeliverectIntegrationConfig = {
  enabled: false,
  bffProxyUrl: '/api/commerce',
  allowedDeliverectAccountId: '',
  storeChannelLinkMappings: {},
  syncIntervalMinutes: 15,
  lastSyncAt: null,
  status: 'disconnected',
};

export class CatalogueProjectionCache {
  private products: Product[] = [];
  private categories: Category[] = [];
  private integrations: DeliverectIntegrationConfig = DEFAULT_INTEGRATION_CONFIG;
  private storeAvailability: Record<string, Record<string, StoreProductAvailability>> = {};
  private listeners: Array<() => void> = [];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        this.products = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
        this.categories = JSON.parse(JSON.stringify(MOCK_CATEGORIES));
        this.storeAvailability = JSON.parse(JSON.stringify(MARKET_LANE_STORE_AVAILABILITY));
        return;
      }

      const storedProducts = window.localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (storedProducts) {
        const parsed: Product[] = JSON.parse(storedProducts);
        const existingPluSet = new Set(parsed.map((p) => p.plu));
        const missingCore = MOCK_PRODUCTS.filter((p) => !existingPluSet.has(p.plu));
        this.products = missingCore.length > 0 && parsed.length > 0 ? [...parsed, ...missingCore] : parsed;
      } else {
        this.products = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
      }

      const storedCategories = window.localStorage.getItem(STORAGE_KEY_CATEGORIES);
      if (storedCategories) {
        const parsedCats: Category[] = JSON.parse(storedCategories);
        const hasLevel3 = parsedCats.some((c) =>
          c.subcategories?.some((sub) => sub.subcategories && sub.subcategories.length > 0)
        );
        this.categories = hasLevel3 ? parsedCats : JSON.parse(JSON.stringify(MOCK_CATEGORIES));
      } else {
        this.categories = JSON.parse(JSON.stringify(MOCK_CATEGORIES));
      }

      const storedIntegrations = window.localStorage.getItem(STORAGE_KEY_INTEGRATIONS);
      if (storedIntegrations) {
        this.integrations = { ...DEFAULT_INTEGRATION_CONFIG, ...JSON.parse(storedIntegrations) };
      }

      const storedAvail = window.localStorage.getItem(STORAGE_KEY_STORE_AVAILABILITY);
      if (storedAvail) {
        this.storeAvailability = JSON.parse(storedAvail);
      } else {
        this.storeAvailability = JSON.parse(JSON.stringify(MARKET_LANE_STORE_AVAILABILITY));
      }
    } catch (e) {
      console.warn('Failed to parse stored catalog data, falling back to defaults', e);
      this.products = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
      this.categories = JSON.parse(JSON.stringify(MOCK_CATEGORIES));
      this.storeAvailability = JSON.parse(JSON.stringify(MARKET_LANE_STORE_AVAILABILITY));
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(this.products));
        window.localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(this.categories));
        window.localStorage.setItem(STORAGE_KEY_INTEGRATIONS, JSON.stringify(this.integrations));
        window.localStorage.setItem(STORAGE_KEY_STORE_AVAILABILITY, JSON.stringify(this.storeAvailability));
      }
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save catalog to local storage', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l());
  }

  public getProducts(): Product[] {
    return [...this.products];
  }

  public getProductByPlu(plu: string): Product | undefined {
    return this.products.find((p) => p.plu === plu);
  }

  public getCategories(): Category[] {
    return [...this.categories];
  }

  public getIntegrationConfig(): DeliverectIntegrationConfig {
    return { ...this.integrations };
  }

  public saveIntegrationConfig(config: Partial<DeliverectIntegrationConfig>) {
    this.integrations = { ...this.integrations, ...config };
    this.saveToStorage();
  }

  public addProduct(product: Product) {
    const existingIndex = this.products.findIndex((p) => p.plu === product.plu);
    if (existingIndex >= 0) {
      this.products[existingIndex] = product;
    } else {
      this.products.unshift(product);
    }
    this.saveToStorage();
  }

  public updateProduct(plu: string, updates: Partial<Product>) {
    const idx = this.products.findIndex((p) => p.plu === plu);
    if (idx >= 0) {
      this.products[idx] = { ...this.products[idx], ...updates };
      this.saveToStorage();
    }
  }

  public deleteProduct(plu: string) {
    this.products = this.products.filter((p) => p.plu !== plu);
    this.saveToStorage();
  }

  public bulkReplaceProducts(newProducts: Product[]) {
    this.products = newProducts;
    this.saveToStorage();
  }

  public purgeDemoData() {
    this.products = [];
    this.saveToStorage();
  }

  public resetToDefaultDemo() {
    this.products = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
    this.categories = JSON.parse(JSON.stringify(MOCK_CATEGORIES));
    this.storeAvailability = JSON.parse(JSON.stringify(MARKET_LANE_STORE_AVAILABILITY));
    this.saveToStorage();
  }

  public getStoreAvailability(storeId: string): Record<string, StoreProductAvailability> {
    const norm = normalizeStoreId(storeId);
    if (!this.storeAvailability[norm]) {
      this.storeAvailability[norm] = {};
    }
    return { ...this.storeAvailability[norm] };
  }

  public getProductAvailability(storeId: string, plu: string): StoreProductAvailability | undefined {
    const norm = normalizeStoreId(storeId);
    const storeMap = this.storeAvailability[norm];
    if (storeMap && storeMap[plu]) {
      const record = { ...storeMap[plu] };
      const masterProduct = this.getProductByPlu(plu);
      if (masterProduct && typeof record.storePrice === 'number' && record.storePrice > 0 && record.storePrice < 0.20) {
        const expectedPrice = typeof masterProduct.price === 'number'
          ? masterProduct.price
          : (masterProduct.price && typeof masterProduct.price === 'object' && 'amount' in masterProduct.price
              ? masterProduct.price.amount / 100
              : (typeof (masterProduct as any).basePrice === 'number' ? (masterProduct as any).basePrice : 0));
        if (expectedPrice >= 0.50 && Math.abs(record.storePrice - expectedPrice / 100) < 0.005) {
          record.storePrice = expectedPrice;
          this.storeAvailability[norm][plu] = record;
        }
      }
      return record;
    }

    // If no availability record exists yet for this store/plu, derive a default from the master product
    const masterProduct = this.getProductByPlu(plu);
    if (masterProduct) {
      let defaultPrice: number = 0;
      if (typeof masterProduct.price === 'number') {
        defaultPrice = masterProduct.price;
      } else if (masterProduct.price && typeof masterProduct.price === 'object' && 'amount' in masterProduct.price) {
        defaultPrice = masterProduct.price.amount / 100;
      } else if (typeof (masterProduct as any).basePrice === 'number') {
        defaultPrice = (masterProduct as any).basePrice;
      }

      let originalPrice: number | undefined = undefined;
      if (typeof masterProduct.originalPrice === 'number') {
        originalPrice = masterProduct.originalPrice;
      } else if (masterProduct.originalPrice && typeof masterProduct.originalPrice === 'object' && 'amount' in masterProduct.originalPrice) {
        originalPrice = masterProduct.originalPrice.amount / 100;
      }

      const isCarried = true;
      const inStock = masterProduct.stockStatus !== 'OUT_OF_STOCK';
      const defaultAvail: StoreProductAvailability = {
        storeId: norm,
        plu,
        inStock,
        stockQuantity: masterProduct.stockQuantity ?? 50,
        stockStatus: masterProduct.stockStatus || (inStock ? 'IN_STOCK' : 'OUT_OF_STOCK'),
        storePrice: defaultPrice,
        originalPrice,
        isCarried,
        active: masterProduct.active !== false,
        lastSyncAt: new Date().toISOString(),
      };

      if (!this.storeAvailability[norm]) {
        this.storeAvailability[norm] = {};
      }
      this.storeAvailability[norm][plu] = defaultAvail;
      return { ...defaultAvail };
    }

    return undefined;
  }

  public setProductAvailability(
    storeId: string,
    plu: string,
    updates: Partial<StoreProductAvailability>
  ): void {
    const norm = normalizeStoreId(storeId);
    if (!this.storeAvailability[norm]) {
      this.storeAvailability[norm] = {};
    }

    const current = this.getProductAvailability(norm, plu) || {
      storeId: norm,
      plu,
      inStock: true,
      isCarried: true,
      active: true,
    };

    this.storeAvailability[norm][plu] = {
      ...current,
      ...updates,
      storeId: norm,
      plu,
      lastSyncAt: new Date().toISOString(),
    };

    this.saveToStorage();
  }

  public getAllStoreAvailability(): Record<string, Record<string, StoreProductAvailability>> {
    return JSON.parse(JSON.stringify(this.storeAvailability));
  }
}

export const catalogueProjectionCache = new CatalogueProjectionCache();

// Backwards compatibility alias
export const catalogStore = catalogueProjectionCache;
export const CatalogStore = CatalogueProjectionCache;
