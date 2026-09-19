# Domain Model (docs/DOMAIN_MODEL.md)

**Project:** Multi-Tenant White-Label Retail Commerce Platform  
**Status:** Frozen Baseline

---

## 1. Tenancy & Infrastructure Hierarchy

```
Tenant (Brand, e.g. "Market Lane")
  └── DeliverectIntegration (Environment, status, credentials pointer)
        └── AccountLink[] (Deliverect Account ID)
              ├── PhysicalLocation[] (Physical address, coordinates)
              └── CommerceStore[] (channelLinkId, ordering menu context, fulfillment capabilities)
```

### Core Entities

```typescript
export interface Money {
  readonly amount: number; // Integer minor units (e.g. 1000 = £10.00 / 5237 = £52.37)
  readonly currency: string; // ISO 4217 (e.g. "GBP", "EUR", "USD")
}

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
  status: 'UNCONFIGURED' | 'CHECKING' | 'CONNECTED' | 'DEGRADED' | 'ERROR';
  connectionState: 'HEALTHY' | 'DISCONNECTED';
  lastCheckedAt?: string;
  diagnosticMessage?: string;
}

export interface AccountLink {
  accountLinkId: string;
  integrationId: string;
  deliverectAccountId: string;
  status: 'ACTIVE' | 'INACTIVE';
  displayName: string;
}

export interface PhysicalLocation {
  physicalLocationId: string;
  accountLinkId: string;
  deliverectLocationId: string;
  name: string;
  addressProjection: {
    street: string;
    city: string;
    postcode: string;
    country: string;
  };
  coordinates: {
    latitude: number;
    longitude: number;
  };
  statusProjection: 'ACTIVE' | 'INACTIVE';
}

export interface CommerceStore {
  commerceStoreId: string;
  accountLinkId: string;
  physicalLocationId?: string | null;
  channelLinkId: string;
  name: string;
  stateProjection: 'open' | 'closed' | 'busy' | 'paused';
  fulfillmentCapabilitiesProjection: {
    delivery: boolean;
    pickup: boolean;
    scheduling: boolean;
  };
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
```

---

## 2. Catalog & Product Separation

### Root Product (Brand-level, store-agnostic)
```typescript
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
```

### Store Menu Product (Store-specific, authoritative)
```typescript
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
```

---

## 3. Basket & Substitution Models

```typescript
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

export interface Basket {
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
  currency: string;
}
```

---

## 4. Order & Webhook Events

```typescript
export type NormalizedPickingEvent =
  | 'ORDER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'ITEM_PICKED'
  | 'ITEM_QUANTITY_AMENDED'
  | 'ITEM_SUBSTITUTED'
  | 'ITEM_REMOVED'
  | 'PICKING_COMPLETE'
  | 'ORDER_CANCELLED';

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

export interface OrderProjection {
  projectionId: string;
  tenantId: string;
  externalOrderId: string;
  checkoutId: string;
  channelLinkId: string;
  customerUid?: string | null;
  state: 'CHECKOUT_PENDING' | 'CONFIRMED' | 'ACCEPTED' | 'PICKING' | 'READY' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  paymentState: 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED' | 'FAILED';
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
```
