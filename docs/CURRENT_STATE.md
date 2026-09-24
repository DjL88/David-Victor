# System Audit & Gap Analysis (docs/CURRENT_STATE.md)

**Generated Date:** September 2026  
**Status:** Audit Complete — Phase 0

---

## 1. Executive Summary

A comprehensive audit of the repository was conducted against the **Multi-Tenant White-Label Retail Commerce Platform Baseline** and Deliverect integration requirements.

### Key Finding: Controlled Refactor vs. Starting Over
**Decision:** **Controlled Refactor is decisively lower risk.**  
- **Frontend UI Quality:** The existing React 19 / Vite / Tailwind CSS frontend contains high-fidelity storefront features (Location Picker, Store Discovery, Pre-store Catalog, Cart Drawer, Checkout Modal, Order Tracking, Story Viewer) and over 15 Admin Screens (Branding, Tenant Config, Fees, Product Rules, Country Rules, Stories, Domains, Insights, Audit History).
- **Backend Architecture:** Express Cloud Run BFF (`server.ts` and `server/api/v1Router.ts`) is already wired to port 3000, runs Vite in development and static bundle in production, integrates `firebase-admin` and Firestore, and supports Cloud Storage asset uploads.
- **Test Baseline:** The existing Vitest test suite runs 20 tests across 5 test suites (`checkout.test.ts`, `fees.test.ts`, `grocery_lifecycle.test.ts`, `rules_and_stories.test.ts`, `tenant_isolation.test.ts`), with `tsc --noEmit` and Vite compilation passing cleanly.
- **Starting over** would risk throwing away extensive working UI, breaking complex interaction states (e.g. meal deal engine, age gates, store-switch diffs), and introducing regressions. A **controlled refactor** preserves the UI while methodically hardening domain contracts, runtime mode isolation, Deliverect adapters, and security boundaries.

---

## 2. Implementation Gap Analysis

### 2.1 KEEP (Preserve existing working code)
- **Storefront Feature UI Components:**
  - `src/features/home/*`: `HomeScreen.tsx`, `HomeHeroBanner.tsx`, `PromotionalBannerCarousel.tsx`, `FavouritesCarousel.tsx`.
  - `src/features/cart/CartDrawerModal.tsx`: Cart display, item quantity controls, meal deal prompts.
  - `src/features/checkout/CheckoutModal.tsx`: Checkout layout, address, scheduling, delivery options.
  - `src/features/catalog/CategoryNav.tsx`: Clean category scrolling and filtering.
  - `src/features/location/LocationPickerModal.tsx`: Address search and geolocation modal.
  - `src/features/location/FulfilmentModal.tsx`: Delivery vs. Collection toggle.
  - `src/features/stores/StorePickerModal.tsx`: Store listing and candidate selection.
  - `src/features/stores/StoreSwitchDiffModal.tsx`: Store-switch warning and basket revalidation diff UI.
  - `src/features/orders/OrderTrackingView.tsx` & `OrdersScreen.tsx`: Order status timelines and tracking.
  - `src/features/stories/StoriesRow.tsx` & `StoryViewerModal.tsx`: Merchandising stories viewer with auto-progression.
  - `src/components/*`: `Header.tsx`, `MobileNav.tsx`, `ProductCard.tsx`, `QuantitySelector.tsx`, `ModalShell.tsx`, `ErrorBoundary.tsx`.
- **Tenant Admin UI:**
  - `src/admin/AdminLayout.tsx` & `AdminGuard.tsx`.
  - Admin screens for Branding, Domains, Fee Policies, Product Rules, Country Rules, Stories, Pages/CMS, Audit History, Media Health.
- **Server Foundation:**
  - `server.ts`: Dual-mode Vite middleware (dev) / Express static serving (prod) on port 3000.
  - `server/firebase.ts`: `firebase-admin` initialization, `verifyAdminSession()` with ID token verification and tenant membership lookup.
  - `server/assetService.ts`: Cloud Storage signed upload and asset metadata tracking.

---

### 2.2 REFACTOR (Modify to adhere strictly to production baseline)
1. **Runtime Mode Provider:**
   - *Current:* Defaulted to `'demo'` in `HttpCommerceClient` and `v1Router`.
   - *Target:* Exactly one `RuntimeContext` / `EnvironmentResolver` starting at `UNKNOWN`. No commerce request may instantiate a mock until explicit `demo` mode resolution. Staging and production have zero mock fallback.
2. **Eliminate Mock Imports in Production Clients:**
   - *Current:* `HttpCommerceClient.ts` directly imported `defaultCommerceClient` from `MockCommerceClient.ts` as fallback. `v1Router.ts` imported `defaultCommerceClient` for location resolution and status simulation.
   - *Target:* Ban `Mock*Client` imports from HTTP client and production server router. If Deliverect integration is unconfigured in staging, return typed `503 INTEGRATION_NOT_CONFIGURED`.
3. **Domain Models & Money:**
   - *Current:* `Money` was loosely typed (`number` or `{ amount, currency }`) with occasional floating point math. Product was a single giant interface.
   - *Target:* Strict integer minor units `Money { amount: number; currency: string }` with safe arithmetic utilities (`addMoney`, `subtractMoney`, `compareMoney`, `formatMoney`). Separate `RootProduct` (brand-level, store-agnostic) from `StoreMenuProduct` (store-specific `menuId` + `plu`, active, local price).
4. **Deliverect Domain Mapping:**
   - *Current:* Flat tenant-to-account link assumption.
   - *Target:* Explicit hierarchy: `Tenant -> DeliverectIntegration -> AccountLink[] -> PhysicalLocation[] -> CommerceStore[]`.
5. **Payment Authorisation Ceiling:**
   - *Current:* References to buffer percentages or informal safety tolerances.
   - *Target:* Remove all `10%` / `15%` buffers. Authorized ceiling must equal `reconciledBasketTotal + approvedSubstituteUplifts + configuredCatchWeightAllowance + approvedCharges`. Every minor unit must be consented to.
6. **Deliverect OAuth Token Manager:**
   - *Current:* Hardcoded production URLs in `DeliverectApiClient.ts`.
   - *Target:* Environment-aware `OAuthTokenManager` using `https://api.staging.deliverect.com/oauth/token` and audience `https://api.staging.deliverect.com` for staging, and production equivalents for production. Token cached until `expires_at` with safety buffer.
7. **Webhook Security & Ingestion:**
   - *Current:* Generic signature verification.
   - *Target:* Raw request byte capture before Express JSON parsing; `x-server-authorization-hmac-sha256` constant-time HMAC comparison; empty-payload signing for GET substitute callbacks; immutable webhook event journal and idempotency protection.
8. **Firestore Security Rules:**
   - *Current:* Allowed authenticated client reads to privileged collections (`integrations`, `auditLogs`, `tenantMemberships`).
   - *Target:* Aggressive deny-by-default on client side for all privileged collections (`integrations`, `accountLinks`, `tenantMemberships`, `auditLogs`, `webhookEvents`, `orderProjections`). Cloud Run / BFF uses Admin SDK/IAM to bypass rules.

---

### 2.3 DELETE (Remove obsolete or conflicting prototype artifacts)
- Unsolicited 10% / 15% payment buffer calculation code.
- Multi-store basket splitting assumptions (this platform strictly enforces single-store baskets).
- Direct imports of mock fixtures into HTTP / production runtime paths.
- Local fake catalogue write simulation in admin (Admin does not pretend to update Deliverect POS price/stock).
- Synthetic "radar" / fake map simulation fallback.

---

### 2.4 CREATE (Build new components for production readiness)
- `src/domain/money.ts`: Domain integer minor-unit money arithmetic and formatting.
- `src/domain/runtime.ts`: Unified runtime context (`UNKNOWN`, `DEMO`, `STAGING`, `PRODUCTION`).
- `src/domain/models.ts`: Normalized domain models (`RootProduct`, `StoreMenuProduct`, `Tenant`, `AccountLink`, `CommerceStore`, `SubstitutionPreference`).
- `server/deliverect/OAuthTokenManager.ts`: Server-side OAuth client credentials token manager with environment map and token cache.
- `server/deliverect/DeliverectContracts.ts`: Typed Deliverect API contracts and error definitions.
- `server/middleware/rawBody.ts`: Webhook raw body capture for HMAC verification.
- `docs/ARCHITECTURE.md`, `docs/DOMAIN_MODEL.md`, `docs/DELIVERECT_VERIFICATION.md`, `PROJECT_STATUS.md`.

---

### 2.5 BLOCKED BY DELIVERECT STAGING CREDENTIALS
The following cannot be live-executed until Deliverect staging credentials (`client_id`, `client_secret`) are issued:
1. Live OAuth token generation against `https://api.staging.deliverect.com/oauth/token`.
2. Live Linked Accounts API call (`GET /commerce/{accountId}/accounts`).
3. Live Commerce Stores & Menus extraction (`GET /commerce/{accountId}/stores`, `/menus`).
4. Live Dispatch availability check (`POST /fulfillment/validate`).
5. Live DPay payment request & token proxy verification (`POST /pay/channel/{channelLinkId}/payments/request`).
6. Live Quest picking webhook simulation from staging environment.

*Mitigation:* Clean adapter interfaces (`CommerceAdapter`, `PaymentService`, `DispatchAdapter`) implemented with typed `503 INTEGRATION_NOT_CONFIGURED` responses in staging/production, enabling complete frontend and BFF testing without falsifying integration success.


## Audit II work packages
- SEC-00 — Express composition extracted to `server/app.ts`; Supertest behavioural harness covers health plus authenticated admin access. (2026-09-24)
- TEN-00 — Public tenant resolution centralized: managed preview hosts are server-pinned, anonymous tenant overrides are ignored, forwarded hosts require edge proof, exact ACTIVE domains only, and tenant-varying responses emit Vary: Host. (2026-09-24)
- SEC-01 — David-Victor media proxy now serves only the configured bucket's `tenant-assets-public/` image/video objects with MIME, size, rate-limit and sandbox controls; brand guidelines are admin-only and asset IDs are UUID-backed. The shared Hi-Domino Firebase project remains test-only and unrelated legacy app storage rules are intentionally untouched; production storage isolation moves with SEC-11 to a dedicated project/provider. (2026-09-24)
