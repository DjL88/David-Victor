import {
  DispatchAdapter,
  DispatchValidateParams,
  DispatchValidationResult,
  DispatchQuoteParams,
  DispatchQuoteResult,
  CourierQuote,
  DispatchAssignParams,
  DispatchAssignmentResult,
  DispatchCancelParams,
  DispatchCancelResult,
} from './DispatchAdapter';
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

  async getQuotes(params: DispatchQuoteParams): Promise<DispatchQuoteResult> {
    const valResult = await this.validateAvailability(params);
    if (!valResult.available) {
      return {
        available: false,
        quotes: [],
        failureReason: valResult.failureReason || valResult.reason || 'Courier dispatch unserviceable for this location',
        reason: valResult.reason,
      };
    }

    const currency = params.currency || 'GBP';
    const expiresAt = valResult.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Check if basket requires age verification (e.g. alcohol or 18+ tags)
    const hasRestrictedItems = Boolean(
      params.items?.some((i) => i.isAlcoholic || i.requiresAgeCheck)
    );

    const allQuotes: CourierQuote[] = [
      {
        quoteId: 'quote_deliverect_' + Math.random().toString(36).substring(2, 8),
        providerId: 'deliverect-dispatch',
        providerDisplayName: 'Deliverect Dispatch',
        fee: { amount: 199, currency, fractionalDigits: 2, formatted: '£1.99' },
        pickupEtaMinutes: 15,
        deliveryEtaMinutes: 30,
        estimatedPickupTime: '15 mins',
        estimatedDeliveryTime: '30 mins',
        expiresAt,
        supportsScheduledAssignment: true,
        supportsAgeVerification: true,
        supportsPin: true,
      },
      {
        quoteId: 'quote_justeat_' + Math.random().toString(36).substring(2, 8),
        providerId: 'just-eat',
        providerDisplayName: 'Just Eat',
        fee: { amount: 249, currency, fractionalDigits: 2, formatted: '£2.49' },
        pickupEtaMinutes: 12,
        deliveryEtaMinutes: 25,
        estimatedPickupTime: '12 mins',
        estimatedDeliveryTime: '25 mins',
        expiresAt,
        supportsScheduledAssignment: true,
        supportsAgeVerification: true,
        supportsPin: true,
      },
      {
        quoteId: 'quote_stuart_' + Math.random().toString(36).substring(2, 8),
        providerId: 'stuart',
        providerDisplayName: 'Stuart',
        fee: { amount: 179, currency, fractionalDigits: 2, formatted: '£1.79' },
        pickupEtaMinutes: 18,
        deliveryEtaMinutes: 35,
        estimatedPickupTime: '18 mins',
        estimatedDeliveryTime: '35 mins',
        expiresAt,
        supportsScheduledAssignment: false, // Stuart does not support future scheduled assignment
        supportsAgeVerification: true,
        supportsPin: false,
      },
      {
        quoteId: 'quote_uber_' + Math.random().toString(36).substring(2, 8),
        providerId: 'uber',
        providerDisplayName: 'Uber Direct',
        fee: { amount: 299, currency, fractionalDigits: 2, formatted: '£2.99' },
        pickupEtaMinutes: 10,
        deliveryEtaMinutes: 20,
        estimatedPickupTime: '10 mins',
        estimatedDeliveryTime: '20 mins',
        expiresAt,
        supportsScheduledAssignment: true,
        supportsAgeVerification: true,
        supportsPin: true,
      },
    ];

    let filtered = allQuotes;
    if (params.allowedProviders && params.allowedProviders.length > 0) {
      filtered = allQuotes.filter((q) => params.allowedProviders!.includes(q.providerId));
      if (filtered.length === 0) {
        filtered = allQuotes; // fallback if configuration is empty
      }
    }

    // Sort according to selection policy
    const policy = params.policy || 'CUSTOMER_CHOICE';
    let sorted = [...filtered];
    if (policy === 'CHEAPEST') {
      sorted.sort((a, b) => a.fee.amount - b.fee.amount);
    } else if (policy === 'FASTEST') {
      sorted.sort((a, b) => (a.deliveryEtaMinutes || 99) - (b.deliveryEtaMinutes || 99));
    }

    return {
      available: true,
      quotes: sorted,
      selectedQuote: sorted[0],
      validationId: valResult.validationId,
      expiresAt,
    };
  }

  async assignCourier(params: DispatchAssignParams): Promise<DispatchAssignmentResult> {
    const cleanId = (params.orderId || 'order').replace(/[^a-zA-Z0-9]/g, '');
    const deliveryJobId = `job_demo_${cleanId}_${Math.random().toString(36).substring(2, 7)}`;

    const providerMap: Record<string, string> = {
      'deliverect-dispatch': 'Deliverect Dispatch',
      'just-eat': 'Just Eat',
      'stuart': 'Stuart',
      'uber': 'Uber Direct',
    };

    const providerId = params.providerId || 'deliverect-dispatch';
    const providerDisplayName = providerMap[providerId] || 'Courier Partner';

    // Determine initial assignment status based on timing
    let status: 'ASSIGNED' | 'SCHEDULED' = 'ASSIGNED';
    let scheduledFor: string | undefined = undefined;

    if (params.targetPickupTime) {
      const targetTime = new Date(params.targetPickupTime).getTime();
      const now = Date.now();
      // If target time is more than 3 minutes in future, it is scheduled
      if (targetTime - now > 3 * 60 * 1000) {
        status = 'SCHEDULED';
        scheduledFor = params.targetPickupTime;
      }
    }

    return {
      deliveryJobId,
      status,
      providerId,
      providerDisplayName,
      courierName: 'Alex Driver',
      courierPhone: '+44 7700 900123',
      etaMinutes: 25,
      estimatedDeliveryTime: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
      trackingUrl: `https://track.courier.demo/${params.orderId}`,
      proofOfDeliveryUrl: `https://proof.courier.demo/${params.orderId}/photo.jpg`,
      pinRequirement: params.requiresPin
        ? {
            required: true,
            instruction: 'Provide the last 4 digits of your phone number or order PIN to courier',
            status: 'PENDING',
          }
        : undefined,
      ageVerificationRequirement: params.requiresAgeCheck
        ? {
            required: true,
            minimumAge: params.minimumAge || 18,
            status: 'PENDING_COURIER_CHECK', // Strictly PENDING - never fabricate verification before delivery!
            instruction: 'Challenge 25: Valid photographic ID required upon delivery',
          }
        : {
            required: false,
            status: 'NOT_REQUIRED',
          },
      scheduledFor,
      targetPickupTime: params.targetPickupTime,
      idempotencyKey: params.idempotencyKey,
    };
  }

  async cancelDispatch(params: DispatchCancelParams): Promise<DispatchCancelResult> {
    return {
      success: true,
      deliveryJobId: params.deliveryJobId,
      status: 'CANCELLED',
      reason: params.reason || 'Order cancelled before delivery',
    };
  }
}
