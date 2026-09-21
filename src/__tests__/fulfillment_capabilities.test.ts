import { describe, it, expect } from 'vitest';
import { normalizeFulfillmentCapabilities } from '../../server/deliverect/LinkedAccountsAdapter';

describe('Deliverect Store Fulfillment Capabilities Normalization', () => {
  it('1. Priority 1: fulfillmentTypes=["delivery"] => delivery true, pickup false', () => {
    const rawStore = {
      id: 'store_del_only',
      fulfillmentTypes: ['delivery'],
      settings: { pickup: { enabled: true } }, // Should be overridden by Priority 1
      fulfillmentCapabilities: { pickup: true, delivery: true }, // Should be overridden by Priority 1
    };

    const res = normalizeFulfillmentCapabilities(rawStore);
    expect(res).toBeDefined();
    expect(res?.delivery).toBe(true);
    expect(res?.pickup).toBe(false);
    expect(res?.scheduling).toBe(false);
    expect(res?.provenance).toBe('fulfillmentTypes');
  });

  it('2. Priority 1: fulfillmentTypes=["delivery", "pickup"] => both true', () => {
    const rawStore = {
      id: 'store_both',
      fulfillmentTypes: ['DELIVERY', 'PICKUP'],
    };

    const res = normalizeFulfillmentCapabilities(rawStore);
    expect(res).toBeDefined();
    expect(res?.delivery).toBe(true);
    expect(res?.pickup).toBe(true);
    expect(res?.provenance).toBe('fulfillmentTypes');
  });

  it('3. Priority 2: settings.pickup.enabled=false => pickup false', () => {
    const rawStore = {
      id: 'store_settings_off',
      settings: {
        pickup: { enabled: false },
        delivery: { enabled: true },
      },
    };

    const res = normalizeFulfillmentCapabilities(rawStore);
    expect(res).toBeDefined();
    expect(res?.delivery).toBe(true);
    expect(res?.pickup).toBe(false);
    expect(res?.provenance).toBe('settings');
  });

  it('4. Priority 2: settings.pickup.enabled=true => pickup true', () => {
    const rawStore = {
      id: 'store_settings_on',
      settings: {
        pickup: { enabled: true },
      },
    };

    const res = normalizeFulfillmentCapabilities(rawStore);
    expect(res).toBeDefined();
    expect(res?.delivery).toBe(false);
    expect(res?.pickup).toBe(true);
    expect(res?.provenance).toBe('settings');
  });

  it('5. Priority 4: missing capability data => pickup false, delivery false (returns undefined)', () => {
    const rawStore = {
      id: 'minimal_store_no_caps',
      name: 'Minimal Store',
    };

    const res = normalizeFulfillmentCapabilities(rawStore);
    expect(res).toBeUndefined();

    // Verification when mapped to store:
    const supportsDelivery = Boolean(res?.delivery ?? false);
    const supportsPickup = Boolean(res?.pickup ?? false);
    expect(supportsDelivery).toBe(false);
    expect(supportsPickup).toBe(false);
  });

  it('6. Priority 3: legacy fulfillmentCapabilities array and object mapping', () => {
    const rawStoreArray = {
      id: 'legacy_array',
      fulfillmentCapabilities: ['DELIVERY', 'COLLECTION'],
    };

    const resArray = normalizeFulfillmentCapabilities(rawStoreArray);
    expect(resArray).toEqual({
      delivery: true,
      pickup: true,
      scheduling: false,
      provenance: 'fulfillmentCapabilities',
    });

    const rawStoreObj = {
      id: 'legacy_obj',
      fulfillmentCapabilities: {
        delivery: true,
        collection: true,
        scheduling: false,
      },
    };

    const resObj = normalizeFulfillmentCapabilities(rawStoreObj);
    expect(resObj).toEqual({
      delivery: true,
      pickup: true,
      scheduling: false,
      provenance: 'fulfillmentCapabilities',
    });
  });

  it('7. Unknown capability never defaults to true', () => {
    const rawStoreUnknown = {
      id: 'store_unknown',
      fulfillmentCapabilities: {},
    };

    const res = normalizeFulfillmentCapabilities(rawStoreUnknown);
    const supportsDelivery = Boolean(res?.delivery ?? false);
    const supportsPickup = Boolean(res?.pickup ?? false);

    expect(supportsDelivery).toBe(false);
    expect(supportsPickup).toBe(false);
  });
});
