import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_DISPATCH_CAPABILITIES,
  DELIVERECT_DISPATCH_CAPABILITIES,
  DispatchAdapter,
  DispatchAdapterCapabilities,
  getDispatchAdapterCapabilities,
} from '../../server/deliverect/DispatchAdapter';

function adapterStub(
  adapterName: string,
  capabilities?: DispatchAdapterCapabilities
): DispatchAdapter {
  return {
    adapterName,
    isConnected: true,
    capabilities,
    validateAvailability: vi.fn(),
    getQuotes: vi.fn(),
    assignCourier: vi.fn(),
    cancelDispatch: vi.fn(),
  };
}

describe('Dispatch adapter capability contract', () => {
  it('marks Deliverect Dispatch as provider-managed without invented direct job operations', () => {
    const capabilities = getDispatchAdapterCapabilities(
      adapterStub('DeliverectDispatchAdapter')
    );

    expect(capabilities).toEqual(DELIVERECT_DISPATCH_CAPABILITIES);
    expect(capabilities.validateAvailability).toBe(true);
    expect(capabilities.quoteProjection).toBe(true);
    expect(capabilities.providerManagedLifecycle).toBe(true);
    expect(capabilities.directAssignment).toBe(false);
    expect(capabilities.directCancellation).toBe(false);
    expect(capabilities.courierStatusIngress).toBe(false);
  });

  it('keeps the demo adapter capable of exercising the full simulated lifecycle', () => {
    const capabilities = getDispatchAdapterCapabilities(adapterStub('DemoDispatchAdapter'));

    expect(capabilities).toEqual(DEMO_DISPATCH_CAPABILITIES);
    expect(capabilities.directAssignment).toBe(true);
    expect(capabilities.directCancellation).toBe(true);
    expect(capabilities.courierStatusIngress).toBe(true);
  });

  it('fails closed for an unknown provider until its capabilities are declared', () => {
    const capabilities = getDispatchAdapterCapabilities(adapterStub('FutureCourierAdapter'));

    expect(capabilities).toEqual({
      validateAvailability: false,
      quoteProjection: false,
      directAssignment: false,
      directCancellation: false,
      providerManagedLifecycle: false,
      courierStatusIngress: false,
    });
  });

  it('prefers explicit adapter capabilities for future provider implementations', () => {
    const declared: DispatchAdapterCapabilities = {
      validateAvailability: true,
      quoteProjection: true,
      directAssignment: true,
      directCancellation: false,
      providerManagedLifecycle: false,
      courierStatusIngress: true,
    };

    expect(
      getDispatchAdapterCapabilities(adapterStub('FutureCourierAdapter', declared))
    ).toBe(declared);
  });
});
