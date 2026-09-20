import { Money } from './money';
export type { Money } from './money';
export { createMoney, fromMajorUnits, toMajorUnits, addMoney, subtractMoney, compareMoney, formatMoney } from './money';

// ==========================================
// 1. TENANCY & INFRASTRUCTURE
// ==========================================

export interface Tenant {
  tenantId: string;
  slug: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING';
  defaultCurrency: string;
  defaultLocale: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export interface Domain {
  domainId: string;
  tenantId: string;
  hostname: string;
  status: 'PENDING' | 'VERIFYING' | 'ACTIVE' | 'FAILED' | 'DISABLED';
  verificationMethod: 'PLATFORM_WILDCARD' | 'DNS_TXT' | 'CNAME';
  createdAt: string;
}

export interface DeliverectIntegration {
  integrationId: string;
  tenantId: string;
  environment: 'staging' | 'production';
  status: 'UNCONFIGURED' | 'CHECKING' | 'OAUTH_VERIFIED' | 'ACCOUNT_MAPPED' | 'COMMERCE_VERIFIED' | 'CONNECTED' | 'DEGRADED' | 'ERROR';
  connectionState: 'HEALTHY' | 'DISCONNECTED';
  lastCheckedAt?: string;
  diagnosticMessage?: string;
}

export interface AccountLink {
  accountLinkId: string;
  integrationId: string;
  deliverectAccountId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  displayName: string;
}

export interface PhysicalLocation {
  physicalLocationId: string;
  accountLinkId: string;
  deliverectLocationId: string;
  name: string;
  addressProjection?: {
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  statusProjection: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  brandStoreId?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  openingHours?: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  services?: Array<{ id: string; name: string; channel?: string | number; url?: string; source: 'DELIVERECT' | 'MANUAL' }>;
}

export interface CommerceStore {
  commerceStoreId: string;
  accountLinkId: string;
  physicalLocationId?: string | null;
  channelLocationId?: string;
  channelLinkId: string;
  name: string;
  stateProjection: 'open' | 'closed' | 'busy' | 'paused' | 'UNKNOWN';
  fulfillmentCapabilitiesProjection?: {
    delivery: boolean;
    pickup: boolean;
    scheduling: boolean;
  };
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  address?: {
    street?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  deliveryRadiusKm?: number;
  deliveryEta?: string;
  openingHours?: any;
  brandStoreId?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  services?: Array<{ id: string; name: string; channel?: string | number; url?: string; source: 'DELIVERECT' | 'MANUAL' }>;
  currency?: string;
  status?: string;
  lastSeenAt: string;
}

export interface TenantMembership {
  membershipId: string;
  uid: string;
  tenantId: string;
  role: 'PLATFORM_SUPER_ADMIN' | 'TENANT_ADMIN' | 'STORE_MANAGER' | 'CUSTOMER_SUPPORT' | 'ANALYST';
  status: 'ACTIVE' | 'INVITED' | 'REVOKED';
  createdAt: string;
}

// ==========================================
// 2. ROOT CATALOGUE VS STORE MENU
// ==========================================

export interface RootProduct {
  productIdentityId: string;
  canonicalPlu?: string;
  name: string;
  description?: string;
  brand?: string;
  categoryIds: string[];
  images: string[];
  tags: string[];
}

export interface StoreMenuProduct {
  channelLinkId: string;
  menuId: string;
  plu: string;
  active: boolean;
  price: Money;
  originalPrice?: Money;
  stockStatus?: 'IN_STOCK' | 'OUT_OF_STOCK';
  stockQuantity?: number | null;
}

// ==========================================
// 3. SUBSTITUTION & BASKET
// ==========================================

export type SubstitutionPreference =
  | {
      type: 'BEST_MATCH';
      pricePolicy: 'LOWER_OF_ORIGINAL_OR_SUBSTITUTE';
    }
  | {
      type: 'CUSTOMER_SELECTED';
      candidates: Array<{
        productIdentityId?: string;
        menuId?: string;
        plu: string;
        approvedPrice?: Money;
      }>;
    }
  | {
      type: 'REMOVE_IF_UNAVAILABLE';
    }
  | {
      type: 'CANCEL_ORDER_IF_UNAVAILABLE';
    };

export interface BasketLineItem {
  lineId: string;
  menuId: string;
  plu: string;
  productIdentityId: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  totalPrice: Money;
  substitutionPreference: SubstitutionPreference;
}

export interface DomainBasket {
  basketId: string;
  tenantId: string;
  channelLinkId: string;
  menuId: string;
  fulfillmentType: 'delivery' | 'pickup';
  items: BasketLineItem[];
  subtotal: Money;
  deliveryFee: Money;
  serviceCharge: Money;
  bagFee: Money;
  depositFee: Money;
  tip: Money;
  total: Money;
}

// ==========================================
// 4. ORDERS & WEBHOOK EVENTS
// ==========================================

export type NormalizedPickingEvent =
  | 'ORDER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'ITEM_PICKED'
  | 'ITEM_QUANTITY_AMENDED'
  | 'ITEM_SUBSTITUTED'
  | 'ITEM_REMOVED'
  | 'PICKING_COMPLETE'
  | 'ORDER_CANCELLED';

export type CheckoutStatus =
  | 'CHECKOUT_SUBMITTING'
  | 'CHECKOUT_PENDING_CONFIRMATION'
  | 'ORDER_CONFIRMED'
  | 'STORE_ACCEPTED'
  | 'PICKING'
  | 'READY'
  | 'DISPATCHING'
  | 'DELIVERED'
  | 'ORDER_FAILED'
  | 'CANCELLED';

export interface CheckoutResult {
  checkoutId: string;
  channelOrderReference: string;
  orderId?: string;
  tenantId: string;
  storeId: string;
  channelLinkId?: string;
  status: CheckoutStatus;
  basketId: string;
  fulfillmentType: 'delivery' | 'pickup';
  total: Money;
  paymentId?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  dispatchValidationId?: string;
  order?: any;
  failureReason?: string;
}

export interface WebhookEvent {
  webhookEventId: string;
  provider: 'deliverect';
  environment: 'staging' | 'production';
  tenantId?: string;
  externalEventKey: string;
  receivedAt: string;
  verified: boolean;
  eventType: NormalizedPickingEvent | string;
  processingStatus: 'PENDING' | 'PROCESSED' | 'FAILED';
  processedAt?: string;
  errorCode?: string;
}

export interface DomainOrderProjection {
  projectionId: string;
  tenantId: string;
  externalOrderId: string;
  checkoutId: string;
  channelLinkId: string;
  customerUid?: string | null;
  state: 'CHECKOUT_PENDING' | 'CONFIRMED' | 'ACCEPTED' | 'PICKING' | 'READY' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  paymentState: 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
  paymentId?: string;
  fulfillmentType: 'delivery' | 'pickup';
  items: BasketLineItem[];
  pricing: {
    subtotal: Money;
    fees: Money;
    finalTotal: Money;
    authorizedMaximum: Money;
  };
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 5. DPAY & PAYMENTS
// ==========================================

export type DPayPaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'partially_captured'
  | 'canceled'
  | 'failed'
  | 'refunded';

export interface PaymentGatewayProfile {
  id: string;
  name: string;
  supportedMethods: string[];
  isDefault: boolean;
}

export interface DPayMode {
  type: 'token' | 'card' | 'hosted';
  tokenId?: string;
}

export interface DPayPayer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface DPayPaymentRequest {
  channelLinkId: string;
  gatewayProfileId?: string;
  mode: DPayMode;
  captureMode: 'manual' | 'automatic';
  amount: number; // in integer minor units (pence/cents)
  currency: string; // ISO-4217
  payer?: DPayPayer;
  orderReference?: string;
  basketId?: string;
  customerApprovedMaxAmount?: Money;
  metadata?: Record<string, any>;
}

export interface DPayPaymentResponse {
  paymentId: string;
  channelLinkId: string;
  status: DPayPaymentStatus;
  amount: number; // integer minor units
  authorizedAmount: number; // integer minor units
  capturedAmount: number; // integer minor units
  currency: string;
  captureMode: 'manual' | 'automatic';
  residualHoldAmount?: number; // integer minor units
  orderReference?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DomainPaymentProjection {
  paymentId: string;
  tenantId: string;
  channelLinkId: string;
  status: DPayPaymentStatus;
  amount: Money;
  authorizedAmount: Money;
  capturedAmount: Money;
  captureMode: 'manual' | 'automatic';
  currency: string;
  residualHoldAmount?: Money;
  reauthorizationCount?: number;
  orderReference?: string;
  checkoutId?: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 6. FINAL PAYMENT SETTLEMENT (Phase 13)
// ==========================================

export type SettlementStatus =
  | 'SETTLED'
  | 'PAYMENT_ACTION_REQUIRED'
  | 'CAPTURE_FAILED'
  | 'VOIDED'
  | 'REFUNDED';

export interface SettlementResult {
  status: SettlementStatus;
  orderId: string;
  paymentId: string;
  finalAmount: number; // integer minor units
  authorizedAmount: number; // integer minor units
  capturedAmount?: number; // integer minor units
  residualHoldReleased?: number; // integer minor units
  excessAmount?: number; // integer minor units when final > auth
  requiresReauthorization?: boolean;
  error?: string;
  errorMessage?: string;
  reason?: string;
  settledAt: string;
}

// ==========================================
// 7. NOTIFICATIONS & SUBSCRIPTIONS (Phase 14)
// ==========================================

export type NotificationType =
  | 'ORDER_CONFIRMED'
  | 'PICKING_STARTED'
  | 'ITEMS_AMENDED'
  | 'SUBSTITUTION_PROPOSED'
  | 'PICKING_COMPLETE'
  | 'OUT_FOR_DELIVERY'
  | 'READY_FOR_COLLECTION'
  | 'ORDER_DELIVERED'
  | 'ORDER_COLLECTED'
  | 'ORDER_CANCELLED'
  | 'PAYMENT_SETTLED';

export interface DomainNotification {
  notificationId: string;
  tenantId: string;
  orderId?: string;
  recipientUid?: string;
  recipientSessionId?: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, string | number | boolean>;
  read: boolean;
  createdAt: string;
}

export interface NotificationSubscription {
  subscriptionId: string;
  tenantId: string;
  customerUid?: string;
  sessionId?: string;
  endpoint: string; // PWA Web Push endpoint or device token
  keys?: {
    p256dh: string;
    auth: string;
  };
  channel: 'WEB_PUSH' | 'IN_APP';
  createdAt: string;
  updatedAt: string;
}

