# Deliverect Capability Matrix & Integration Truth Document

> **Document Status**: Production Architectural Handoff for Codex  
> **Source-Code Audit Date**: September 2026  
> **Basis**: Current source-code audit of `/server/deliverect/`, `/server/api/v1Router.ts`, and `/server/basket/` (NOT marketing claims or status logs).
>
> **2026-09-21 correction**: Section 1 point 2, Section 2, Section 3's basket rows, and Section 5 Step 4 below described the storefront basket/checkout path as "delegated to local BasketService". A direct source read of `server/deliverect/DeliverectApiClient.ts` on this date found **zero references to `BasketService`/`defaultBasketService`** anywhere in that file — `createBasket`, `getBasket`, `updateBasketItem(s)`, `updateBasketCustomer`, `updateBasketStore`, `validateBasket`, `reconcileBasket`, and `checkout` all call `getCommerceBasketApi()`, i.e. the real `DeliverectCommerceBasketApiClient` described in Section 2. "Step 4" below was already completed at some point after this doc was written and nobody updated it. `server/basket/BasketService.ts` is therefore genuinely dead code (confirmed unused outside its own dedicated test). This correction is **code-verified, not staging-verified** — the live HTTP round-trip against `api.staging.deliverect.com` still needs independent re-confirmation once credentials are available (tracked in `docs/DELIVERECT_VERIFICATION.md`).

---

## 1. Executive Summary & Source-Code Truth

A thorough audit of the Bwydi codebase reveals the exact transactional boundaries between Deliverect live APIs, Bwydi's BFF (Backend-For-Frontend), and local in-memory fallback services:

### 🚨 Core Architectural Source-Code Truth
1. **Discovery & Catalogue (Deliverect-Authoritative)**:  
   - Store discovery, physical location correlation, store status, opening hours, menus, menuType filtering (`delivery`/`pickup`), product tags/allergens, snooze evaluation, and store/root catalogue fetching are **fully implemented and live** via `DeliverectApiClient.ts`, `CommerceDiscoveryService.ts`, and `LinkedAccountsAdapter.ts`.

2. **Storefront Baskets & Checkout (Wired to real Deliverect Commerce Basket API)**:  
   - In `server/deliverect/DeliverectApiClient.ts`, all storefront basket and checkout methods (`createBasket`, `getBasket`, `updateBasketItem`, `updateBasketItems`, `updateBasketCustomer`, `updateBasketStore`, `validateBasket`, `reconcileBasket`, `checkout`, `getOrder`) call `getCommerceBasketApi()` — the real `DeliverectCommerceBasketApiClient` (Section 2) — for **pickup/Collection**. `getBasket` explicitly rejects any legacy local `bsk_`-prefixed ID rather than resolving it.
   - `updateBasketFulfillment` and delivery basket creation/checkout are the genuine remaining gaps: both throw `501 INTEGRATION_CAPABILITY_NOT_IMPLEMENTED` rather than calling a real endpoint. Delivery is out of scope until Dispatch work lands (see `docs/NORTH_STAR.md` §11).
   - The legacy synchronous `checkoutBasket()` method (superseded by the async `checkout()`) intentionally throws `unsupportedLiveCapability` — this is correct fail-closed behavior for a deprecated method, not a real gap.
   - `server/basket/BasketService.ts` (local in-memory basket engine) is **dead code**: nothing in `DeliverectApiClient.ts`, `MockDeliverectAdapter.ts`, or `server/api/v1Router.ts` imports it; only its own dedicated test file does.
   - **Conclusion**: The customer-facing storefront IS Deliverect-authoritative transactionally for standard Collection/pickup carts, at the code level. Live re-verification against staging is still needed (Section 1's correction note above).

3. **Raw Deliverect Commerce Basket API (`DeliverectCommerceBasketApi.ts`)**:  
   - A standalone, narrow, raw-contract API client (`server/deliverect/DeliverectCommerceBasketApi.ts`) is implemented specifically for staging verification and pickup test orders.
   - It executes real raw HTTP calls to `POST /commerce/{accountId}/baskets`, `PATCH .../baskets/{basketId}/items`, `POST .../baskets/{basketId}/reconcile`, and `POST /commerce/{accountId}/v2/checkouts`.
   - **Status**: Scaffolding and standalone test runner exist, but this client is **not yet wired into `DeliverectApiClient`** for standard customer storefront sessions.

4. **Staging Verification Status**:  
   - **No capabilities are marked as "Staging Verified"**. Scaffolding, mock adapters, and Vitest test passes (e.g. `npx vitest run`) do **NOT** constitute staging verification. Staging verification strictly requires execution against live Deliverect staging endpoints (`https://api.staging.deliverect.com`) using valid staging OAuth credentials (`DELIVERECT_CLIENT_ID` / `DELIVERECT_CLIENT_SECRET`).

---

## 2. Pilot Collection Order Gate

Before enabling live customer transactions, Bwydi must pass the **Pilot Collection Order Gate** using the raw `DeliverectCommerceBasketApi` client and live staging credentials.

```
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  1. OAuth Token        │ ───> │  2. Pickup Store       │ ───> │  3. Pickup Menu        │
│  POST /oauth/token     │      │  GET /commerce/stores  │      │  GET /commerce/menus   │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
                                                                            │
                                                                            ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  6. Reconcile Basket   │ <─── │  5. PATCH Real Items   │ <─── │  4. POST Real Basket   │
│  POST .../reconcile    │      │  PATCH .../items       │      │  POST .../baskets      │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
            │
            ▼
┌────────────────────────┐      ┌────────────────────────┐
│  7. Unpaid Checkout    │ ───> │  8. Async Confirmation │
│  POST .../v2/checkouts │      │  Inbound Webhook 200   │
└────────────────────────┘      └────────────────────────┘
```

### Gate Execution Checklist:
- [ ] **Step 1 (OAuth)**: Issue OAuth token request via `OAuthTokenManager` (`POST /oauth/token`).
- [ ] **Step 2 (Pickup Store)**: Retrieve active store channel link (`channelLinkId`) configured for pickup.
- [ ] **Step 3 (Pickup-Compatible Menu)**: Fetch store catalog and isolate a menu with `menuType: 'pickup'` (or supported pickup fulfillment).
- [ ] **Step 4 (POST Real Basket)**: Create a live basket record on Deliverect (`POST /commerce/{accountId}/baskets`).
- [ ] **Step 5 (PATCH Real Items)**: Replace basket items using authentic menu PLU and quantity (`PATCH /commerce/{accountId}/baskets/{basketId}/items`). Note: Deliverect `PATCH /items` replaces the entire item array.
- [ ] **Step 6 (Reconcile Basket)**: Validate prices and availability against the live store menu (`POST /commerce/{accountId}/baskets/{basketId}/reconcile`).
- [ ] **Step 7 (Unpaid Third-Party Checkout)**: Submit checkout with `payment: { type: 'third_party', isPrepaid: false }` to `POST /commerce/{accountId}/v2/checkouts`.
- [ ] **Step 8 (Async Order Confirmation)**: Receive HTTP 200/201 response confirming checkout acceptance, followed by asynchronous webhook confirmation of order placement.

> *This full sequence is implemented in `DeliverectCommerceBasketApi.placePickupTestOrder()` and exposed via Step 5 of the Admin Integrations screen.*

---

## 3. Deliverect Capability Matrix

| Capability | Official Deliverect API / Scope | Implemented in Bwydi | Actually Live / Authoritative | Staging Verified | External Blocker | Next Code Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **OAuth Token Management** | `POST /oauth/token`<br>`grant_type=client_credentials` | Yes (`OAuthTokenManager.ts`) | Yes (Server-side singleton with token caching & stampede prevention) | **NO** | Staging `DELIVERECT_CLIENT_ID` and `DELIVERECT_CLIENT_SECRET` | Test token acquisition against `https://api.staging.deliverect.com/oauth/token` once credentials arrive. |
| **Linked Accounts** | `GET /accounts` | Yes (`LinkedAccountsAdapter.ts`) | Yes (HTTP client mapping Deliverect account IDs to Bwydi integrations) | **NO** | Staging OAuth credentials | Execute `getLinkedAccounts()` with live token to discover staging account IDs. |
| **Physical Locations** | `GET /locations` | Yes (`LinkedAccountsAdapter.ts`) | Yes (Correlates physical locations with `channelLinkId` without guessing IDs) | **NO** | Staging OAuth credentials | Test location correlation against staging account response. |
| **Commerce Stores** | `GET /commerce/{accountId}/stores` or `GET /stores` | Yes (`CommerceDiscoveryService.ts`, `LinkedAccountsAdapter.ts`) | Yes (Live store discovery with coordinate distance ranking) | **NO** | Staging OAuth credentials | Run store discovery against staging linked accounts. |
| **Store Status** | Operational state in store metadata (`open`, `closed`, `busy`, `paused`) | Yes (`CommerceDiscoveryService.ts`, `DeliverectApiClient.ts`) | Yes (Mapped into Bwydi `StoreStatus` domain model) | **NO** | Staging store setup | Validate store status mapping against staging store state. |
| **Opening Hours** | Weekly operational schedule array in store payload | Yes (`CommerceDiscoveryService.ts`) | Yes (Parsed and exposed in store details) | **NO** | Staging store setup | Test opening hours parsing against live staging store schedule. |
| **Menus** | `GET /commerce/{accountId}/menus` | Yes (`CommerceDiscoveryService.ts`, `DeliverectApiClient.ts`) | Yes (Retrieves store menus and categories) | **NO** | Staging store menu setup | Fetch live staging menus and verify category hierarchy parsing. |
| **MenuType** | Menu metadata (`menuType: 'delivery'`, `'pickup'`, etc.) | Yes (`CommerceDiscoveryService.ts`) | Yes (Filters menus by requested fulfillment type) | **NO** | Staging menu configuration | Verify pickup vs. delivery menu filtering with staging store menus. |
| **Product Tags & Allergens** | Product tag array (`vegan`, `gluten_free`, allergen identifiers) | Yes (`src/commerce/models.ts`, `DeliverectApiClient.ts`) | Yes (Normalizes tags and dietary preferences across products) | **NO** | Staging menu catalog | Validate dietary filter matching against staging catalog payloads. |
| **Snooze Status** | `snoozed`, `isSnoozed`, `snoozedUntil`, or `snoozedPayload` list/map | Yes (`evaluateDeliverectSnooze` in `DeliverectApiClient.ts`) | Yes (Handles boolean, timestamp, array, and object payload structures) | **NO** | Live snooze events in staging | Test product snooze evaluation against staging snooze webhook/payload. |
| **Root Catalogue** | Aggregated brand catalogue or multi-store root menu | Yes (`DeliverectApiClient.getRootCatalog()`) | Yes (Aggregates items from candidate store menus) | **NO** | Staging menu catalog | Test root catalogue building across multiple staging stores. |
| **Store Catalogue** | `GET /commerce/{accountId}/menus` / store menu details | Yes (`DeliverectApiClient.getStoreCatalog()`) | Yes (Parses products, prices, bundles, modifiers, and category trees) | **NO** | Staging menu catalog | Validate nested modifier and bundle stock evaluation against staging catalog. |
| **Basket Create / Get (Storefront)** | `POST /commerce/{accountId}/baskets`<br>`GET .../baskets/{id}` | Wired (`DeliverectApiClient.ts` -> `getCommerceBasketApi()`) | Yes, pickup only (delivery throws `INVALID_FULFILLMENT`; rejects legacy `bsk_...` IDs) | **NO** | Staging OAuth credentials | Live re-verify `createBasket`/`getBasket` against staging (Section 1 correction note). |
| **Basket Create / Get (Raw Client)** | `POST /commerce/{accountId}/baskets`<br>`GET .../baskets/{id}` | Yes (`DeliverectCommerceBasketApi.ts`) | Yes (Raw HTTP client for staging verification) | **NO** | Staging OAuth credentials | Execute `createBasket` against staging Deliverect Commerce API. |
| **Basket Items Update (Storefront)** | `PATCH /commerce/{accountId}/baskets/{id}/items` | Wired (`DeliverectApiClient.updateBasketItem(s)` -> `getCommerceBasketApi()`) | Yes (full item-array replace, matching the documented `PATCH` semantics) | **NO** | Staging OAuth credentials & valid store PLUs | Live re-verify item replacement against staging (Section 1 correction note). |
| **Basket Items Replacement (Raw Client)** | `PATCH /commerce/{accountId}/baskets/{id}/items` | Yes (`DeliverectCommerceBasketApi.ts`) | Yes (Raw HTTP client replacing complete item array) | **NO** | Staging OAuth credentials & valid store PLUs | Test item list replacement with valid staging menu PLU. |
| **Basket Customer & Store** | Customer details and store-switch payload | Wired (`DeliverectApiClient.updateBasketCustomer` / `updateBasketStore` -> `getCommerceBasketApi()`) | Yes | **NO** | Staging OAuth credentials | Live re-verify against staging (Section 1 correction note). |
| **Basket Fulfillment Change** | Change delivery/pickup on an existing basket | Not implemented | **NO** — `updateBasketFulfillment` throws `501 INTEGRATION_CAPABILITY_NOT_IMPLEMENTED` | **NO** | Deferred to Delivery phase (`docs/NORTH_STAR.md` §11) | Out of scope until Dispatch/Delivery work begins; not a Collection blocker. |
| **Basket Reconciliation** | `POST /commerce/{accountId}/baskets/{id}/reconcile` | Wired (`DeliverectApiClient.reconcileBasket` -> `getCommerceBasketApi()`) | Yes | **NO** | Staging OAuth credentials | Reconcile live staging basket against store menu prices. |
| **Checkout (Storefront)** | `POST /commerce/{accountId}/v2/checkouts` | Wired (`DeliverectApiClient.checkout` -> `getCommerceBasketApi()`), pickup only | Yes for pickup; delivery not implemented | **NO** | Staging OAuth credentials | Live re-verify async checkout against staging (Section 1 correction note). |
| **Unpaid Pickup Checkout (Raw Client)** | `POST /commerce/{accountId}/v2/checkouts` (`third_party`, `isPrepaid: false`) | Yes (`DeliverectCommerceBasketApi.ts`) | Yes (Raw HTTP client submitting unpaid pickup order) | **NO** | Staging OAuth credentials | Execute Step 5 "Place Pickup Test Order" in Admin Integrations UI when credentials arrive. |
| **Checkout Status & Order Tracking** | `GET /commerce/{accountId}/v2/checkouts/{id}` / Webhook updates | Yes (`WebhookService.ts`, BFF router) | Yes (Inbound webhook handler updates order projections) | **NO** | Live webhook events from staging | Test order projection updates upon receiving staging checkout webhooks. |
| **DPay (Deliverect Pay)** | DPay tokenisation, `POST /payments/request`, manual capture, refund | Scaffolding (`DeliverectDPayAdapter.ts`, `PaymentService.ts`) | **NO** (Default uses `DemoPaymentAdapter.ts`) | **NO** | DPay gateway profile & Basis Theory tokenization proxy endpoint in staging | Confirm DPay tokenization proxy URL and test payment token request in staging. |
| **Dispatch** | `POST /fulfillment/validate` (Courier serviceability & quotes) | Yes (`DeliverectDispatchAdapter.ts`, `DispatchOrchestrationService.ts`) | Yes (Adapter sends HTTP serviceability requests) | **NO** | Dispatch account setup in Deliverect | Test `/fulfillment/validate` against staging Dispatch configuration. |
| **Retail Inventory** | Stock quantity & stock status fields in menu payloads | Yes (`DeliverectApiClient.ts`, `CommerceDiscoveryService.ts`) | Yes (Parses `IN_STOCK`, `OUT_OF_STOCK`, `stockQuantity`) | **NO** | Staging Retail stock enablement | Test inventory depletion and out-of-stock handling with staging Retail feed. |
| **Busy Mode** | Store operational pause / prep time adjustments | Yes (`CommerceDiscoveryService.ts`) | Yes (Mapped in store discovery state) | **NO** | Staging store portal control | Verify store discovery filtering when staging store is set to busy/paused. |
| **Quest / Picking Amendments** | Inbound webhooks for picking start, amendments, substitutions, completion | Yes (`WebhookService.ts`, `SubstitutionCallbackService.ts`) | Yes (Normalizes events and enforces substitution policy rules) | **NO** | Quest picking app / location setup in staging | Process live Quest picking webhook in staging and verify customer order tracking update. |
| **Webhook HMAC Verification** | HMAC SHA-256 header validation (`x-deliverect-signature`) | Yes (`WebhookService.ts`) | Yes (Constant-time `timingSafeEqual` comparison enforced on webhook endpoint) | **NO** | Staging webhook secret | Register staging webhook URL in Deliverect portal and verify HMAC signature check. |

---

## 4. Key Deliverect Integration Files & Responsibilities

| File Path | Role & Current Operational Status |
| :--- | :--- |
| `server/deliverect/OAuthTokenManager.ts` | **Server-side OAuth Token Manager**. Obtains, caches, and refreshes OAuth tokens for staging/production environments with stampede protection. |
| `server/deliverect/LinkedAccountsAdapter.ts` | **Accounts & Locations Adapter**. Calls `GET /accounts` and `GET /locations`, correlating physical locations with `channelLinkId` strings. |
| `server/deliverect/CommerceDiscoveryService.ts` | **Store & Menu Discovery Engine**. Handles location-based store search, status mapping, menu fetching, and catalog normalization. |
| `server/deliverect/DeliverectApiClient.ts` | **Primary Adapter Implementation**. Implements `DeliverectAdapter`. Uses live APIs for discovery/catalogues, and its basket/checkout methods call the real `DeliverectCommerceBasketApiClient` (pickup only; delivery not yet implemented). |
| `server/deliverect/DeliverectCommerceBasketApi.ts` | **Real Commerce Basket Client**. Implements exact, narrow HTTP calls for baskets, item replacement, reconciliation, and unpaid pickup checkouts (`placePickupTestOrder`). Used both by the storefront path (via `DeliverectApiClient.getCommerceBasketApi()`) and by the Admin "Place Pickup Test Order" staging verification tool. |
| `server/deliverect/WebhookService.ts` | **Inbound Webhook Processor**. Enforces HMAC SHA-256 verification, deduplication, and order projection updates for checkout and Quest picking events. |
| `server/deliverect/DeliverectDPayAdapter.ts` | **Deliverect Pay Adapter Scaffolding**. Implements `DPayAdapter` interface for payment requests, manual capture, and refunds. |
| `server/deliverect/DeliverectDispatchAdapter.ts` | **Deliverect Dispatch Adapter**. Implements `DispatchAdapter` interface for courier serviceability validation (`/fulfillment/validate`). |
| `server/basket/BasketService.ts` | **Dead code.** Local in-memory basket engine, generates local `bsk_...`/`ord_...` IDs. No longer referenced by `DeliverectApiClient`, `MockDeliverectAdapter`, or the router — only its own dedicated test imports it. Slated for removal. |
| `server/api/v1Router.ts` | **BFF Router**. Exposes public storefront and admin API endpoints, enforces authentication/RBAC, and routes requests to active adapters. |

---

## 5. Handoff Instructions & Next Code Actions for Codex

When Deliverect staging credentials (`DELIVERECT_CLIENT_ID` and `DELIVERECT_CLIENT_SECRET`) arrive, follow this exact sequence:

1. **Step 1: Configure Credentials in Admin UI**:
   - Navigate to **Admin -> Integrations** in the web interface.
   - Input `DELIVERECT_CLIENT_ID` and `DELIVERECT_CLIENT_SECRET` for Staging environment.
   - Click **Test Connection** to execute live OAuth token acquisition and account discovery (`POST /oauth/token` -> `GET /accounts` -> `GET /locations`).

2. **Step 2: Complete Staging Account & Store Selection**:
   - Select the target Deliverect Account ID and channel link(s).
   - Save configuration (verifying that fail-closed validation passes).

3. **Step 3: Execute Pilot Collection Order Gate**:
   - In **Admin -> Integrations -> Step 5 ("Place Pickup Test Order")**:
   - Select the configured channel link.
   - Click **Run Pickup Test Order**.
   - Verify that the raw client (`DeliverectCommerceBasketApi`) successfully executes all 8 gate steps (OAuth -> Pickup Store -> Pickup Menu -> Create Basket -> Patch Items -> Reconcile -> Unpaid Checkout -> Async Order Confirmation).

4. **Step 4: Wire Storefront `DeliverectApiClient` to `DeliverectCommerceBasketApi`** — ✅ **Already done** (confirmed by source read on 2026-09-21; see the correction note in Section 1). `createBasket`, `getBasket`, `updateBasketItem(s)`, `updateBasketCustomer`, `updateBasketStore`, `validateBasket`, `reconcileBasket`, and `checkout` all call `getCommerceBasketApi()`. Remaining work here is *live re-verification* against staging, not new wiring — and removing the now-dead `server/basket/BasketService.ts`.

5. **Step 5: Register Staging Webhooks**:
   - Register Bwydi's webhook URL (`https://<domain>/api/v1/webhooks/deliverect`) in the Deliverect staging portal.
   - Set `DELIVERECT_WEBHOOK_SECRET` in Secret Manager / environment variables.
   - Test live HMAC verification and Quest picking status updates.
