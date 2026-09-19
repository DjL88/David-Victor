import { DispatchAdapter, DispatchValidateParams, DispatchValidationResult } from './DispatchAdapter';
import { calculateHaversineDistanceMeters } from './CommerceDiscoveryService';
import { MOCK_STORES } from '../../src/commerce/mockData';

export class DemoDispatchAdapter implements DispatchAdapter {
  readonly adapterName = 'DemoDispatchAdapter';
  readonly isConnected = true;

  // Maximum serviceable delivery radius for demo courier dispatch: 12,000 meters (12km)
  private readonly maxServiceableMeters = 12000;

  async validateAvailability(params: DispatchValidateParams): Promise<DispatchValidationResult> {
    const { deliveryAddress, channelLinkId, storeId } = params;

    // Identify target store location if possible
    const targetStoreId = storeId || channelLinkId;
    const targetStore = MOCK_STORES.find(
      (s) => s.id === targetStoreId || s.channelLinkId === targetStoreId
    );

    const coords = (deliveryAddress as any).coordinates || (
      typeof (deliveryAddress as any).latitude === 'number' && typeof (deliveryAddress as any).longitude === 'number'
        ? { latitude: (deliveryAddress as any).latitude, longitude: (deliveryAddress as any).longitude }
        : undefined
    );

    // If coordinates are available and target store has coordinates, check real distance
    if (coords && targetStore?.coordinates) {
      const distanceMeters = calculateHaversineDistanceMeters(coords, targetStore.coordinates);
      if (distanceMeters > this.maxServiceableMeters) {
        const msg = `Delivery address is ${Math.round(distanceMeters / 1000)}km away, which exceeds maximum courier delivery radius (${this.maxServiceableMeters / 1000}km).`;
        return {
          available: false,
          failureReason: msg,
          reason: msg,
        };
      }
    } else if (coords) {
      // If store not found in mock data, check distance from Central London (51.5074, -0.1278)
      const distFromCentral = calculateHaversineDistanceMeters(coords, {
        latitude: 51.5074,
        longitude: -0.1278,
      });
      if (distFromCentral > 25000) {
        const msg = `Delivery address is ${Math.round(distFromCentral / 1000)}km away, which exceeds maximum courier delivery radius (25km).`;
        return {
          available: false,
          failureReason: msg,
          reason: msg,
        };
      }
    }

    // Generate valid 15-minute dispatch validation token with disp_val_ prefix
    const token = 'disp_val_' + Math.random().toString(36).substring(2, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      available: true,
      validationId: token,
      expiresAt,
      estimatedDeliveryTime: '30 mins',
      deliveryEtaMinutes: 30,
      deliveryPrice: 199,
      fee: {
        amount: 199, // 199 minor units (£1.99)
        currency: params.currency || 'GBP',
      },
      provider: 'Deliverect Dispatch (Demo)',
    };
  }
}
