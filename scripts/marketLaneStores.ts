import fs from 'fs';
import { CATEGORIES } from './marketLaneCategories';

export interface StoreDefinition {
  id: string;
  name: string;
  address: {
    line1: string;
    city: string;
    postalCode: string;
    country: string;
    formattedAddress: string;
  };
  coordinates: { latitude: number; longitude: number };
  distanceMeters: number;
  status: 'open' | 'closed' | 'busy' | 'paused';
  supportsDelivery: boolean;
  supportsPickup: boolean;
  collectionAvailable: boolean;
  deliveryEta?: string;
  deliveryPrice?: number;
  minOrderAmount?: number;
  locationGroup?: string;
  channelLinks?: Array<'DIRECT' | 'DELIVEROO' | 'UBER_EATS' | 'JUST_EAT'>;
  dispatchAvailability?: {
    available: boolean;
    validationId?: string;
    deliveryEtaMinutes?: number;
    deliveryPrice?: number;
    pickupEtaMinutes?: number;
    reason?: string;
  };
}

export const MARKET_LANE_STORES: StoreDefinition[] = [
  {
    id: 'store-market-lane-chelmsford',
    name: 'Market Lane — Chelmsford High Street',
    address: {
      line1: '42 High Street',
      city: 'Chelmsford',
      postalCode: 'CM1 1BE',
      country: 'GB',
      formattedAddress: '42 High Street, Chelmsford CM1 1BE',
    },
    coordinates: { latitude: 51.7356, longitude: 0.4705 },
    distanceMeters: 650,
    status: 'open',
    supportsDelivery: true,
    supportsPickup: true,
    collectionAvailable: true,
    deliveryEta: '15–25 min',
    deliveryPrice: 1.99,
    minOrderAmount: 10.0,
    locationGroup: 'essex-urban',
    channelLinks: ['DIRECT', 'DELIVEROO', 'UBER_EATS'],
    dispatchAvailability: {
      available: true,
      validationId: 'disp_val_ch101',
      deliveryEtaMinutes: 20,
      deliveryPrice: 1.99,
      pickupEtaMinutes: 10,
    },
  },
  {
    id: 'store-market-lane-moulsham',
    name: 'Market Lane — Old Moulsham Grocers',
    address: {
      line1: '88 Moulsham Street',
      city: 'Chelmsford',
      postalCode: 'CM2 0JL',
      country: 'GB',
      formattedAddress: '88 Moulsham Street, Chelmsford CM2 0JL',
    },
    coordinates: { latitude: 51.7289, longitude: 0.4731 },
    distanceMeters: 1200,
    status: 'open',
    supportsDelivery: true,
    supportsPickup: true,
    collectionAvailable: true,
    deliveryEta: '20–30 min',
    deliveryPrice: 2.29,
    minOrderAmount: 12.0,
    locationGroup: 'essex-urban',
    channelLinks: ['DIRECT', 'DELIVEROO'],
    dispatchAvailability: {
      available: true,
      validationId: 'disp_val_ml202',
      deliveryEtaMinutes: 25,
      deliveryPrice: 2.29,
      pickupEtaMinutes: 12,
    },
  },
  {
    id: 'store-market-lane-billericay',
    name: 'Market Lane — Billericay Station Parade',
    address: {
      line1: '14 Station Road',
      city: 'Billericay',
      postalCode: 'CM12 9BE',
      country: 'GB',
      formattedAddress: '14 Station Road, Billericay CM12 9BE',
    },
    coordinates: { latitude: 51.6288, longitude: 0.4186 },
    distanceMeters: 2300,
    status: 'busy',
    supportsDelivery: false, // Delivery temporarily paused due to peak courier demand
    supportsPickup: true,
    collectionAvailable: true,
    deliveryEta: 'Delivery temporarily paused',
    deliveryPrice: 0,
    minOrderAmount: 5.0,
    locationGroup: 'essex-commuter',
    channelLinks: ['DIRECT', 'JUST_EAT'],
    dispatchAvailability: {
      available: false,
      reason: 'No dispatch couriers available in immediate sector. Collection ready in 15 mins.',
      pickupEtaMinutes: 15,
    },
  },
  {
    id: 'store-market-lane-brentwood',
    name: 'Market Lane — Brentwood Crown Street',
    address: {
      line1: '5 Crown Street',
      city: 'Brentwood',
      postalCode: 'CM14 4AZ',
      country: 'GB',
      formattedAddress: '5 Crown Street, Brentwood CM14 4AZ',
    },
    coordinates: { latitude: 51.6198, longitude: 0.3012 },
    distanceMeters: 3800,
    status: 'open',
    supportsDelivery: true,
    supportsPickup: true,
    collectionAvailable: true,
    deliveryEta: '25–35 min',
    deliveryPrice: 2.49,
    minOrderAmount: 12.0,
    locationGroup: 'essex-commuter',
    channelLinks: ['DIRECT', 'DELIVEROO', 'UBER_EATS'],
    dispatchAvailability: {
      available: true,
      validationId: 'disp_val_bw303',
      deliveryEtaMinutes: 30,
      deliveryPrice: 2.49,
      pickupEtaMinutes: 15,
    },
  },
  {
    id: 'store-market-lane-shenfield',
    name: 'Market Lane — Shenfield Broadway',
    address: {
      line1: '92 Hutton Road',
      city: 'Shenfield',
      postalCode: 'CM15 8NB',
      country: 'GB',
      formattedAddress: '92 Hutton Road, Shenfield CM15 8NB',
    },
    coordinates: { latitude: 51.6321, longitude: 0.3298 },
    distanceMeters: 4100,
    status: 'open',
    supportsDelivery: true,
    supportsPickup: true,
    collectionAvailable: true,
    deliveryEta: '20–30 min',
    deliveryPrice: 2.29,
    minOrderAmount: 10.0,
    locationGroup: 'essex-commuter',
    channelLinks: ['DIRECT', 'DELIVEROO'],
    dispatchAvailability: {
      available: true,
      validationId: 'disp_val_sh404',
      deliveryEtaMinutes: 25,
      deliveryPrice: 2.29,
      pickupEtaMinutes: 10,
    },
  },
  {
    id: 'store-market-lane-wickford',
    name: 'Market Lane — Wickford Retail Depot',
    address: {
      line1: 'Unit 3, Southend Road',
      city: 'Wickford',
      postalCode: 'SS11 8HN',
      country: 'GB',
      formattedAddress: 'Unit 3, Southend Road, Wickford SS11 8HN',
    },
    coordinates: { latitude: 51.6112, longitude: 0.5218 },
    distanceMeters: 4900,
    status: 'closed', // Closed for evening replenishment
    supportsDelivery: true,
    supportsPickup: true,
    collectionAvailable: false,
    deliveryEta: 'Opens at 07:00 tomorrow',
    deliveryPrice: 2.99,
    minOrderAmount: 15.0,
    locationGroup: 'essex-east',
    channelLinks: ['DIRECT'],
  },
  {
    id: 'store-market-lane-colchester',
    name: 'Market Lane — Colchester Trinity Street',
    address: {
      line1: '18 Trinity Street',
      city: 'Colchester',
      postalCode: 'CO1 1JN',
      country: 'GB',
      formattedAddress: '18 Trinity Street, Colchester CO1 1JN',
    },
    coordinates: { latitude: 51.8892, longitude: 0.8998 },
    distanceMeters: 6200,
    status: 'open',
    supportsDelivery: true,
    supportsPickup: true,
    collectionAvailable: true,
    deliveryEta: '20–30 min',
    deliveryPrice: 2.49,
    minOrderAmount: 10.0,
    locationGroup: 'essex-north',
    channelLinks: ['DIRECT', 'DELIVEROO', 'UBER_EATS', 'JUST_EAT'],
    dispatchAvailability: {
      available: true,
      validationId: 'disp_val_col505',
      deliveryEtaMinutes: 25,
      deliveryPrice: 2.49,
      pickupEtaMinutes: 10,
    },
  },
  {
    id: 'store-market-lane-maldon',
    name: 'Market Lane — Maldon Quay & Deli',
    address: {
      line1: '74 High Street',
      city: 'Maldon',
      postalCode: 'CM9 5ET',
      country: 'GB',
      formattedAddress: '74 High Street, Maldon CM9 5ET',
    },
    coordinates: { latitude: 51.7314, longitude: 0.6802 },
    distanceMeters: 5500,
    status: 'open',
    supportsDelivery: true,
    supportsPickup: true,
    collectionAvailable: true,
    deliveryEta: '25–35 min',
    deliveryPrice: 2.79,
    minOrderAmount: 15.0,
    locationGroup: 'essex-coastal',
    channelLinks: ['DIRECT', 'DELIVEROO'],
    dispatchAvailability: {
      available: true,
      validationId: 'disp_val_mal606',
      deliveryEtaMinutes: 30,
      deliveryPrice: 2.79,
      pickupEtaMinutes: 15,
    },
  },
];
