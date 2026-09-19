import { Address, Coordinates, Money, DispatchAvailability } from '../../src/commerce/models';

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
  provider?: string;
}

export interface DispatchAdapter {
  readonly adapterName: string;
  readonly isConnected: boolean;

  validateAvailability(params: DispatchValidateParams): Promise<DispatchValidationResult>;
}
