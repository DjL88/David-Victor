import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeliverectApiClient, evaluateDeliverectSnooze, applyCategoryFallback, FALLBACK_CATEGORY_ID, FALLBACK_CATEGORY_NAME } from '../../server/deliverect/DeliverectApiClient';
import { LinkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';
import { OAuthTokenManager } from '../../server/deliverect/OAuthTokenManager';
import { formatCurrency, formatMoney } from '../utils/formatters';
import { toMoney, moneyToMajor, Product, Store } from '../commerce/models';
import { evaluateProductAvailability } from '../rules/availabilityRules';

function createTestProduct(overrides: Partial<Product> & { storeId?: string }): Product & { storeId?: string } {
  return {
    id: overrides.id || 'prod_test',
    plu: overrides.plu || 'PLU_TEST',
    gtin: overrides.gtin || [],
    name: overrides.name || 'Test Product',
    categoryIds: overrides.categoryIds || ['cat_default'],
    productTags: overrides.productTags || [],
    displayLabels: overrides.displayLabels || [],
    allergens: overrides.allergens || [],
    ...overrides,
  };
}

describe('Deliverect Pricing, Multi-Store Menus, Snooze & Store Isolation Fixtures', () => {
  // --------------------------------------------------------------------------
  // 1. FIXTURE: Integer 89 GBP -> £0.89
  // --------------------------------------------------------------------------
  describe('Fixture 1: Integer 89 GBP -> £0.89', () => {
    it('normalizes integer 89 in GBP menu to Money { amount: 89, currency: "GBP" } and formats to £0.89', () => {
      const mockRawMenu = {
        _id: 'menu_gbp_01',
        currency: 'GBP',
        categories: [{ _id: 'cat_1', name: 'Snacks', subCategories: [], productIds: ['prod_gbp_89'] }],
        products: [
          {
            _id: 'prod_gbp_89',
            name: 'Crisps',
            price: 89, // integer 89 in Deliverect raw payload
            currency: 'GBP',
            active: true,
          },
        ],
      };

      const normalized = DeliverectApiClient.parseDeliverectMenu(mockRawMenu, true);
      expect(normalized.products).toHaveLength(1);

      const product = normalized.products[0];
      expect(product.price).toEqual({
        amount: 89,
        currency: 'GBP',
      });

      // Verification of money helpers
      expect(moneyToMajor(product.price)).toBe(0.89);

      // Verification of formatCurrency formatter
      const formatted = formatCurrency(product.price, '£');
      expect(formatted).toBe('£0.89');

      // Also verify direct formatMoney helper
      expect(formatMoney(product.price, '£')).toBe('£0.89');
    });
  });

  // --------------------------------------------------------------------------
  // 2. FIXTURE: Integer 89 EUR -> €0.89
  // --------------------------------------------------------------------------
  describe('Fixture 2: Integer 89 EUR -> €0.89', () => {
    it('normalizes integer 89 in EUR menu to Money { amount: 89, currency: "EUR" } and formats to €0.89 in en-GB', () => {
      const mockRawMenu = {
        _id: 'menu_eur_01',
        currency: 'EUR',
        categories: [{ _id: 'cat_1', name: 'Snacks', subCategories: [], productIds: ['prod_eur_89'] }],
        products: [
          {
            _id: 'prod_eur_89',
            name: 'Baguette',
            price: 89, // integer 89 in Deliverect raw payload
            currency: 'EUR',
            active: true,
          },
        ],
      };

      const normalized = DeliverectApiClient.parseDeliverectMenu(mockRawMenu, true);
      expect(normalized.products).toHaveLength(1);

      const product = normalized.products[0];
      expect(product.price).toEqual({
        amount: 89,
        currency: 'EUR',
      });

      // Verification of money helpers
      expect(moneyToMajor(product.price)).toBe(0.89);

      // Verification of formatCurrency with default en-GB locale (should use dot: €0.89)
      const formattedEuroSymbol = formatCurrency(product.price, '€');
      expect(formattedEuroSymbol).toBe('€0.89');

      const formattedEurCode = formatCurrency(product.price, 'EUR');
      expect(formattedEurCode).toBe('€0.89');

      // Verification that German/French European locales format with comma
      const formattedGerman = formatCurrency(product.price, '€', 'de-DE');
      expect(formattedGerman).toBe('€0,89');
    });
  });

  // --------------------------------------------------------------------------
  // 3. FIXTURE: Two Store Menus with Differing Prices
  // --------------------------------------------------------------------------
  describe('Fixture 3: Two store menus with differing prices', () => {
    const productStore1 = createTestProduct({
      id: 'prod_choc_bar',
      name: 'Chocolate Bar',
      categoryIds: ['cat_confectionery'],
      price: toMoney(89, 'GBP'), // Store 1: £0.89
      storeId: 'store_mayfair',
    });

    const productStore2 = createTestProduct({
      id: 'prod_choc_bar',
      name: 'Chocolate Bar',
      categoryIds: ['cat_confectionery'],
      price: toMoney(120, 'GBP'), // Store 2: £1.20
      storeId: 'store_soho',
    });

    it('computes availability summary with min/max price range across multiple stores', () => {
      const prices = [moneyToMajor(productStore1.price), moneyToMajor(productStore2.price)];
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      expect(minPrice).toBe(0.89);
      expect(maxPrice).toBe(1.20);

      const availabilitySummary = {
        isAvailableAcrossAnyStore: true,
        availableStoreCount: 2,
        minimumPrice: minPrice,
        maximumPrice: maxPrice,
      };

      // Pre-store browsing display logic (from ProductCard.tsx)
      const minP = availabilitySummary.minimumPrice;
      const maxP = availabilitySummary.maximumPrice;
      let displayPriceText = '';
      if (minP != null && maxP != null && Math.abs(minP - maxP) > 0.001) {
        displayPriceText = `From ${formatCurrency(minP, '£')}`;
      } else {
        displayPriceText = formatCurrency(minP, '£');
      }

      expect(displayPriceText).toBe('From £0.89');
    });

    it('displays single price when prices across stores are identical', () => {
      const samePrice1 = 0.89;
      const samePrice2 = 0.89;
      const minP = Math.min(samePrice1, samePrice2);
      const maxP = Math.max(samePrice1, samePrice2);

      let displayPriceText = '';
      if (minP != null && maxP != null && Math.abs(minP - maxP) > 0.001) {
        displayPriceText = `From ${formatCurrency(minP, '£')}`;
      } else {
        displayPriceText = formatCurrency(minP, '£');
      }

      expect(displayPriceText).toBe('£0.89');
    });
  });

  // --------------------------------------------------------------------------
  // 4. FIXTURE: Inactive and Snoozed Exclusion
  // --------------------------------------------------------------------------
  describe('Fixture 4: Inactive and snoozed exclusion', () => {
    it('correctly evaluates Deliverect snoozedProducts by ID and PLU', () => {
      const snoozedPayload = {
        prod_snoozed_123: { snoozed: true },
        PLU_SNZ_456: { isSnoozed: true },
      };

      const activeProduct = { id: 'prod_active_1', plu: 'PLU_ACT_1' };
      const snoozedById = { id: 'prod_snoozed_123', plu: 'SOME_PLU' };
      const snoozedByPlu = { id: 'prod_other', plu: 'PLU_SNZ_456' };

      expect(evaluateDeliverectSnooze(activeProduct, snoozedPayload, 'prod_active_1', 'PLU_ACT_1')).toBe(false);
      expect(evaluateDeliverectSnooze(snoozedById, snoozedPayload, 'prod_snoozed_123', 'SOME_PLU')).toBe(true);
      expect(evaluateDeliverectSnooze(snoozedByPlu, snoozedPayload, 'prod_other', 'PLU_SNZ_456')).toBe(true);
    });

    it('excludes snoozed and inactive items from cart eligibility in availability engine', () => {
      const activeProd = createTestProduct({
        id: 'prod_active',
        name: 'Fresh Milk',
        price: toMoney(150, 'GBP'),
        isSnoozed: false,
        active: true,
      });

      const snoozedProd = createTestProduct({
        id: 'prod_snoozed',
        name: 'Out of Stock Coffee',
        price: toMoney(350, 'GBP'),
        isSnoozed: true,
        active: true,
      });

      const inactiveProd = createTestProduct({
        id: 'prod_inactive',
        name: 'Delisted Tea',
        price: toMoney(200, 'GBP'),
        active: false,
      });

      const activeDecision = evaluateProductAvailability(activeProd, 0, {}, []);
      expect(activeDecision.canAddToCart).toBe(true);
      expect(activeDecision.isGreyedOut).toBe(false);

      const snoozedDecision = evaluateProductAvailability(snoozedProd, 0, {}, []);
      expect(snoozedDecision.canAddToCart).toBe(false);
      expect(snoozedDecision.isGreyedOut).toBe(true);
      expect(snoozedDecision.limitReason).toBe('Out of stock');

      const inactiveDecision = evaluateProductAvailability(inactiveProd, 0, {}, []);
      expect(inactiveDecision.shouldRender).toBe(false);
      expect(inactiveDecision.canAddToCart).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. FIXTURE: Selected-Store Isolation
  // --------------------------------------------------------------------------
  describe('Fixture 5: Selected-store isolation', () => {
    it('isolates the selected store price and does not display From £... or competitor store price', () => {
      // Store A: Price £0.89
      const storeAProduct = createTestProduct({
        id: 'prod_snack_bar',
        name: 'Snack Bar',
        price: toMoney(89, 'GBP'),
        storeId: 'cstore_mayfair',
      });

      // Store B: Price £1.20
      const storeBProduct = createTestProduct({
        id: 'prod_snack_bar',
        name: 'Snack Bar',
        price: toMoney(120, 'GBP'),
        storeId: 'cstore_soho',
      });

      const crossStoreAvailability = {
        minimumPrice: 0.89,
        maximumPrice: 1.20,
      };

      // Helper simulating ProductCard.tsx displayPriceText logic
      function deriveProductCardPrice(
        product: Product,
        isStoreSelected: boolean,
        availabilitySummary: { minimumPrice?: number; maximumPrice?: number },
        currencySymbol: string = '£'
      ) {
        if (isStoreSelected) {
          if (product.price != null) {
            return formatCurrency(product.price, currencySymbol);
          }
          return 'Price unavailable';
        }

        const minP = availabilitySummary?.minimumPrice;
        const maxP = availabilitySummary?.maximumPrice;
        if (minP != null && maxP != null && Math.abs(minP - maxP) > 0.001) {
          return `From ${formatCurrency(minP, currencySymbol)}`;
        }
        if (minP != null) {
          return formatCurrency(minP, currencySymbol);
        }
        if (product.price != null) {
          return formatCurrency(product.price, currencySymbol);
        }
        return 'Price unavailable';
      }

      // 1. Browsing pre-store (all stores): Displays "From £0.89"
      const preStoreDisplay = deriveProductCardPrice(storeAProduct, false, crossStoreAvailability);
      expect(preStoreDisplay).toBe('From £0.89');

      // 2. Mayfair selected: MUST display isolated £0.89, NOT "From £0.89" and NOT £1.20
      const mayfairDisplay = deriveProductCardPrice(storeAProduct, true, crossStoreAvailability);
      expect(mayfairDisplay).toBe('£0.89');
      expect(mayfairDisplay).not.toContain('From');
      expect(mayfairDisplay).not.toBe('£1.20');

      // 3. Soho selected: MUST display isolated £1.20, NOT "From £0.89" and NOT £0.89
      const sohoDisplay = deriveProductCardPrice(storeBProduct, true, crossStoreAvailability);
      expect(sohoDisplay).toBe('£1.20');
      expect(sohoDisplay).not.toContain('From');
      expect(sohoDisplay).not.toBe('£0.89');
    });
  });

  // --------------------------------------------------------------------------
  // 6. FIXTURE: Fresh GET /locations?where={"account":accountId} Correlation
  // --------------------------------------------------------------------------
  describe('Fixture 6: Fresh GET /locations correlation with channelLinks string IDs', () => {
    let mockTokenManager: OAuthTokenManager;
    let adapter: LinkedAccountsAdapter;
    let fetchMock: any;

    beforeEach(() => {
      fetchMock = vi.fn();
      global.fetch = fetchMock;

      mockTokenManager = new OAuthTokenManager({
        environment: 'staging',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      vi.spyOn(mockTokenManager, 'getAccessToken').mockResolvedValue('mock-access-token-xyz');
      Object.defineProperty(mockTokenManager, 'isConfigured', { get: () => true });

      adapter = new LinkedAccountsAdapter({
        environment: 'staging',
        tokenManager: mockTokenManager,
      });
    });

    it('correlates commerce stores with physical locations using channelLinks string IDs, preserving address/coordinates without guessing physical IDs', async () => {
      // Mock /commerce/{accountId}/stores and /locations?where={"account":accountId}
      fetchMock.mockImplementation(async (url: string) => {
        if (url.includes('/commerce/acc_del_777/stores')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              total: 2,
              page: 1,
              size: 50,
              items: [
                {
                  id: 'cl_channel_01',
                  channelLinkId: 'cl_channel_01',
                  name: 'Covent Garden Express',
                  status: 'ONLINE',
                  currency: 'GBP',
                },
                {
                  id: 'cl_channel_unlinked',
                  channelLinkId: 'cl_channel_unlinked',
                  name: 'Standalone Virtual Store',
                  status: 'ONLINE',
                  currency: 'GBP',
                },
              ],
            }),
          };
        }

        if (url.includes('/locations')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              _items: [
                {
                  _id: 'loc_physical_covent',
                  name: 'Covent Garden Physical Depot',
                  address: {
                    street: '14 Floral Street',
                    city: 'London',
                    postalCode: 'WC2E 9DH',
                    country: 'GB',
                  },
                  coordinates: [-0.1245, 51.5121], // [longitude, latitude]
                  channelLinks: ['cl_channel_01'], // string ID correlation
                },
              ],
            }),
          };
        }

        return { ok: false, status: 404, json: async () => ({}) };
      });

      const result = await adapter.getCommerceStores('acc_del_777', 'tenant_retailer');

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);

      // Correlated store: physicalLocationId linked, address & coordinates preserved from physical location
      const linkedStore = result.stores.find((s) => s.channelLinkId === 'cl_channel_01');
      expect(linkedStore).toBeDefined();
      expect(linkedStore?.physicalLocationId).toBe('loc_physical_covent');
      expect(linkedStore?.address?.street).toBe('14 Floral Street');
      expect(linkedStore?.address?.city).toBe('London');
      expect(linkedStore?.address?.postcode).toBe('WC2E 9DH');
      expect(linkedStore?.coordinates?.latitude).toBe(51.5121);
      expect(linkedStore?.coordinates?.longitude).toBe(-0.1245);

      // Unlinked store: physicalLocationId must be null without guessing or inventing physical IDs
      const unlinkedStore = result.stores.find((s) => s.channelLinkId === 'cl_channel_unlinked');
      expect(unlinkedStore).toBeDefined();
      expect(unlinkedStore?.physicalLocationId).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 9. FIXTURE: Root catalogue "Other" fallback for unmapped / location-only items
  // --------------------------------------------------------------------------
  describe('Fixture 9: Root catalogue "Other" fallback category', () => {
    it('creates "Store Specials & Local Products" category and assigns unmapped or location-only products to it', () => {
      const mockRawMenu = {
        _id: 'menu_with_unmapped',
        categories: [
          { _id: 'cat_bakery', name: 'Bakery', subCategories: [], productIds: ['prod_bread'] }
        ],
        products: [
          { _id: 'prod_bread', name: 'Sourdough', categoryId: 'cat_bakery', active: true, price: 250 },
          { _id: 'prod_local_honey', name: 'Local Honey', categoryId: 'cat_unknown_location_only', active: true, price: 500 }
        ]
      };

      const parsed = DeliverectApiClient.parseDeliverectMenu(mockRawMenu, true);
      const fallbackCat = parsed.categories.find(c => c.id === FALLBACK_CATEGORY_ID);
      expect(fallbackCat).toBeDefined();
      expect(fallbackCat?.name).toBe(FALLBACK_CATEGORY_NAME);

      const bread = parsed.products.find(p => p.id === 'prod_bread');
      expect(bread?.categoryIds).toEqual(['cat_bakery']);

      const honey = parsed.products.find(p => p.id === 'prod_honey' || p.name === 'Local Honey');
      expect(honey?.categoryIds).toEqual([FALLBACK_CATEGORY_ID]);
    });
  });
});
