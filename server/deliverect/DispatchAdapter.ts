import { Address, Coordinates, Money, DispatchAvailability } from '../../src/commerce/models';
import { DispatchState, DispatchPinRequirement, DispatchAgeVerificationRequirement } from '../../src/commerce/postCheckoutModels';
import { CourierSelectionPolicy } from '../../src/rules/types';

export interface DispatchValidateParams {
  channelLinkId?: string;
  storeId?: string;
  deliveryAddress: Address | {
    street?: string;
    city?: string;
    postalCode?: string;
    postcode?: string;
    country?: string;
    coordinates?: Coordinates;
    formattedAddress?: string;
  };
  pickupTime?: string;
  deliveryTime?: string;
  orderValueMinorUnits?: number;
  currency?: string;
  itemsCount?: number;
}

export interface DispatchValidationResult extends DispatchAvailability {
  available: boolean;
  validationId?: string;
  expiresAt?: string; // ISO 8601 string
  deliveryEtaMinutes?: number;
  deliveryPrice?: number;
  pickupEtaMinutes?: number;
  reason?: string;
  rejectionReason?: string;
  failureReason?: string;
  provider?: string;
}

export interface CourierQuote {
  quoteId: string;
  providerId: string;
  providerDisplayName: string;
  fee: Money;
  pickupEtaMinutes?: number;
  deliveryEtaMinutes?: number;
  estimatedPickupTime?: string;
  estimatedDeliveryTime?: string;
  expiresAt: string; // ISO 8601 string
  supportsScheduledAssignment?: boolean;
  supportsAgeVerification?: boolean;
  supportsPin?: boolean;
}

export interface DispatchQuoteParams extends DispatchValidateParams {
  tenantId?: string;
  requiresAgeCheck?: boolean;
  minimumAge?: number;
  items?: Array<{
    plu: string;
    name: string;
    quantity: number;
    isAlcoholic?: boolean;
    requiresAgeCheck?: boolean;
    price?: Money;
  }>;
  policy?: CourierSelectionPolicy;
  allowedProviders?: string[];
}

export interface DispatchQuoteResult {
  available: boolean;
  quotes: CourierQuote[];
  selectedQuote?: CourierQuote;
  validationId?: string;
  expiresAt?: string;
  failureReason?: string;
  reason?: string;
}

export interface DispatchAssignParams {
  orderId: string;
  tenantId: string;
  channelLinkId?: string;
  storeId?: string;
  quoteId: string;
  providerId?: string;
  deliveryAddress: Address;
  customerContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  targetPickupTime?: string; // ISO 8601
  scheduledDeliveryTime?: string;
  itemsCount: number;
  orderValueMinorUnits?: number;
  currency?: string;
  requiresAgeCheck?: boolean;
  minimumAge?: number;
  requiresPin?: boolean;
  idempotencyKey: string;
  attemptCount?: number;
}

export interface DispatchAssignmentResult {
  deliveryJobId: string;
  status: DispatchState;
  providerId: string;
  providerDisplayName: string;
  courierName?: string;
  courierPhone?: string;
  etaMinutes?: number;
  estimatedDeliveryTime?: string;
  trackingUrl?: string;
  proofOfDeliveryUrl?: string;
  pinRequirement?: DispatchPinRequirement;
  ageVerificationRequirement?: DispatchAgeVerificationRequirement;
  scheduledFor?: string;
  targetPickupTime?: string;
  idempotencyKey: string;
  error?: string;
}

export interface DispatchCancelParams {
  orderId: string;
  tenantId: string;
  deliveryJobId: string;
  reason?: string;
  idempotencyKey: string;
}

export interface DispatchCancelResult {
  success: boolean;
  deliveryJobId: string;
  status: 'CANCELLED' | 'CANCEL_PENDING' | 'FAILED';
  reason?: string;
}

export interface DispatchAdapterCapabilities {
  validateAvailability: boolean;
  quoteProjection: boolean;
  directAssignment: boolean;
  directCancellation: boolean;
  providerManagedLifecycle: boolean;
  courierStatusIngress: boolean;
}

export const DELIVERECT_DISPATCH_CAPABILITIES: DispatchAdapterCapabilities = Object.freeze({
  validateAvailability: true,
  quoteProjection: true,
  directAssignment: false,
  directCancellation: false,
  providerManagedLifecycle: true,
  courierStatusIngress: false,
});

export const DEMO_DISPATCH_CAPABILITIES: DispatchAdapterCapabilities = Object.freeze({
  validateAvailability: true,
  quoteProjection: true,
  directAssignment: true,
  directCancellation: true,
  providerManagedLifecycle: false,
  courierStatusIngress: true,
});

export const UNAVAILABLE_DISPATCH_CAPABILITIES: DispatchAdapterCapabilities = Object.freeze({
  validateAvailability: false,
  quoteProjection: false,
  directAssignment: false,
  directCancellation: false,
  providerManagedLifecycle: false,
  courierStatusIngress: false,
});

const UNKNOWN_DISPATCH_CAPABILITIES: DispatchAdapterCapabilities = Object.freeze({
  validateAvailability: false,
  quoteProjection: false,
  directAssignment: false,
  directCancellation: false,
  providerManagedLifecycle: false,
  courierStatusIngress: false,
});

export interface DispatchAdapter {
  readonly adapterName: string;
  readonly isConnected: boolean;
  /** Optional while legacy/test adapters migrate to explicit capability metadata. */
  readonly capabilities?: DispatchAdapterCapabilities;

  validateAvailability(params: DispatchValidateParams): Promise<DispatchValidationResult>;
  getQuotes(params: DispatchQuoteParams): Promise<DispatchQuoteResult>;
  assignCourier(params: DispatchAssignParams): Promise<DispatchAssignmentResult>;
  cancelDispatch(params: DispatchCancelParams): Promise<DispatchCancelResult>;
}


/**
 * Central capability resolution keeps orchestration provider-neutral while legacy
 * adapters migrate to explicit metadata. Unknown adapters fail closed rather than
 * inheriting destructive assignment/cancellation powers.
 */
export function getDispatchAdapterCapabilities(adapter: DispatchAdapter): DispatchAdapterCapabilities {
  if (adapter.capabilities) return adapter.capabilities;

  switch (adapter.adapterName) {
    case 'DeliverectDispatchAdapter':
      return DELIVERECT_DISPATCH_CAPABILITIES;
    case 'DemoDispatchAdapter':
      return DEMO_DISPATCH_CAPABILITIES;
    case 'IntegrationUnavailableDispatchAdapter':
      return UNAVAILABLE_DISPATCH_CAPABILITIES;
    default:
      return UNKNOWN_DISPATCH_CAPABILITIES;
  }
}
