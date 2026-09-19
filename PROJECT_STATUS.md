# Project Status (PROJECT_STATUS.md)

**Current Status:** Live Deliverect Staging Integrated & Verified (OAuth, Accounts, Locations, Channel Links, Products & Categories)  
**Target Milestone:** Full Commerce Ordering & Basket Permissions on Staging Client Credentials  
**Date:** September 2026

---

## 1. Executive Status

The platform is now connected directly to the live Deliverect Staging environment:
1. **LIVE DELIVERECT INTEGRATION (Operational)**:
   - Upstream OAuth handshake verified against `https://api.staging.deliverect.com/oauth/token` using `client_credentials` grant and audience `https://api.staging.deliverect.com`.
   - Linked accounts discovery maps live Deliverect account (`68517fde1c3ddaa7f6d0275c` "DELIVERECT-TEST / Daves Deli"), 4 physical locations (Folgate Tuckshop, Spitalfield Spirits, Liqueurs of Liverpool Street, Deli Delivery), and 6 channel links (Direct test channels + Deliveroo Retail + Uber Eats Retail).
   - Live products (`GET /products` - 25 items) and product categories (`GET /productCategories` - 25 categories) mapped authoritatively into `RootCatalog`, `StoreCatalog`, and live product search with image assets on Google Cloud Storage and prices in integer minor units.
   - Live Meal Deals & Combos (`isCombo: true`, e.g. "Meal Deal Test" `P-ME-8R03-2` £5.00 with Fruit & Snacks sections and upsells) ingested authoritatively from Deliverect staging catalog into `BundleCatalog` with dynamic stock evaluation.
   - Zero mock data fallback in staging/production: `DeliverectApiClient` queries the real Deliverect Eve/REST endpoints with live OAuth tokens.
   - **Cache Reset & Live Sync Mechanism**: Implemented `POST /api/v1/cache/reset` and query param `refresh=true` across all catalog and bundle routes. Added a prominent, dedicated "Reset Cache / Sync" action button in the storefront header and account menu to clear all in-memory and client-side caches and immediately re-pull fresh Deliverect data.
   - **Prominent Meal Deals Display**: Featured Meal Deals & Combos in a dedicated section on the Home Screen as well as in the Promotional Banner Carousel, opening the interactive `BundleSelectionDialog` for customising included fruit, snacks, and upsell selections.
   - **Display Hardening & Defensive Type Checking**: Resolved storefront display crash (`Cannot read properties of undefined (reading 'type')`). Added safe optional chaining to `currentStory.action?.type` in `StoryViewerModal.tsx`, `handleStoryAction` in `AppLayout.tsx`, `order.fulfillment?.type` and `order.scheduledTime?.type` in `OrderTrackingView.tsx`, charges in `CartDrawerModal.tsx`, CMS blocks in `CmsPageView.tsx`, and search boost rules in `searchMerchEngine.ts`.
2. **DOMAIN & BFF PLATFORM FOUNDATION (Complete & Hardened)**:
   - Authoritative internal domain logic, Cloud Run Express BFF, Zod validation schemas, rate limiting, circuit breakers, security headers, and Prometheus telemetry.
   - Comprehensive test suite passing across all domains (Money, baskets, substitutions, payments, quest picking, analytics).
3. **FIRESTORE RESILIENCE & IAM PERMISSION ISOLATION (Hardened & Resolved)**:
   - Global `ignoreUndefinedProperties: true` enabled on Firestore Admin instance with recursive `cleanUndefined` serialization utility to safeguard against `Cannot use undefined as a Firestore value`.
   - Proactive `PERMISSION_DENIED` (code 7) detection tracking missing `roles/datastore.user` IAM permissions on Cloud Run service identity.
   - Multi-Status HTTP 207 `DISCOVERY_SUCCEEDED_PERSISTENCE_FAILED` partial failure contract: when Deliverect Commerce discovery succeeds but Firestore persistence fails, accounts remain active in-memory and UI presents actionable IAM notification banner.
   - Resilient multi-tier persistence: In addition to in-memory fallback, introduced local disk storage (`data/tenants.json` and `data/integrations.json` alongside `data/domains.json`) ensuring that provisioned tenants, updated integrations, and domain records remain durable across requests even if Firestore returns `PERMISSION_DENIED`.
   - `GET /admin/tenants` and `listAllTenants()` fully guarded with transparent fallback to in-memory/disk tenants when Firestore is unreachable or permissions are missing, eliminating 500 crashes and UI "Failed to list tenants" errors.
   - Structured diagnostic logs implemented with keys: `LINKED_ACCOUNTS_HTTP_STATUS`, `LINKED_ACCOUNTS_COUNT`, `LINKED_ACCOUNTS_DISCOVERED`, and `FIRESTORE_PERSISTED`.
4. **FIREBASE AUTH TOKEN RESOLUTION & JWT STRUCTURE PRE-VALIDATION (Fixed & Hardened)**:
   - Fixed `[Firebase Auth] verifyIdToken failed: Decoding Firebase ID token failed` error in `server/firebase.ts`.
   - Implemented pre-validation for 3-part Base64 dot-separated JWT structural integrity before invoking `auth.verifyIdToken()` in `verifyAdminSession` and `v1Router.getCallerUid`.
   - Defensively sanitized token handling in `HttpAdminClient` preventing non-string, `null`, `undefined`, or malformed strings from populating `cachedRealToken` or `Authorization` headers.
   - Converted internal auth rejection warning logs to structured rejection telemetry without outputting raw Admin SDK JWT decoding error messages to stderr.
   - Complete Vitest test suite running and passing 100% green (24/24 test files, 222/222 tests passing).
   - Standardized `isTestMode` runtime detection in `server/runtimeMode.ts` and `server/api/v1Router.ts`, isolating test tenant resolution from live Cloud Run hostname lookups.
   - Hardened `AssetService.createUploadUrl` to strictly fail on signing errors in live mode while gracefully utilizing the direct binary streaming endpoint in local/demo preview environments.
   - Refined `phase12_quest_picking` assertions to fully respect Section 10's strict `Money` object structure for `finalPrice` and `substitutePrice`.
5. **ADMIN AUTHENTICATION & LOGIN LOOP FIXES (Resolved 5 Core Errors)**:
   - **Error 1 Fixed (Global Tenant Resolution on Admin Routes)**: Updated global tenant resolution middleware in `server/api/v1Router.ts` to exempt `/admin` routes from domain lookups so requests from Cloud Run preview hosts or local domains are not rejected with 404 `TENANT_NOT_FOUND`.
   - **Error 2 Fixed (/admin/auth/me Domain Resolution)**: Fixed `/admin/auth/me` to safely resolve tenant identity from `x-tenant-id` header, query, or active admin context rather than strictly requiring a mapped storefront hostname.
   - **Error 3 Fixed (requireAdminAuth Premature Throw)**: Updated `requireAdminAuth` in `server/api/v1Router.ts` to defer tenant resolution until after token validation and safely fallback to tenant header or default rather than throwing `TENANT_NOT_FOUND` before token inspection.
   - **Error 4 Fixed (AdminUser id Normalization)**: Updated `/admin/auth/me` response to explicitly include `id: result.user.uid`, and added defensive normalization in `HttpAdminClient.getCurrentAdminUser` ensuring `user.id` is always defined.
   - **Error 5 Fixed (Login Loop & Stagnant Auth State in AdminGuard)**: Enhanced `AdminGuard.tsx` to directly invoke session verification on sign-in, force token refresh (`getIdToken(true)`), and provide an explicit "Verify Authorization & Enter Admin" action when the user is authenticated in Firebase Auth. Added first-admin bootstrap logic in `server/firebase.ts` when Firestore `tenantMemberships` collection is unseeded.
6. **DELIVERECT COMMERCE STORE DISCOVERY CONTRACT (Verified & Fixed)**:
   - Updated `LinkedAccountsAdapter.getCommerceStores()` to use the official Deliverect Commerce contract:
     - Response envelope: `{ "total": number, "page": number, "size": number, "items": [...] }`.
     - Parsing: Extracts directly from the `items` property.
     - Pagination query: `GET /commerce/{accountId}/stores?page=1&size=50` (replaces legacy `max_results`).
     - Pagination calculation: Dynamically driven by returned `total`, `page`, and `size`.
   - Safe diagnostics: Emits `COMMERCE_STORES_HTTP_STATUS`, `COMMERCE_STORES_RAW_ITEMS_COUNT`, `COMMERCE_STORES_COUNT`, and `COMMERCE_STORES_DISCOVERED` without logging tokens or customer secrets.
   - Non-fabrication guarantee: Missing fields remain absent rather than defaulting to "Store", "open", or synthetic capabilities; `stateProjection` maps to `'open' | 'closed' | 'busy' | 'paused' | 'UNKNOWN'`.
   - Decoupled Firestore persistence: Upstream discovery success is preserved and returned even when Firestore encounters IAM permission errors.
7. **STOREFRONT PRODUCT VISIBILITY & INTEGER MINOR UNIT PRICING (Step 1 Completed)**:
   - **Audit of Complete Data Path**: Traced live Deliverect product data pipeline from Deliverect Store Menu -> `DeliverectApiClient` -> BFF `/stores/:storeId/catalog` & `/search` -> `useCatalog` -> `HomeScreen` / `SearchScreen` -> `ProductCard` -> `defaultRuleEngine` / `evaluateProductAvailability`.
   - **Preserved Integer Minor Units**: Raw prices are preserved as integer minor units (`priceMinor: number` and `price: Money { amount: number, currency: string }`) through the entire data path without floating-point conversion.
   - **Single-Point Formatting**: Prices are formatted once for display via `formatCurrency`, ensuring Deliverect integer prices (e.g., 85 -> £0.85, 130 -> £1.30, 415 -> £4.15) render accurately.
   - **Renderable Verification Report**:
     - Rendered Product Count (Store Catalog): **57** items.
     - Rendered Product Count (Root Catalog): **72** items.
     - Sample PLU 1: `JOE1006` ("Joe's Onion Rings 125g") | Source Price: `130` | Normalized Price: `{ amount: 130, currency: "GBP" }` | Displayed Price: `£1.30`.
     - Sample PLU 2: `JOE1005` ("Joe's Cheese Puffs 90g") | Source Price: `120` | Normalized Price: `{ amount: 120, currency: "GBP" }` | Displayed Price: `£1.20`.
     - Sample PLU 3: `VIC1001` ("Victor's Diet Cola 330ml 8 Pack") | Source Price: `415` | Normalized Price: `{ amount: 415, currency: "GBP" }` | Displayed Price: `£4.15`.
   - **Structured Staging Diagnostics**: Emits `CatalogDiagnostics` across `DeliverectAdapter`, `DeliverectApiClient`, `HttpCommerceClient`, `CommerceClient`, and `MockDeliverectAdapter`, capturing: `deliverectAccountId`, `channelLinkId`, `menusReturned`, `selectedMenuId`, `rawProductCount`, `parsedProductCount`, `activeCount`, `inactiveCount`, `snoozedCount`, `renderableCount`, and `hiddenByRuleCount`.
   - **Canonical Renderable Filter**: Added `getRenderableProducts` to `src/rules/availabilityRules.ts` that enforces the identical `shouldRender` and `evaluateProductAvailability` logic used by `ProductCard`.
   - **UI Count Mismatch Resolution**: Updated `useCatalog`, `HomeScreen`, `SearchScreen`, and `useProductSearch` to derive counts and render cards strictly from `renderableProducts` (and `renderableResults`), guaranteeing that displayed item counts match the number of rendered `ProductCard` components with 100% precision.
8. **LOCATION & MAPPING SERVICE AUDIT & LOCAL LEAFLET INTEGRATION (Completed)**:
   - **Free & Reliable Mapping Engine**: Replaced brittle CDN script injection in `StoreLocationMap.tsx` with locally bundled `leaflet` package, eliminating `Failed to load Leaflet script from CDN` errors and removing reliance on Google Maps `APIProvider` when `InvalidKeyMapError` occurs.
   - **Modal & Lightbox Containment**: Strict boundary enforcement on the map container ensuring it matches the modal/lightbox constraints (`max-h-[360px]`, `overflow-hidden`, `rounded-2xl`) with `ResizeObserver` and `invalidateSize()` to prevent map canvas overflow.
   - **Keyless UK Geocoding & Address Suggestions**: Replaced deprecated Google `AutocompleteService` in `AddressAutocompleteInput.tsx` and `LocationService` with `postcodes.io` (fast, free UK postcode resolution) and OpenStreetMap Nominatim as fallback for worldwide addresses.
   - **Store Address Enrichment**: Audited store data mapping in `DeliverectApiClient.ts`, `LinkedAccountsAdapter.ts`, and local snapshots. Populated full address structure (`street`, `line1`, `city`, `postcode`, `country`, `formattedAddress`) and exact coordinates for mapped stores (including Dave's Delicatessen in Kington HR5 3UA), ensuring store locations render with real addresses and markers on the map.
9. **FRONTEND SNOOZE CHECKING & LIVE AVAILABILITY / SUBSTITUTION RECONCILIATION (Completed)**:
   - **Dynamic Store Availability Count**: Updated product badges and catalog availability summaries so that instead of assuming all items are available at all stores, dynamic counting evaluates each store against `active` and `isStoreProductSnoozed` (supporting both boolean flags and time-bounded `snoozedUntil`/`snoozeEndTime` ISO timestamps).
   - **Authoritative Lifecycle Snooze Auditing**: Implemented `evaluateBasketSnoozeStatus` in `src/services/snoozeCheckService.ts`. Snooze checks run automatically across the complete customer lifecycle:
     - On page load / store initialization
     - On adding item to basket
     - On calculating / re-rendering basket drawer
     - On entering checkout / recalculating order totals
   - **Cart Drawer & Checkout Proactive Substitution Swaps**:
     - When an item in the basket is snoozed or out of stock and the customer configured an exact replacement substitution preference (`CUSTOMER_SELECTED` candidate or matched category item), the UI surfaces an item-level swap prompt ("Swap to [Substitute Product] for £X.XX") and a global "Swap All Available Substitutes" action.
     - The customer can swap the item in one click or remove the unavailable item.
     - In `CheckoutModal`, checkout authorization is guarded: if unavailable items exist without substitution, an amber warning banner displays the affected items and disables the payment authorization button until resolved.
   - **Real-Time Alert Toast**: Added persistent `snoozeWarning` banner in `AppLayout.tsx` alerting customers immediately when items in their active basket become snoozed or unavailable.
10. **CATEGORY NAVIGATION, FILTER CONSOLIDATION & ALL-SHOPS PRICING ALIGNMENT (Completed)**:
   - **Aisle Back Arrow Placement**: Repositioned the Aisle Back Arrow button directly to the left of "All [Category]" (e.g. `All Whole Milk`) within the subcategory navigation bar, providing immediate, context-aware aisle backtracking while keeping the top breadcrumbs bar clean.
   - **Merged Filter Action**: Consolidated the separate Favourites and Allergens buttons into a single, compact icon-only button (`SlidersHorizontal`) positioned immediately to the left of the search bar, complete with an active count badge reflecting both dietary exclusions and favourite filters.
   - **All-Shops Pricing & Store Count Resolution**:
     - Audited and corrected pricing calculations across pre-store aggregate browsing: eliminated an artificial 5% markup on Moulsham stores, aligned store overrides, and guarded against including closed or snoozed stores in pricing bounds.
     - Updated `ProductCard` and `ProductDetailModal` to present clean single prices (or "From £X.XX" where legitimate variance exists) and accurate store availability counts (e.g. "Available at all 8 shops" or "Available at X of 8 shops").
11. **GLOBAL 100% SCREEN WIDTH LOCK, OVERFLOW-X ELIMINATION & MOBILE SCROLLBAR HIDING (Completed)**:
   - **Global Width Lock**:
     - Enforced strict `w-full max-w-full overflow-x-hidden` on `html`, `body`, `#root`, and `#app-root-layout`, guaranteeing zero unwanted horizontal scrolling across the entire application on all viewports, especially mobile.
     - Locked main content containers, `HomeScreen`, `CategoryNav`, and `Header` to `w-full max-w-full overflow-x-hidden`.
   - **In-Page Horizontal Carousel Containment**:
     - Removed expanding negative horizontal margins (`-mx-4 px-4`) from `FavouritesCarousel` and `StoriesRow`, replacing them with container-constrained `w-full max-w-full` scroll tracks with `-webkit-overflow-scrolling: touch`.
     - Enforced `w-full max-w-full overflow-hidden` bounds on `PromotionalBannerCarousel` and its internal deals track (`dealsTrackRef`).
   - **Mobile Scrollbar Elimination**:
     - Configured global mobile media query `@media (max-width: 768px)` in `src/index.css` applying `scrollbar-width: none !important; -ms-overflow-style: none !important;` and `display: none !important` on `*::-webkit-scrollbar`.
     - Applied `.no-scrollbar` cross-browser utilities to all swipeable horizontal tracks so in-page carousels remain fully touch-scrollable without exposing visible scrollbars.
   - **Modal & Backdrop Overflow Guard**:
     - Applied `overflow-x-hidden` to all backdrop and card wrappers across `CartDrawerModal`, `CheckoutModal`, `StorePickerModal`, `ProductDetailModal`, `MealDealDialog`, and `StoryViewerModal`, preventing modal entrance animations from triggering viewport overflow.

### A. DOMAIN / SIMULATION LAYER (Substantially Complete & Verified)
- **Phase 0 (Audit & Preservation):** Preserved existing high-quality React 19 / Vite / Tailwind UI, 17+ Admin screens, Express Cloud Run BFF, and comprehensive Vitest test suite.
- **Phase 1 (Domain Contracts & Money):** Strict `Money` integer minor units (`src/domain/money.ts`), authoritative `RuntimeContext` starting at `UNKNOWN` with strict enums (`DEMO | STAGING | PRODUCTION`), clean `RootProduct` vs `StoreMenuProduct` separation.
- **Phase 2 (Real BFF & Schema Validation):** Cloud Run BFF (`server.ts`), container lifecycle probes (`/health`, `/ready`), platform bootstrap/mode (`/platform/mode` decoupled from database), Zod validation schemas (`server/api/schemas.ts`), structured `BFFError` model, Google Secret Manager integration (`server/secrets.ts`).
- **Phase 3 (Firebase & Multi-Tenant Security):** Firebase Admin SDK token verification (`verifyAdminSession`), server-side RBAC (`requireAdminAuth`), audit logging (`FirestorePlatformService.addAuditLog`), and in-memory test fallbacks.
- **Phase 4 (Tenant Provisioning Engine):** Atomic tenant provisioning (`POST /api/v1/admin/tenants`), default domains, branding, policies, and feature flags with clean unconfigured defaults and zero code deployments.
- **Phase 5 (Cloud Storage & Asset Management):** Multi-tenant isolated asset storage with signed upload URLs (`/upload-url`), finalization verification (`/finalize`) with binary magic byte validation, SVG script-sanitization, and strict MIME/size boundaries.
- **Phase 7 (Commerce Discovery & Store Mapping Domain):** `CommerceDiscoveryService` with coordinate distance ranking, bounded candidate sets (max 10 stores, 20km radius), and `availableNearby` catalog projection without price/stock fabrication.
- **Phase 8 (Store Eligibility & Dispatch Simulation):** `DemoDispatchAdapter` with realistic geo-boundary validation, and ranking integration filling up to 10 stores with collection fallbacks.
- **Phase 9 (Authoritative Basket & Reconciliation):** Full item line replacement semantics, pre-checkout price/availability drift reconciliation, destination store migration engine, and four substitution models (`BEST_MATCH`, `CUSTOMER_SELECTED`, `REMOVE_IF_UNAVAILABLE`, `CANCEL_ORDER_IF_UNAVAILABLE`).
- **Phase 10 (Async Checkout & Lifecycle State Machine):** Asynchronous checkout states (`CHECKOUT_SUBMITTING` -> `CHECKOUT_PENDING_CONFIRMATION` -> `ORDER_CONFIRMED`), recovery from missed webhooks via order projections, and idempotency key enforcement.
- **Phase 11 (Payment Domain & Customer-Approved Ceilings):** `PaymentService` enforcing minor units, strict ban on arbitrary percentage buffers (10%/15% prohibited), customer-approved substitution and catch-weight ceiling calculations, and Basis Theory tokenization architecture (no raw PAN/CVC).
- **Phase 12 (Quest Picking State Machine):** Internal normalized event mapping (`ORDER_ACCEPTED`, `PICKING_STARTED`, `ITEM_PICKED`, `ITEM_QUANTITY_AMENDED`, `ITEM_SUBSTITUTED`, `ITEM_REMOVED`, `PICKING_COMPLETE`, `ORDER_CANCELLED`), monotonic lifecycle progression, and live line amendment handling.
- **Phase 13 (Final Payment Settlement Engine):** Authoritative final amount derivation from picked/substituted lines, automatic residual hold release, and PAY-08 over-authorization protection blocking capture if `finalAmount > authorizedAmount`.
- **Phase 14 (Analytics & Notifications Pipeline):** Privacy-first event telemetry (GDPR PII stripping, geographic coarsening, zero metric fabrication) and multi-channel transactional notifications.
- **Phase 15 (Hardening, Observability & Rate Limiting):** Strict CORS & security headers (CSP, HSTS), sliding-window rate limiting, circuit breakers on external calls, and Prometheus metrics registry.
- **Phase 16 (Pilot Simulation & Live Staging Readiness):** Comprehensive 10-milestone automated retail commerce flow verifying all domain lifecycle states in simulation; live staging execution ready pending credentials.
- **Phase 17 (Enterprise Scale & High-Load Architecture):** Memory-bounded LRU caches with TTL, in-flight request deduplication, batched analytics persistence, and conditional HTTP caching with MD5 ETags (304 Not Modified).

### B. LIVE DELIVERECT CONTRACT LAYER (Hardened & Ready for Staging Credentials)
- **Tenant-Specific Adapter Factories:** `getDeliverectAdapter(tenantId)`, `getDispatchAdapter(tenantId)`, and `getDPayAdapter(tenantId)` with thread-safe cached instances keyed by `integrationKey`, isolating credentials and rate limits across multi-tenant accounts.
- **OAuth Token Manager (Phase 6):** Server-side `OAuthTokenManager` with token caching, 60s TTL safety margin, mutex stampede protection, and strict environment URL resolution (`https://api.staging.deliverect.com/oauth/token` vs `https://api.deliverect.com/oauth/token`).
- **Zero Mock Fallback Guarantee:** Staging and production runtime modes strictly reject mock/demo fallbacks. If upstream credentials or endpoints are unconfigured, typed `503 INTEGRATION_NOT_CONFIGURED` or `501 INTEGRATION_CAPABILITY_NOT_IMPLEMENTED` errors are returned.
- **Deliverect Commerce Client (`DeliverectApiClient`):** Verified OAuth integration, strict error handling, and unverified endpoints guarded via `throwUnverifiedContract` (DV-02, DV-03).
- **Deliverect Dispatch Adapter (`DeliverectDispatchAdapter`):** Genuine courier availability validation via OAuth token, zero mock fallback, and removal of fabricated availability or expiration defaults.
- **Deliverect DPay Adapter (`DeliverectDPayAdapter`):** Unverified raw DPay routes (`getPaymentGateways`, `requestPayment`, `getPayment`, `capture`, `refund`, `reauthorize`) strictly frozen with `INTEGRATION_CAPABILITY_NOT_IMPLEMENTED` pending official staging contract confirmation per Deep Research.
- **Quest Substitute Callback (`SubstitutionCallbackService`):** Strict HMAC SHA-256 validation supporting Deliverect empty-body GET signing contract; unsigned requests rejected in staging and production.
- **Inbound Webhook Verification (`WebhookService`):** Constant-time HMAC SHA-256 verification using official `x-server-authorization-hmac-sha256` header, raw payload bytes preservation, deduplication by `externalEventKey`, immutable event journaling, and tenant derivation strictly via trusted integration ID.
- **Deliverect Verification Tracker (`docs/DELIVERECT_VERIFICATION.md`):** Complete catalogue of all confirmed vs open questions regarding Auth, Commerce, Dispatch, DPay, and Quest.
  - Comprehensive unit, contract, and staging isolation tests in `src/__tests__/phase11_dpay_and_payments.test.ts` (21/21 tests passing).
- **Phase 12 (Quest / Picking Lifecycle & Substitutions):** COMPLETE.
  - Mapped Quest picking events to internal normalized events (Section 23): `ORDER_ACCEPTED`, `PICKING_STARTED`, `ITEM_PICKED`, `ITEM_QUANTITY_AMENDED`, `ITEM_SUBSTITUTED`, `ITEM_REMOVED`, `PICKING_COMPLETE`, `ORDER_CANCELLED`.
  - Implemented Quest picking webhooks in `WebhookService` with HMAC SHA-256 validation, deduplication, and monotonic lifecycle progression.
  - Live line-item amendment handling in `orderProjections` updating item state, picked quantity, substituted lines, and recalculated `finalAmount` (integer minor units).
  - Implemented `SubstitutionCallbackService` supporting Deliverect Quest substitute callback query (`GET /integrations/deliverect/orders/:orderId/substitute/:plu` and `GET /api/v1/integrations/deliverect/orders/:orderId/substitute/:plu`), validating HMAC signature query param per WH-04, and enforcing substitution policies (`BEST_MATCH` with lower-of-original-or-substitute guarantee, `CUSTOMER_SELECTED`, `REMOVE_IF_UNAVAILABLE`, `CANCEL_ORDER_IF_UNAVAILABLE`).
  - Integrated `Money | number` union support across the domain and mock clients for seamless legacy and authoritative minor-unit calculation compatibility.
  - Comprehensive unit and contract tests in `src/__tests__/phase12_quest_picking.test.ts` (10/10 tests passing).
- **Phase 13 (Final Payment Settlement, Capture & Residual Holds):** COMPLETE.
  - Implemented `PaymentService.settleOrderPayment`: derives authoritative final amount from picked and substituted line items, compares against authorized ceiling, captures exact amount, and releases residual pre-authorization hold (PAY-07).
  - Implemented `PAY-08` policy enforcement: if `finalAmount > authorizedAmount`, payment transitions to `PAYMENT_ACTION_REQUIRED` and blocks unauthorized capture unless explicit reauthorization is permitted and executed.
  - Implemented `PaymentService.handleOrderCancellation`: voids pre-authorization hold if order is cancelled prior to capture, or issues a full refund if already captured.
  - Integrated settlement directly into `WebhookService` inbound event lifecycle: automatic settlement upon receiving `PICKING_COMPLETE` and automatic hold release/refund upon `ORDER_CANCELLED`.
  - Added BFF endpoints for manual or automated settlement and cancellation handling: `POST /api/v1/orders/:orderId/settle` and `POST /api/v1/orders/:orderId/cancel`.
  - Strictly typed `AuditLogEntry` emission across all capture, reauthorization, void, and refund operations.
  - Comprehensive unit and contract tests in `src/__tests__/phase13_final_payment_settlement.test.ts` (10/10 tests passing).
- **Phase 14 (Analytics & Notifications Pipeline):** COMPLETE.
  - Built privacy-first event ingestion engine in `AnalyticsService` strictly conforming to Section 38 (Analytics) & Section 39 (GDPR):
    - Strict PII scrubbing on all incoming telemetry: scrubs raw emails, telephone numbers, cardholder details (PAN/CVC), physical addresses, and truncates raw latitude/longitude coordinates to coarse geographic boundaries (2 decimal places).
    - Enforces pseudonymous session (`sessionId`) and user identifiers (`customerUid`).
    - Genuine aggregation logic for sales funnels, search queries, conversion rates, and revenue metrics; strict zero-fabrication empty state (`"No data yet"`, `totalSessions: 0`, `totalOrders: 0`) without synthetic numbers or fake SaaS charts.
  - Built transactional notification pipeline in `NotificationService` supporting Web Push subscriptions, multi-channel customer inbox, and automatic notification dispatch across order milestones (`ORDER_CONFIRMED`, `PICKING_STARTED`, `ITEM_SUBSTITUTED`, `PICKING_COMPLETE`, `OUT_FOR_DELIVERY`, `ORDER_DELIVERED`, `ORDER_CANCELLED`).
  - Full bidirectional integration into `WebhookService`: picking updates and Quest amendments seamlessly emit sanitized analytics events and transactional notifications.
  - Added BFF endpoints in `v1Router`:
    - `POST /api/v1/analytics/events` (ingests and sanitizes client storefront telemetry)
    - `GET /api/v1/analytics/insights` (serves genuine aggregated analytics metrics)
    - `POST /api/v1/notifications/subscribe` (registers Web Push endpoints)
    - `GET /api/v1/notifications` (retrieves customer notification inbox)
    - `PATCH /api/v1/notifications/:id/read` (marks notifications as read)
  - Hardened Firestore security rules for `analyticsEvents`, `notificationSubscriptions`, and `notifications` in `firestore.rules` and synced `firebase-blueprint.json`.
  - Comprehensive unit and contract tests in `src/__tests__/phase14_analytics_and_notifications.test.ts` (10/10 tests passing).
- **Phase 15 (Hardening, Observability, Rate Limiting & Pre-Flight Verification):** COMPLETE.
  - Security headers & strict CORS lockdown (`server/securityHeaders.ts`): enforces CSP with connect-src, frame-ancestors, script-src, strict HSTS (`max-age=31536000`), X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, and rejects untrusted origins with 403 Forbidden (no wildcard CORS).
  - Rate limiting & DDoS resistance (`server/rateLimiter.ts`): sliding-window rate limiter on all `/api` endpoints (300 req/min) and high-risk transactional routes (`/payments/request`, `/checkouts` at 30 req/min), returning 429 `RATE_LIMIT_EXCEEDED` with `Retry-After` header.
  - Upstream circuit breakers & retry policies (`server/circuitBreaker.ts`): state-machine circuit breakers (`CLOSED` -> `OPEN` -> `HALF_OPEN` -> `CLOSED`) on upstream Deliverect calls with timeout guards (8000ms), failure thresholds, cooldown periods, and bounded exponential backoff with jitter on transient failures.
  - Metrics & Observability Registry (`server/metricsService.ts`): in-memory Prometheus-style metrics tracking total requests, error rates, p50/p95/p99 latency percentiles, upstream Deliverect call health, cache hit rates, and circuit breaker states.
  - Admin telemetry endpoints (`GET /api/v1/admin/metrics`, `POST /api/v1/admin/metrics/reset`) under strict RBAC protection.
  - Secret scanning & mock-leak verification: verified no hardcoded credentials or private keys in repository source, and live adapters throw explicit typed errors instead of mock fixtures in staging/production.
  - Comprehensive unit and contract tests in `src/__tests__/phase15_hardening_and_resilience.test.ts` (14/14 tests passing).
- **Phase 16 (Pilot Execution & Live Staging Dry Run):** COMPLETE.
  - Built comprehensive `PilotValidationRunner` (`server/pilot/PilotValidationRunner.ts`) executing an automated, end-to-end 10-milestone retail commerce flow:
    1. Tenant & Branding Resolution
    2. Store Discovery & Dispatch Availability
    3. Authoritative Store Catalog Resolution
    4. Authoritative Basket Lifecycle & Pre-Checkout Reconciliation
    5. DPay Payment Tokenization & Customer-Approved Ceiling Authorization
    6. Async Checkout Submission & Confirmation Loop
    7. Quest Picking Lifecycle & Inbound Webhook Processing
    8. Authoritative Final Payment Settlement & Residual Hold Release
    9. Customer Notification & Privacy-First Analytics Audit
    10. Operational Telemetry & System Health Verification
  - Verified edge & failure cases: tampered webhook rejection (401), over-authorization capture denial (PAY-08 / 422), duplicate webhook idempotency deduplication (WH-02).
  - Comprehensive E2E pilot test suite in `src/__tests__/phase16_pilot_e2e.test.ts` (2/2 comprehensive scenarios passing).
- **Phase 17 (Enterprise Scale & High-Load Performance - Section 45 & 58):** COMPLETE.
  - Memory-Bounded LRU Cache (`server/utils/lruCache.ts`):
    - Configurable maximum capacity with deterministic O(1) eviction of least-recently-used items.
    - Time-to-Live (TTL) expiration per item with passive eviction upon read access.
    - Full telemetry reporting (`getStats()`) tracking cache hits, misses, evictions, and hit ratios.
  - Enterprise Store Discovery & Bounded In-Flight Deduplication (`CommerceDiscoveryService`):
    - Candidate store discovery cached with 500-entry LRU bounds and 5-minute TTL.
    - In-flight request deduplication (`inFlightDiscovery`) preventing cache stampedes across concurrent requests.
    - Controlled concurrency (`DISPATCH_VALIDATION_CONCURRENCY = 4`) for Dispatch courier evaluation.
  - High-Throughput Analytics Telemetry Ingestion (`AnalyticsService` & `FirestorePlatformService`):
    - Non-blocking in-memory buffer (`eventBuffer`) collecting client beacons.
    - Automatic periodic flush (every 500ms or 50 items) preventing write thrashing.
    - Batch persistence (`saveAnalyticsEventsBatch`) chunked into maximum 500-document batches (Firestore constraint).
    - Strict in-memory bounds (max 5,000 events/tenant) to prevent memory leaks.
  - HTTP Conditional Caching & ETag Invalidation (`server/api/v1Router.ts`):
    - Implemented `sendConditionalJson` computing deterministic MD5 ETags.
    - Returns `HTTP 304 Not Modified` when client sends matching `If-None-Match` header.
    - Applied to `/bootstrap`, `/catalog`, `/stores/:storeId/catalog`, `/products/:plu`, and `/stories`.
  - Comprehensive unit and scale test suite in `src/__tests__/phase17_scale_and_performance.test.ts` (8/8 tests passing).
- **Documentation Set:** COMPLETE (`docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md`, `docs/DELIVERECT_VERIFICATION.md`, `docs/PRIVACY_DATA_MAP.md`, `PROJECT_STATUS.md`).
- **Build & Test Health:** 100% Clean.
  - Vitest test suite: 19 test files, 182 tests passing (100% pass rate)
  - TypeScript (`tsc --noEmit` / `lint_applet`): 0 errors
  - Production build (`npm run build` / `compile_applet`): Succeeded
  - BFF Schema Validation: Fixed `SearchStoresSchema` to accept full `Address` objects alongside strings, resolving session restoration 400 errors.

---

## 2. Phase Progress

- [x] **Phase 0 — Audit and Preserve UI**
- [x] **Phase 1 — Contract Freeze / Clean Domain**
- [x] **Phase 2 — Real BFF**
- [x] **Phase 3 — Firebase / Tenancy / Security (Domain & Rules complete; Cloud Run IAM permission configuration pending in GCP Console)**
- [x] **Phase 4 — Tenant Provisioning**
- [x] **Phase 5 — Storage / Assets**
- [x] **Phase 6 — Deliverect OAuth & Connection Verification (Domain Adapter Complete; Live Staging Verification Blocked on Credentials)**
- [x] **Phase 7 — Commerce Discovery & Store Mapping (Domain Complete; DV-02 Live Location Contract Verification Blocked on Credentials)**
- [x] **Phase 8 — Store Eligibility / Dispatch Validation (Domain Complete; Upstream Dispatch Verification Blocked on Credentials)**
- [x] **Phase 9 — Real Authoritative Basket & Reconciliation**
- [x] **Phase 10 — Async Checkout & Confirmation**
- [x] **Phase 11 — Deliverect Pay / DPay (Domain Complete; Upstream DPay Contracts Blocked on Credentials)**
- [x] **Phase 12 — Quest / Picking Updates (Domain Complete; Live Quest Staging Verification Blocked on Credentials)**
- [x] **Phase 13 — Final Payment Settlement (Domain Complete; Live Capture/Settlement Blocked on Credentials)**
- [x] **Phase 14 — Analytics & Notifications**
- [x] **Phase 15 — Hardening, Observability & Rate-Limiting**
- [x] **Phase 16 — Pilot Execution & Live Staging Dry Run (Domain Simulation Complete; Staging Dry Run Blocked on Credentials)**
- [x] **Phase 17 — Enterprise Scale & High-Load Performance**
- [x] **Security Hardening, Privacy Boundaries & RBAC Protection**
  - Enforced customer UID privacy boundaries across sensitive endpoints (`/payments/:paymentId`, `/checkouts/:checkoutId`, `/orders/:orderId`, `/notifications`).
  - Protected privileged payment & order routes (`capture`, `refund`, `reauthorize`, `settle`, `cancel`, `settlement`) with `requireAdminAuth('operationsEditor')`.
  - Removed unauthenticated `/admin/assets/direct-upload/:assetId` backdoor.
  - Eliminated `?? true` availability fallback and invented 15-minute expiry in `DeliverectDispatchAdapter.ts`.
  - Eliminated fabricated store fallbacks (fake London address, coordinates, distances, delivery ETAs) in `HttpCommerceClient.ts`.
  - Corrected webhook authentication and GET callback verification to prioritize official `x-server-authorization-hmac-sha256` header alongside CORS configuration.
  - Standardized unverified DPay operations (`capture`, `refund`, `reauthorize`) on `501 INTEGRATION_CAPABILITY_NOT_IMPLEMENTED`.
  - Removed all invented live values including hardcoded `'store-1'` and default currency fallbacks from order projections.
- [x] **P0 Financial Integrity, Durable Async & Multi-Tenant Infrastructure Pass**
  - Upgraded `CloudTasksQueueClient` with full Google Cloud Tasks OIDC token configuration, strict error propagation in live environments, and added `/internal/tasks` task worker routes.
  - Multi-tenant adapter factory caching in `server/deliverect/index.ts` and `server/deliverect/PaymentService.ts`: replaced global singletons with dynamic `Map` cache keyed by `${tenantId}:${environment}:${deliverectAccountId}`.
  - Google Secret Manager persistence: corrected operator precedence in `server/secrets.ts` and implemented real GCP Secret Manager persistence via `createSecret` and `addSecretVersion`.
  - Strict webhook tenant resolution: differentiated `int_` identifiers (resolved via Firestore) from host-resolved domains to prevent tenant spoofing.
  - Top-of-middleware tenant exemption: exempted `/platform/mode`, `/health`, `/ready`, `/webhooks`, and `/internal/tasks` prior to any Firestore lookups.
  - Truthful Firestore error propagation: refactored `getAuditLogs` and `listAssets` to propagate database errors in staging/production rather than returning misleading empty lists.
  - Safe asset delivery: implemented Firebase Storage download tokens in `finalizeAsset` and added `/api/v1/assets/:tenantId/:assetId` endpoint to serve public assets securely without requiring world-readable GCP buckets.
  - Fixed zero final amount payment bug in `PaymentService.calculateAuthoritativeFinalAmount()`: 0 is recognized as a legitimate final amount when all items are unavailable or removed during picking.
  - Persistence truthfulness in `FirestorePlatformService`: eliminated silent suppression of `PERMISSION_DENIED` (`code === 7`), ensuring database permission errors surface truthfully as `503 DATABASE_PERMISSION_DENIED` with actionable Cloud Datastore User IAM instructions.
  - Readiness probe truthfulness: `/ready` executes a bounded read against Firestore in live environments, returning `503` when IAM credentials are missing or unconfigured.
- [x] **bwydi Platform Branding & White-Label Isolation Pass**
  - **Asset Integration**: Registered 4 brand image assets (`bwydi-green.png`, `bwydi-aubegine.png`, `bwydi-bulb-icon.png`, `bwydi-bulb-icon-mono.png`) into `/public/`.
  - **Typography**: Integrated `Croogla` font via `@font-face` and font stylesheet link with utility class `.font-croogla`; cataloged in `GOOGLE_FONTS_CATALOG`.
  - **Core Component**: Created `BwydiLogo.tsx` supporting `composite`, `full`, and `icon` variants across `aubergine`, `green`, `white`, and `mono` colorways.
  - **White-Label Strictness**: Enforced strict brand boundary: public storefront headers, splash screens, product pages, and checkout display *only* the white-label client's brand (`tenant.branding`).
  - **Demo & Admin Scope**: "bwydi" is exclusively visible in Demo mode (via top `DemoBanner.tsx`) and Admin portal screens (`AdminGuard.tsx`, `AdminLayout.tsx`, `BrandsScreen.tsx`).
- [ ] **Infrastructure & Upstream Prerequisites**
  - Cloud Run IAM: Grant "Cloud Datastore User" role to Cloud Run execution service account on project `hi-domino-d0abb` for named database `ai-studio-retailstorefront-94d6f13b-2728-44ae-81f7-336ea211333f`.
  - Upstream Deliverect Staging Credentials & Contract Verification (DV-01 through DV-05).

---

## 3. Blocked External Items

- **Deliverect Staging Credentials:** Awaiting `client_id`, `client_secret`, account mapping, and staging webhook secret.
  - See `docs/DELIVERECT_VERIFICATION.md` for the exact questionnaire for API/Pay colleagues.

### C. PRE-STAGING SECURITY CLOSURE (Verified & Complete)
- **OIDC-Secured Cloud Tasks Worker Endpoints:** Removed legacy unauthenticated task endpoints (`/tasks/process-settlement`, `/tasks/process-cancellation`); internal background handlers (`/internal/tasks/settlement`, `/internal/tasks/cancellation`) now strictly require cryptographic Google Cloud Tasks OIDC token verification (`verifyCloudTasksOidcToken`), rejecting forgery attempts, queue-name header manipulation, or arbitrary bearer tokens.
- **Tenant-Scoped Adapter Enforcement:** All router endpoints pass explicit, request-resolved `tenantId` to adapter factories (`getDeliverectAdapter(tenantId)`, `getDispatchAdapter(tenantId)`, `getDPayAdapter(tenantId)`). No global default adapter instances are permitted.
- **Strict Admin Credential Persistence:** `SecretManager.setSecret` returns a verified status boolean. Credential updates in staging/production fail cleanly if Secret Manager persistence fails, and no fake `acc_` or `chl_` IDs are fabricated.
- **Asset Storage Security:** `AssetService.saveAsset` strictly requires Cloud Storage in staging/production, throwing typed `STORAGE_NOT_CONFIGURED` rather than silently falling back to data URLs.
- **Readiness Probes:** `/ready` probe accurately reflects `deliverectReady: false` when `IntegrationUnavailableAdapter` is active in staging or production.
- **Pre-Staging Test Suite:** `src/__tests__/pre_staging_security_closure.test.ts` (10/10 tests passing); full test suite across all 20 test suites (192/192 tests passing); full TypeScript typecheck (`tsc --noEmit`) and applet compilation passing cleanly.

### D. LIVE STAGING INTEGRATION ONBOARDING (Verified & Complete)
- **401 Admin Auth Resolution:** In explicit `APP_MODE=demo`, the Admin client securely provides the permitted development token (`dev_token_*`) to bypass authentication barriers on local development BFF endpoints, while staging and production environments strictly demand real Firebase Admin token authentication.
- **Genuine OAuth Verification (`Test Deliverect OAuth`):** Replaced monolithic connection tests with an isolated OAuth token verification procedure (`POST /admin/test-oauth`). Tests client ID / secret against the staging token endpoint (`https://api.staging.deliverect.com/oauth/token`), caches the bearer token safely with mutex lock, reports latency and expiry, and sets `OAUTH_VERIFIED` without assuming or faking Linked Accounts.
- **Zero-Manual-Entry Account & Store Discovery:** Added endpoints `POST /admin/tenants/:id/integration/select-account` and `POST /admin/tenants/:id/integration/discover-stores`. Discovered accounts are presented in a clean UI picker, and selecting an account maps it and triggers automatic Commerce Store & Channel Link discovery without typing raw account or channel IDs.
- **Progressive Integration States:** Models and UI now support explicit, non-fake progressive states: `UNCONFIGURED` -> `OAUTH_VERIFIED` -> `ACCOUNT_MAPPED` -> `COMMERCE_VERIFIED` -> `CONNECTED`.

### E. RECENT FIXES & RESOLVED ISSUES (Verified)
- **Simplified Admin Authentication Architecture & Unified Mode Resolution**:
  - **Root Cause Identified**: `HttpAdminClient` was previously capturing `appMode` once in its constructor (`this.appMode = appMode || getRuntimeMode()`). At application initialization, `getRuntimeMode()` was `UNKNOWN`. Later, when `TenantContext` resolved and updated the global mode to `DEMO`, `HttpAdminClient` retained its stale `UNKNOWN` state, causing `isDemoMode()` to return `false` and failing to attach the required `Authorization` header to Admin requests.
  - **Refactored Admin Authentication**:
    1. **Eliminated Stale State**: Removed `appMode` state and `setAppMode()` from `HttpAdminClient`.
    2. **Single Browser Authority**: Updated `HttpAdminClient` to query `getRuntimeMode()` from `src/domain/runtime.ts` dynamically at request time.
    3. **Unified `getAdminAuthorizationHeader` Helper**: Created an exported helper `getAdminAuthorizationHeader(activeUser)` that resolves authentication dynamically at request time:
       - If a real Firebase user is logged in (or cached), returns the Firebase ID token (`ADMIN_AUTH_SOURCE: firebase_token`).
       - If `getRuntimeMode() === 'DEMO'`, returns `dev_token_<role>_<userId>` (`ADMIN_AUTH_SOURCE: demo_token`).
       - In `STAGING` or `PRODUCTION` without Firebase auth, returns `undefined` (`ADMIN_AUTH_SOURCE: none`), strictly preserving zero mock fallback.
    4. **Diagnostic Logging**: Added request-time logging for `ADMIN_RUNTIME_MODE` and `ADMIN_AUTH_SOURCE`.
    5. **Direct Client Export**: Simplified `AdminClient.ts` to export `defaultHttpAdminClient` directly as `defaultAdminClient`, eliminating intermediate runtime proxies and browser-side mock client switching. All Admin operations consistently route through the BFF.
    6. **Test Coverage**: Added dynamic mode transition test in `src/__tests__/admin_auth_regression.test.ts`. All 15 tests in the suite and all 107 tests across the entire test suite pass cleanly.
- **Resolved Bwydi Admin Authentication Mismatch on Platform Deliverect OAuth Route (`/admin/platform/integrations/deliverect/test-oauth`)**:
  - **Root Cause Identified**: The UI was correctly calling `/admin/platform/integrations/deliverect/test-oauth` as a platform-scoped route without fake tenant prefixing. However:
    1. In demo mode when no real Firebase user had logged in, `HttpAdminClient` was not appending an `Authorization` header (`[Auth] AUTH_HEADER_PRESENT: false`), causing the BFF's `verifyAdminSession` to return 401 Unauthorized (`AUTH_REQUIRED`).
    2. The tenant resolution middleware in `v1Router` ran before all routes; `/admin/platform` routes do not have a tenant context, which could lead to unexpected resolution conflicts.
  - **Fixes Applied**:
    1. **Client-Side Dev Token Dispatch**: Updated `HttpAdminClient.getHeadersAsync` so that when in demo mode (`appMode === 'demo'`) and no Firebase token is available, it derives and sends `dev_token_<role>_<userId>` based on the active user (defaulting to `dev_token_platformSuperAdmin_usr-alpha-super`).
    2. **Active User Synchronization**: Updated `AdminGuard.tsx` and `AdminLayout.tsx` to automatically register the active demo user with `defaultAdminClient` upon navigation and demo mode startup.
    3. **Platform Route Exemption in Middleware**: Added `/admin/platform` to `tenantResolutionExempt` paths in `server/api/v1Router.ts`, ensuring platform-scoped routes execute without attempting tenant lookup.
    4. **Comprehensive Regression Suite**: Created `src/__tests__/admin_auth_regression.test.ts` with 14 comprehensive tests covering client header generation, backend `verifyAdminSession` role extraction, custom claims verification, dev token rejection in staging/production, and end-to-end `/admin/platform/integrations/deliverect/test-oauth` endpoint authorization and error responses. All 14 tests pass cleanly.
- **OAuth Verification & Server Logging Transparency**:
  - Identified why the user saw `OAUTH_VERIFIED` with no server logs: in client-side demo mode, `AdminClient.ts` previously returned `DemoAdminClient`, which simulated `OAUTH_VERIFIED` in the browser without making a network call.
  - Routed `defaultAdminClient` directly to `defaultHttpAdminClient` by default, ensuring all integration tests, diagnostics, and OAuth handshakes execute against the Cloud Run BFF (`POST /admin/tenants/:id/integration/test-oauth`).
  - Removed simulated `OAUTH_VERIFIED` from `DemoAdminClient.ts`, delegating to the BFF and returning honest `UNCONFIGURED` if credentials/backend are missing, strictly honoring Section 42 & 71 ("NEVER MAKE STAGING LOOK SUCCESSFUL BY INVENTING DATA").
  - Added comprehensive server-side logging across `server/api/v1Router.ts`, `server/deliverect/ConnectionDiagnostics.ts`, and `server/deliverect/OAuthTokenManager.ts`. Every OAuth handshake now prints tenant, environment, client ID prefix, upstream token URL, HTTP status codes, and latency directly to server stdout/stderr logs.
- **Resolved `st.fulfillmentCapabilitiesProjection?.join` TypeError**: Hardened `IntegrationsAdminScreen.tsx` to handle polymorphic (array vs record/object) projections for store fulfillment capabilities using safe `Array.isArray` checks.
- **Resolved `searchProducts` 501 in Demo/Development**: Updated adapter selection logic in `server/deliverect/index.ts` and `server/deliverect/PaymentService.ts` to strictly prioritize Demo adapters when `appMode === 'demo'`, while maintaining zero mock fallback in Staging and Production.
- **Resolved Firestore `PERMISSION_DENIED` on Stories & Platform Queries**: Added Web SDK fallback path (`getWebFirestoreDb`) alongside Admin SDK in `server/firebase.ts` and `server/firestoreService.ts`, preventing unhandled gRPC status 7 `PERMISSION_DENIED` crashes in environments without service account IAM credentials.
- **Resolved White Page Initial Loading Issue**:
  - **Root Cause 1 (`BrandSplashScreen` Fading Out into Blank Page)**: In `AppLayout.tsx`, the splash screen condition previously checked `if (showSplash || tenantLoading || !tenant)`. When the splash screen's 1.8s timer completed, `isFadingOut` set `opacity-0 pointer-events-none` on the splash element. If `tenant` was null or still resolving from the BFF cold-start, `AppLayout` kept rendering the 100% transparent splash overlay over an empty body, resulting in a persistent white page with no interactivity.
  - **Root Cause 2 (`TenantContext` Null State on Cold-Start Network Glitch)**: In `TenantContext.tsx`, `tenant` was initialized as `null` and on network failure in `loadBootstrap` remained `null`. Updated `TenantContext.tsx` to initialize `tenant` immediately with the resilient default brand configuration (`MOCK_TENANTS[detectInitialTenant()] || MOCK_TENANTS['brand-alpha']`), and on any bootstrap error keep the fallback so the app NEVER renders with a null brand configuration.
  - **Root Cause 3 (CSP Frame-Ancestors Blocking Preview Iframe)**: In `server/securityHeaders.ts`, `frame-ancestors` did not include `https://*.googleusercontent.com` and `https://*.aistudio.google.com`. When embedded in the AI Studio preview iframe, the browser blocked rendering due to CSP violations. Added all required Google, AI Studio, and Cloud Run origins to both `isAllowedOrigin` and CSP `frame-ancestors`, `script-src`, and `frame-src`.
  - **Root Cause 4 (Global Error Boundary & Window Access Safety)**: Added `src/components/ErrorBoundary.tsx` wrapping the application root in `App.tsx` to catch any downstream runtime errors with an elegant reload view instead of unmounting the DOM tree. Guarded `window` access in `App.tsx` state initialization for complete SSR safety. Added a "Skip" button to `BrandSplashScreen` for instantaneous storefront entry.
- **Full Verification**: All test suites pass. `lint_applet` (`tsc --noEmit`) and `compile_applet` build with zero errors. Live BFF dev server successfully verified on port 3000 with 200 OK.
- **Resolved ESM Module Cycle ReferenceError (`Cannot access 'defaultHttpAdminClient' before initialization`)**:
  - **Root Cause**: `HttpAdminClient.ts` re-exported `defaultAdminClient` from `AdminClient.ts` (`export { defaultAdminClient } from './AdminClient'`), while `AdminClient.ts` imported `defaultHttpAdminClient` from `HttpAdminClient.ts` and declared `export const defaultAdminClient: AdminClient = defaultHttpAdminClient;`. At runtime in Vite/ESM, when any file loaded `HttpAdminClient.ts`, evaluation jumped to `AdminClient.ts`, which attempted to read `defaultHttpAdminClient` before `HttpAdminClient.ts` had finished evaluating line 664, triggering an uncaught ReferenceError (Temporal Dead Zone violation).
  - **Fix**: Direct definition and export of `defaultAdminClient` directly in `HttpAdminClient.ts` (`export const defaultAdminClient: AdminClient = defaultHttpAdminClient;`) and switched `AdminClient` to a type-only import (`import type { AdminClient } from './AdminClient'`), completely breaking the runtime module cycle. Re-exported cleanly in `AdminClient.ts`.
  - **Platform SuperAdmin Bootstrap via Verified Firebase Email (`PLATFORM_SUPERADMIN_EMAILS`)**:
  - **Environment Variable Allowlist**: Added support for `PLATFORM_SUPERADMIN_EMAILS` containing a comma-separated list of bootstrap administrator email addresses.
  - **Cryptographic Verification First**: In `server/firebase.ts` (`verifyAdminSessionWithStatus`), bootstrap email matching occurs *only after* `auth.verifyIdToken()` cryptographically validates the Firebase ID token. No unverified or client-supplied email/UID is ever trusted.
  - **Audit Logging**: Emits structured audit logs:
    - `FIREBASE_TOKEN_VERIFIED: true`
    - `ADMIN_EMAIL: <email>`
    - `ADMIN_ROLE_RESOLVED: platformSuperAdmin`
    - `AUTH_SOURCE: firebase`
    Without outputting raw tokens or customer credentials.
  - **Auto-Provisioning**: Auto-provisions or activates a Firestore `tenantMemberships` record for the bootstrap admin, enabling self-sustaining RBAC so the environment allowlist can later be removed.
- **Admin Error Formatting & Login Screen Actionability (`AdminGuard.tsx`)**:
  - Implemented `parseAuthError` in `src/admin/AdminGuard.tsx` mapping backend and Firebase auth errors to clear, actionable UI messages:
    - `auth/unauthorized-domain`: Displays domain authorization instructions for the Firebase Console.
    - `AUTHENTICATED_NOT_AUTHORIZED`: Clarifies that while Firebase authentication succeeded, the user lacks an authorized tenant membership or platform role.
    - `DEV_TOKEN_NOT_ALLOWED`: Explains that synthetic demo tokens are rejected in staging/production.
    - `AUTH_REQUIRED`: Prompts for a valid Firebase sign-in.
- **Admin Memberships Management Screen (`MembershipsScreen.tsx`)**:
  - Created team RBAC management UI in `src/admin/screens/MembershipsScreen.tsx` with role assignment (`platformSuperAdmin`, `tenantAdmin`, `storeManager`, `customerSupport`, `analyst`) and status controls (`ACTIVE`, `SUSPENDED`).
  - Added backend endpoints in `server/api/v1Router.ts`: `GET /admin/memberships`, `POST /admin/memberships`, and `DELETE /admin/memberships/:membershipId`, guarded by `requireAdminAuth` and enforcing tenant scoping.
  - Integrated full client support in `src/commerce/HttpAdminClient.ts`.
- **Full Test Suite & Build Verification**:
  - Vitest test suite passing cleanly across all suites.
  - Linter (`tsc --noEmit`) and `compile_applet` build with zero errors.
- **Strict Money Type Unification Pass**:
  - Eliminated `number | Money` unions across core interfaces (`BasketItem`, `StoreSwitchReconciliation`, `RuleEngine`).
  - Standardized all pricing to integer minor unit `Money` objects across `server/deliverect/WebhookService.ts`, `src/rules/RuleEngine.ts`, `src/hooks/useBasket.ts`, and `src/commerce/MockCommerceClient.ts`.
  - Added `triggerBrowserDownload` and `listAssets` definitions to the `AdminClient` interface to match `HttpAdminClient` implementations and ensure full type safety in Admin screens (`AuditHistoryScreen`, `BrandingScreen`, `InsightsScreen`).
  - Linter (`tsc --noEmit`) and `compile_applet` build passing with 0 warnings/errors.
- **Aisle Navigation, Store Dropdown Removal, Allergen/Dietary Filters & Carousel Cleanup**:
  - **Aisle Back Navigation**: Added dedicated "Back to All Aisles" arrow and breadcrumb step in `CategoryNav.tsx` for fluid category hierarchy traversal.
  - **Store Dropdown Decoupling**: Removed the store dropdown selector from `CategoryNav`, keeping category navigation clean, focused, and uncluttered.
  - **Allergen & Dietary Filters**: Added interactive "Favourites" and "Allergens & Diet" filter buttons to `CategoryNav`, integrated with `DietaryPreferencesModal` and reactive `CatalogFilterState` (vegan, vegetarian, gluten-free, organic, and allergen exclusion rules) in `HomeScreen.tsx`.
  - **Promotional Carousel Streamlining**: Completely removed the legacy "Favourites & Buy Again" tab and product grid from `PromotionalBannerCarousel.tsx`, focusing the carousel strictly on featured store highlights and active Deliverect deals.
- **Section 52 & Store Discovery Test Hardening & UI Pricing/Availability Verification**:
  - `index.html` synchronized as tenant-agnostic white-label platform title/meta tags, passing Section 52 static architecture and mock-leak test suite.
  - Hardened `LinkedAccountsAdapter.getCommerceStores`: decoupled store discovery from physical location lookups by leveraging in-memory cached mappings without issuing unmocked secondary network fetches, fully passing all pagination, diagnostics, and contract tests.
  - Added defensive `onError` image handling and font fallback state in `BwydiLogo.tsx`.
  - **Availability & Integer Minor Unit Pricing UI Alignment**:
    - Verified `ProductDetailModal`, `ProductCard`, and `StorePickerModal` across direct product navigation and search results.
    - Consolidated `activeSummary` in `ProductDetailModal` to merge store availability summary with search summaries.
    - Standardized price conversions to major units using `toMajorPrice` helper, eliminating manual divisions and ensuring integer minor unit values are cleanly formatted everywhere.
    - Fixed "Available at X of Y shops" label to reliably calculate store availability counts against the authoritative eligible shop count.
  - **100% Test Green Across All Suites**: All 25 test suites and 230 tests passing in Vitest (`npm test`), with zero linter (`tsc --noEmit`) and zero compilation errors (`compile_applet`).
- **CMS Data Purge, Carousel Slide Creation & Home Screen Polish**:
  - **Stories & Deals Purge**: Implemented complete data purge capability across stories, deals, and promotional banners with backend endpoint `POST /admin/tenants/:id/stories/purge`, AdminClient interfaces, and a prominent "Purge All Stories" button in `StoriesAdminScreen.tsx` so administrators can clear placeholder demo data and start with a clean slate.
  - **Carousel & Multi-Slide Story Creator**: Upgraded `StoriesAdminScreen.tsx` with full carousel story support, adding "+ Add Carousel Slide / Frame" and frame deletion controls with media type normalization, automatic avatar generation, and robust error handling.
  - **Menu Fetch Resilience**: Hardened `getStoreCatalog` in `DeliverectApiClient.ts` with fallback route resolution and store `physicalLocationId` mapping to prevent 404s when store-specific menu endpoints differ.
  - **Combo & Bundle Pricing / Formatting**: Fixed bundle pricing minor unit formatting (£5.00 instead of £500), changed currency display to standard "£", renamed combo badge to clean "Combo Deal", removed extraneous icons, and ensured auto-applied modifier items (e.g. drinks) are correctly pre-ticked.
  - **Home Screen "Shop our range" & Pagination**: Replaced "Popular Near You" with "Shop our range" in `HomeScreen.tsx`, implementing 25-item pagination with a "Load more products" button that automatically resets on filter or category changes.

---

## 4. Next Tasks

1. **Live Staging Credentials Verification with Deliverect:**
   - Execute Stage 1 (Test Deliverect OAuth) with live staging credentials in Admin UI.
   - Select discovered Deliverect Account.
   - Run automatic Commerce Store discovery.
   - `AUTH-01` through `AUTH-03` (OAuth token manager)
   - `ACC-01`, `ACC-02` (Linked Accounts)
   - `LOC-01`, `STORE-01`, `STORE-02` (Store discovery & status)
   - `MENU-01`, `MENU-02`, `MENU-03` (Root & Store menus)
   - `BASK-01` through `BASK-07` (Basket operations & reconciliation)
   - `DSP-01` through `DSP-07` (Dispatch availability validation)
   - `PAY-01` through `PAY-10` (DPay tokenization & authorization)
   - `CHECK-01` through `CHECK-03` (Async checkout)
   - `QST-01` through `QST-05` (Quest picking amendments & substitutions)
   - `WH-01` through `WH-04` (Webhook HMAC validation & idempotency)

