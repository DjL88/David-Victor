# System Architecture (docs/ARCHITECTURE.md)

**Project:** Multi-Tenant White-Label Retail Commerce Platform  
**Target Platform:** Google Cloud Run + Firebase (Auth, Firestore, Cloud Storage) + Deliverect Commerce Backbone

---

## 1. System Topology

```
                  +--------------------------------+
                  | Customer / Admin React 19 SPA  |
                  +--------------------------------+
                                  |
                                  | HTTPS (Vite PWA)
                                  | Firebase Auth ID Token (Admin / Customer)
                                  v
                  +--------------------------------+
                  |         Cloud Run BFF          |
                  |     (Node / Express on 3000)   |
                  +--------------------------------+
                                  |
            +---------------------+---------------------+
            |                                           |
            v                                           v
+-----------------------+                   +-----------------------+
|   Platform Services   |                   | Deliverect Integration|
|  - Tenant Resolution  |                   |  - OAuth Token Manager|
|  - Domain Provider    |                   |  - Commerce Adapter   |
|  - Asset Service      |                   |  - Dispatch Adapter   |
|  - Search Merch / CMS |                   |  - DPay Adapter       |
|  - Policy Engine      |                   |  - Quest Normalizer   |
+-----------------------+                   +-----------------------+
            |                                           |
    +-------+-------+                                   |
    |       |       |                                   v
    v       v       v                           Deliverect APIs
Firestore Storage Firebase Auth          (Staging: api.staging.deliverect.com)
(Config/  (Assets)(ID Token Verify)      (Prod: api.deliverect.com)
 Projections)
```

### Inbound Webhook Pipeline
```
Deliverect Inbound Webhooks (Checkout / Picking / Payments)
            |
            | HTTPS POST (with x-server-authorization-hmac-sha256)
            v
Cloud Run BFF (/integrations/deliverect/webhooks/*)
  1. Capture raw request bytes
  2. Constant-time HMAC SHA-256 verification against environment secret
  3. Deduplicate against webhookEvents journal
  4. Normalize to domain events:
     - ORDER_ACCEPTED
     - PICKING_STARTED
     - ITEM_PICKED
     - ITEM_QUANTITY_AMENDED
     - ITEM_SUBSTITUTED
     - ITEM_REMOVED
     - PICKING_COMPLETE
     - ORDER_CANCELLED
  5. Apply idempotent mutation to orderProjections in Firestore
```

---

## 2. Core Architectural Invariants

### 2.1 Deliverect is Authoritative for Commerce
- Deliverect owns:
  - Stores and store availability (open/closed/busy/paused)
  - Store Menus, store-specific prices, and stock/range
  - Basket state and recalculation/reconciliation
  - Checkout execution and payment state
  - Picking operations (Quest) and courier dispatch serviceability (Dispatch)
- Our Platform owns:
  - Tenants, domains, and branding
  - Stories and merchandising overlays
  - Search synonyms and boosted rules
  - Compliance and country fee policies
  - Admin users and tenant RBAC
  - Immutable webhook event journal and customer order projections

### 2.2 The Browser Must Never Call Deliverect Directly
- No client-side exposure of `DELIVERECT_CLIENT_SECRET`, bearer tokens, or webhook secrets.
- Browser interacts strictly through our Cloud Run BFF (`/api/v1/*`).
- Client-side payment tokenization routes raw PAN/CVC directly to the approved token proxy (e.g. Basis Theory proxy), never through our BFF or application logs.

### 2.3 Single-Store Basket & Revalidation
- Each basket is bound to a single store context (`tenantId`, `channelLinkId`, `menuId`, `fulfillmentType`).
- No multi-store basket splitting.
- When switching stores:
  - Explicit customer prompt.
  - Line items revalidated against target store menu.
  - Any dropped or repriced items clearly communicated.
  - Fresh authoritative basket reconciliation performed.

### 2.4 Store Discovery & Dispatch Policy
- Customer location (lat/lng) resolves nearest Deliverect Commerce stores.
- Candidate stores queried with `sort=distance`.
- For delivery candidates, Dispatch availability (`POST /fulfillment/validate`) is evaluated with controlled concurrency (default: 4).
- Up to 10 stores displayed: delivery-serviceable stores ranked by Commerce distance, supplemented by collection-capable stores within 20,000m.
- Revalidation before checkout: Dispatch validation refreshed to prevent stale dispatch tokens.

### 2.5 Payment Authorization Ceiling (No Arbitrary Buffers)
- Arbitrary percentage buffers (`basket * 1.10` or `1.15`) are strictly forbidden.
- Authorised maximum is calculated as:
  ```
  authorizationMaximum = reconciledBasketTotal
                       + explicitly_approved_substitute_uplifts
                       + explicitly_configured_catch_weight_allowance
                       + approved_charges
  ```
- All monetary components are tracked as integer minor units (`Money { amount, currency }`).

---

## 3. Runtime Modes

1. **UNKNOWN** (Initial bootstrap state):
   - Mocks forbidden. Requests wait for authoritative environment resolution.
2. **DEMO**:
   - Explicitly configured for local sandbox / visual showcase.
   - Mock adapters and deterministic mock data permitted, clearly identified.
3. **STAGING**:
   - Zero mock fallback.
   - Uses `api.staging.deliverect.com`.
   - If credentials missing or unconfigured, returns typed `503 INTEGRATION_NOT_CONFIGURED`.
   - Genuine zero-store or unserviceable results are rendered honestly.
4. **PRODUCTION**:
   - Zero mock fallback. Mock code is unreachable.
   - Uses `api.deliverect.com`.
