import type { DispatchState } from '../../src/commerce/postCheckoutModels';
import { BFFError } from '../errors';

export interface DeliverectCourierUpdatePayload {
  orderId?: string;
  channelOrderId?: string;
  status?: number | string;
  pickupTime?: string;
  deliveryTime?: string;
  courierName?: string;
  courierId?: string;
  dispatchPartner?: string;
  trackingURL?: string;
  multipleDrivers?: boolean;
  coordinates?: unknown;
  [key: string]: unknown;
}

export interface NormalizedDeliverectCourierUpdate {
  orderIdentifiers: string[];
  internalState?: DispatchState;
  sourceStatusCode: number;
  sourceStatusLabel: string;
  providerDisplayName?: string;
  trackingUrl?: string;
  estimatedDeliveryTime?: string;
}

const COURIER_STATUS_LABELS: Record<number, string> = {
  80: 'IN_DELIVERY',
  81: 'DELIVERY_CREATED',
  83: 'EN_ROUTE_TO_PICKUP',
  84: 'ALMOST_AT_PICKUP',
  85: 'ARRIVED_AT_PICKUP',
  87: 'EN_ROUTE_TO_DROPOFF',
  89: 'ARRIVED_AT_DROPOFF',
  90: 'DELIVERED',
  115: 'DELIVERY_CANCELLED',
};

const COURIER_STATE_MAP: Partial<Record<number, DispatchState>> = {
  80: 'ASSIGNED',
  83: 'PICKUP_EN_ROUTE',
  84: 'PICKUP_EN_ROUTE',
  87: 'PICKED_UP',
  89: 'PICKED_UP',
  90: 'DELIVERED',
  115: 'CANCELLED',
};

function optionalText(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || undefined;
}

function optionalHttpUrl(value: unknown): string | undefined {
  const text = optionalText(value);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function optionalIsoDate(value: unknown): string | undefined {
  const text = optionalText(value);
  if (!text) return undefined;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

export function normalizeDeliverectCourierUpdate(
  payload: DeliverectCourierUpdatePayload
): NormalizedDeliverectCourierUpdate {
  const orderId = optionalText(payload?.orderId);
  const channelOrderId = optionalText(payload?.channelOrderId);
  const orderIdentifiers = Array.from(new Set([channelOrderId, orderId].filter(Boolean) as string[]));
  if (!orderIdentifiers.length) {
    throw new BFFError(
      'UPSTREAM_DISPATCH_CONTRACT_INVALID',
      'Courier update did not contain a usable order identifier.',
      400,
      false
    );
  }

  const status = Number(payload?.status);
  if (!Number.isInteger(status)) {
    throw new BFFError(
      'UPSTREAM_DISPATCH_CONTRACT_INVALID',
      'Courier update did not contain a valid numeric courier status.',
      400,
      false
    );
  }

  return {
    orderIdentifiers,
    internalState: COURIER_STATE_MAP[status],
    sourceStatusCode: status,
    sourceStatusLabel: COURIER_STATUS_LABELS[status] || `UNKNOWN_${status}`,
    providerDisplayName: optionalText(payload?.dispatchPartner),
    trackingUrl: optionalHttpUrl(payload?.trackingURL),
    estimatedDeliveryTime: optionalIsoDate(payload?.deliveryTime),
  };
}
