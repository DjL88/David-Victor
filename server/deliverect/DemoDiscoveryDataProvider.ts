import { Store, Category, Product } from '../../src/commerce/models';
import { MOCK_STORES, MOCK_CATEGORIES } from '../../src/commerce/mockData';
import { catalogStore } from '../../src/commerce/catalogStore';
import type { CommerceDiscoveryDataProvider } from './CommerceDiscoveryService';

/**
 * Explicit demo data provider for CommerceDiscoveryService.
 * Isolated to demo runtime mode only. Never imported by production adapters.
 */
export class DemoDiscoveryDataProvider implements CommerceDiscoveryDataProvider {
  getStores(_tenantId: string): Store[] {
    return MOCK_STORES;
  }

  getCategories(_tenantId: string): Category[] {
    return MOCK_CATEGORIES;
  }

  getProducts(_tenantId: string, _storeId?: string): Product[] {
    return catalogStore.getProducts();
  }
}
