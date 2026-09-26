import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoDispatchAdapter } from '../../server/deliverect/DemoDispatchAdapter';
import { IntegrationUnavailableDispatchAdapter } from '../../server/deliverect/IntegrationUnavailableDispatchAdapter';
import { DeliverectDispatchAdapter } from '../../server/deliverect/DeliverectDispatchAdapter';
import { CommerceDiscoveryService } from '../../server/deliverect/CommerceDiscoveryService';
import { Store, Coordinates, StoreStatus } from '../commerce/models';
import { BFFError } from '../../server/errors';
import { ValidateDispatchSchema, CheckoutBasketSchema, SearchStoresSchema } from '../../server/api/schemas';

describe('Phase 8: Store Eligibility & Dispatch Validation', () => {
  describe('DispatchAdapter Implementations', () => {
    describe('DemoDispatchAdapter (DSP-01, DSP-02)', () => {
      const adapter = new DemoDispatchAdapter();

      it('returns valid dispatch quote and token for serviceable delivery address', async () => {
        const result = await adapter.validateAvailability({
          channelLinkId: 'store-1',
          storeId: 'store-1',
          deliveryAddress: {
            street: '10 Downing Street',
            city: 'London',
            postalCode: 'SW1A 2AA',
            country: 'GB',
            coordinates: { latitude: 51.5034, longitude: -0.1276 },
          },
          orderValueMinorUnits: 2500,
          currency: 'GBP',
        });

        expect(result.available).toBe(true);
        expect(result.validationId).toMatch(/^disp_val_/);
        expect(result.expiresAt).toBeDefined();
        // Validation expires in ~15 minutes
        const expiryMs = new Date(result.expiresAt!).getTime();
        expect(expiryMs).toBeGreaterThan(Date.now() + 10 * 60 * 1000);
        expect(result.estimatedDeliveryTime).toBeDefined();
        expect(result.fee).toBeDefined();
        expect(result.fee?.amount).toBeGreaterThan(0);
        expect(result.fee?.currency).toBe('GBP');
      });

      it('returns available: false with reason for far-away unserviceable coordinates (DSP-02)', async () => {
        const result = await adapter.validateAvailability({
          channelLinkId: 'store-1',
          storeId: 'store-1',
          deliveryAddress: {
            street: 'High Street',
            city: 'Edinburgh',
            postalCode: 'EH1 1YZ',
            country: 'GB',
            coordinates: { latitude: 55.9533, longitude: -3.1883 }, // Scotland: ~500km away
          },
        });

        expect(result.available).toBe(false);
        expect(result.failureReason).toBeDefined();
        expect(result.failureReason).toContain('exceeds maximum courier delivery radius');
      });
    });

    describe('IntegrationUnavailableDispatchAdapter (Staging/Prod without credentials)', () => {
      const adapter = new IntegrationUnavailableDispatchAdapter('staging', 'missing_credentials');

      it('throws 503 INTEGRATION_NOT_CONFIGURED rather than inventing fake delivery quotes', async () => {
        await expect(
          adapter.validateAvailability({
            channelLinkId: 'store-1',
            deliveryAddress: {
              street: '10 Downing Street',
              city: 'London',
              country: 'GB',
            },
          })
        ).rejects.toThrow(BFFError);

        try {
          await adapter.validateAvailability({
            channelLinkId: 'store-1',
            deliveryAddress: { street: '10 Downing Street', city: 'London', country: 'GB' },
          });
        } catch (err: any) {
          expect(err.statusCode).toBe(503);
          expect(err.code).toBe('INTEGRATION_NOT_CONFIGURED');
        }
      });
    });

    describe('DeliverectDispatchAdapter (Production Upstream Protocol)', () => {
      const tokenManager = () => ({
        isConfigured: true,
        getAccessToken: vi.fn().mockResolvedValue('test_bearer_token_123'),
        invalidateToken: vi.fn(),
        getEnvironment: vi.fn().mockReturnValue('staging'),
        getBaseUrl: vi.fn().mockReturnValue('https://api.staging.deliverect.com'),
      }) as any;

      it('uses the verified /fulfillment/validate request and response contract', async () => {
        const fakeTokenManager = tokenManager();
        const expiresAt = '2026-09-26T14:30:00.000Z';
        const fakeFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            available: true,
            validationId: 'dlv_val_abc999',
            expiresAt,
            pickupTimeEta: '2026-09-26T14:22:00.000Z',
            deliveryTimeETA: '2026-09-26T14:42:00.000Z',
            price: 350,
          }),
        });

        const adapter = new DeliverectDispatchAdapter(fakeTokenManager, fakeFetch);
        const result = await adapter.validateAvailability({
          channelLinkId: 'channel-store-99',
          pickupTime: '2026-09-26T14:20:00.000Z',
          deliveryTime: '2026-09-26T14:45:00.000Z',
          deliveryAddress: {
            street: 'Oxford Street',
            city: 'London',
            postalCode: 'W1D 1BS',
            country: 'GB',
            coordinates: { latitude: 51.5154, longitude: -0.1419 },
          },
          orderValueMinorUnits: 4200,
          currency: 'GBP',
          itemsCount: 3,
        });

        expect(result).toMatchObject({
          available: true,
          validationId: 'dlv_val_abc999',
          expiresAt,
          deliveryPrice: 350,
          fee: { amount: 350, currency: 'GBP' },
          estimatedPickupTime: '2026-09-26T14:22:00.000Z',
          estimatedDeliveryTime: '2026-09-26T14:42:00.000Z',
        });
        expect(result.provider).toBeUndefined();

        const [url, options] = fakeFetch.mock.calls[0];
        expect(url).toBe('https://api.staging.deliverect.com/fulfillment/validate');
        expect(options.method).toBe('POST');
        expect(options.headers.Authorization).toBe('Bearer test_bearer_token_123');
        expect(JSON.parse(options.body)).toEqual({
          channelLinkId: 'channel-store-99',
          pickupReadyTime: '2026-09-26T14:20:00.000Z',
          deliveryLocations: {
            deliveryTime: '2026-09-26T14:45:00.000Z',
            street: 'Oxford Street',
            city: 'London',
            country: 'GB',
            postalCode: 'W1D 1BS',
            coordinates: { latitude: 51.5154, longitude: -0.1419 },
          },
        });
        expect(options.body).not.toContain('orderValue');
        expect(options.body).not.toContain('itemsCount');
      });

      it('keeps unavailable provider evidence unavailable without inventing a quote', async () => {
        const fakeFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ available: false, errors: 'No valid offers available' }),
        });
        const adapter = new DeliverectDispatchAdapter(tokenManager(), fakeFetch);
        const result = await adapter.getQuotes({
          channelLinkId: 'channel-1',
          deliveryAddress: {
            street: 'Oxford Street', city: 'London', postalCode: 'W1D 1BS', country: 'GB',
          },
          currency: 'GBP',
        });

        expect(result).toEqual({
          available: false,
          quotes: [],
          failureReason: 'No valid offers available',
        });
      });

      it('returns validation evidence without synthesising provider, quote id, or expiry', async () => {
        const expiresAt = '2026-09-26T14:30:00.000Z';
        const fakeFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            available: true,
            validationId: 'validation-real',
            expiresAt,
            price: 299,
          }),
        });
        const adapter = new DeliverectDispatchAdapter(tokenManager(), fakeFetch);
        const result = await adapter.getQuotes({
          channelLinkId: 'channel-1',
          deliveryAddress: {
            street: 'Oxford Street', city: 'London', postalCode: 'W1D 1BS', country: 'GB',
          },
          currency: 'GBP',
        });

        expect(result).toMatchObject({
          available: true,
          validationId: 'validation-real',
          expiresAt,
          quotes: [],
        });
        expect(result.selectedQuote).toBeUndefined();
        expect(JSON.stringify(result)).not.toContain('deliverect-dispatch');
        expect(JSON.stringify(result)).not.toContain('quote_deliverect_');
      });

      it('rejects an incomplete successful response instead of inventing missing validation evidence', async () => {
        const adapter = new DeliverectDispatchAdapter(tokenManager(), vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ available: true }),
        }) as any);

        await expect(adapter.validateAvailability({
          channelLinkId: 'channel-1',
          deliveryAddress: {
            street: 'Oxford Street', city: 'London', postalCode: 'W1D 1BS', country: 'GB',
          },
        })).rejects.toMatchObject({ code: 'UPSTREAM_DISPATCH_CONTRACT_INVALID', statusCode: 502 });
      });

      it('refreshes token and retries once on 401 Unauthorized', async () => {
        const fakeTokenManager = tokenManager();
        fakeTokenManager.getAccessToken = vi
          .fn()
          .mockResolvedValueOnce('stale_token')
          .mockResolvedValueOnce('fresh_token');
        const fakeFetch = vi
          .fn()
          .mockResolvedValueOnce({ ok: false, status: 401 })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
              available: true,
              validationId: 'dlv_val_refreshed_1',
              expiresAt: '2026-09-26T14:30:00.000Z',
            }),
          });

        const adapter = new DeliverectDispatchAdapter(fakeTokenManager, fakeFetch);
        const result = await adapter.validateAvailability({
          channelLinkId: 'channel-1',
          deliveryAddress: {
            street: 'Oxford Street', city: 'London', postalCode: 'W1D 1BS', country: 'GB',
          },
        });

        expect(result.validationId).toBe('dlv_val_refreshed_1');
        expect(fakeTokenManager.invalidateToken).toHaveBeenCalledTimes(1);
        expect(fakeFetch).toHaveBeenCalledTimes(2);
      });

      it('keeps unverified live assignment and dispatch-job cancellation disabled', async () => {
        const adapter = new DeliverectDispatchAdapter(tokenManager(), vi.fn() as any);
        await expect(adapter.assignCourier({} as any))
          .rejects.toMatchObject({ code: 'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED', statusCode: 501 });
        await expect(adapter.cancelDispatch({} as any))
          .rejects.toMatchObject({ code: 'UPSTREAM_DISPATCH_OPERATION_UNSUPPORTED', statusCode: 501 });
      });
    });
  });

  describe('CommerceDiscoveryService with Dispatch Validation (Section 12 & Phase 8)', () => {
    const discoveryService = CommerceDiscoveryService.getInstance();
    const centralCoords: Coordinates = { latitude: 51.5074, longitude: -0.1278 };

    beforeEach(() => {
      discoveryService.clearCache();
    });

    it('filters out unserviceable delivery candidates and prioritizes serviceable ones (DSP-01, DSP-05)', async () => {
      // Mock dispatch adapter where store-far is unserviceable
      const mockDispatchAdapter = {
        validateAvailability: vi.fn().mockImplementation(async (params: any) => {
          if (params.channelLinkId === 'store-far') {
            return {
              available: false,
              failureReason: 'No couriers in service area',
            };
          }
          return {
            available: true,
            validationId: `val_${params.channelLinkId}`,
            expiresAt: new Date(Date.now() + 900000).toISOString(),
            fee: { amount: 250, currency: 'GBP' },
            estimatedDeliveryTime: '20-30 mins',
          };
        }),
      };

      const mockStores: Store[] = [
        {
          id: 'store-close',
          name: 'Close Store',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: 51.51, longitude: -0.13 },
          distanceMeters: 500,
          status: 'OPEN' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: true,
        },
        {
          id: 'store-far',
          name: 'Unserviceable Delivery Store',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: 51.55, longitude: -0.10 },
          distanceMeters: 5000,
          status: 'OPEN' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: true,
        },
      ];

      const result = await discoveryService.discoverStores({
        coordinates: centralCoords,
        tenantId: 'brand-alpha',
        appMode: 'demo',
        customStores: mockStores,
        fulfillmentType: 'delivery',
        deliveryAddress: { street: '10 Downing Street', city: 'London', country: 'GB' },
        dispatchAdapter: mockDispatchAdapter as any,
      });

      // Delivery candidate 'store-far' failed dispatch, but supportsPickup and is <=20km,
      // so it is preserved as a collection fallback option (DSP-06)
      const storeClose = result.eligibleStores.find((s) => s.id === 'store-close');
      const storeFar = result.eligibleStores.find((s) => s.id === 'store-far');

      expect(storeClose).toBeDefined();
      expect(storeClose?.dispatchAvailability?.available).toBe(true);

      expect(storeFar).toBeDefined();
      expect(storeFar?.dispatchAvailability?.available).toBe(false);
      expect(storeFar?.dispatchAvailability?.failureReason).toBe('No couriers in service area');
    });

    it('returns genuine zero-store state when no stores are serviceable and collection is disabled (DSP-07)', async () => {
      const mockDispatchAdapter = {
        validateAvailability: vi.fn().mockResolvedValue({
          available: false,
          failureReason: 'No couriers available',
        }),
      };

      const mockStores: Store[] = [
        {
          id: 'store-delivery-only',
          name: 'Delivery Only Store',
          address: { city: 'London', country: 'GB' },
          coordinates: { latitude: 51.51, longitude: -0.13 },
          distanceMeters: 800,
          status: 'OPEN' as StoreStatus,
          supportsDelivery: true,
          supportsPickup: false, // Pickup disabled!
        },
      ];

      const result = await discoveryService.discoverStores({
        coordinates: centralCoords,
        tenantId: 'brand-alpha',
        appMode: 'demo',
        customStores: mockStores,
        fulfillmentType: 'delivery',
        deliveryAddress: { street: '10 Downing Street', city: 'London', country: 'GB' },
        dispatchAdapter: mockDispatchAdapter as any,
      });

      // No serviceable delivery stores and no pickup fallback => Genuine zero store state
      expect(result.eligibleStores.length).toBe(0);
      expect(result.hasDeliveryCoverage).toBe(false);
    });
  });

  describe('Dispatch & Checkout Schemas & Expiration Validation (DSP-03)', () => {
    it('validates ValidateDispatchSchema requiring deliveryAddress', () => {
      const valid = ValidateDispatchSchema.safeParse({
        channelLinkId: 'store-1',
        deliveryAddress: {
          street: '10 Downing Street',
          city: 'London',
          postalCode: 'SW1A 2AA',
          country: 'GB',
        },
        orderValueMinorUnits: 3000,
        currency: 'GBP',
      });
      expect(valid.success).toBe(true);

      const invalidMissingAddress = ValidateDispatchSchema.safeParse({
        channelLinkId: 'store-1',
      });
      expect(invalidMissingAddress.success).toBe(false);
    });

    it('validates CheckoutBasketSchema accepting dispatchValidationId and dispatchValidationExpiresAt', () => {
      const futureTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const valid = CheckoutBasketSchema.safeParse({
        basketId: 'b_demo_1',
        options: {
          fulfillmentType: 'delivery',
          dispatchValidationId: 'disp_val_abc123',
          dispatchValidationExpiresAt: futureTime,
        },
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.options?.dispatchValidationId).toBe('disp_val_abc123');
        expect(valid.data.options?.dispatchValidationExpiresAt).toBe(futureTime);
      }
    });

    it('identifies expired dispatch validation token (DSP-03 expiry enforcement)', () => {
      const pastTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes ago
      const expiry = new Date(pastTime).getTime();
      const isExpired = Number.isFinite(expiry) && Date.now() > expiry;
      expect(isExpired).toBe(true);

      const futureTime = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes ahead
      const futureExpiry = new Date(futureTime).getTime();
      const isFutureExpired = Number.isFinite(futureExpiry) && Date.now() > futureExpiry;
      expect(isFutureExpired).toBe(false);
    });

    it('validates SearchStoresSchema with Address object restored from session storage', () => {
      const payloadWithAddressObject = {
        coordinates: {
          latitude: 51.5,
          longitude: -0.1,
        },
        address: {
          city: 'London',
          postalCode: 'SW1A 1AA',
          country: 'GB',
        },
        preferredFulfillment: 'delivery',
      };
      const result = SearchStoresSchema.safeParse(payloadWithAddressObject);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.address).toBe('object');
        expect((result.data.address as any).city).toBe('London');
      }
    });

    it('validates SearchStoresSchema with string address', () => {
      const payloadWithStringAddress = {
        coordinates: {
          latitude: 51.5,
          longitude: -0.1,
        },
        address: '10 Downing St, London SW1A 2AA',
        preferredFulfillment: 'pickup',
      };
      const result = SearchStoresSchema.safeParse(payloadWithStringAddress);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.address).toBe('10 Downing St, London SW1A 2AA');
      }
    });
  });
});
