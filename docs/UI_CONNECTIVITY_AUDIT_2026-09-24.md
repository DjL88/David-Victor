# UI connectivity audit — 24 Sep 2026

Scope: current `main`, storefront + Admin. Goal: every visible control is backed by real tenant/customer data, explicitly preview-only, or removed. No fake toggles and no redundant duplicate features.

## Executive result

The core shopping journey is substantially connected: tenant resolution, locations, combined catalogue, search, basket, checkout, orders, CMS, feature switches, stores, domains, search merchandising and analytics all have live client/BFF boundaries. The remaining UI debt is concentrated in a few surfaces that look more complete than their backing implementation.

## P0 — correct before calling the UI fully connected

### 1. Customer Account exposes three non-functional management rows
File: `src/features/account/AccountScreen.tsx`

Saved Addresses, Payment Methods and Notifications open informational modal copy only. Signed-in customers cannot list, add, edit or delete anything. These are effectively fake management features.

Correction:
- either connect each row to durable customer APIs and real provider/customer state;
- or remove the rows until those APIs exist.
- Do not retain clickable management affordances that only explain that management is unavailable.

### 2. Admin Notifications is a preview tool, not a settings feature
Files: `src/admin/screens/NotificationsAdminScreen.tsx`, `src/commerce/notificationService.ts`

The page explicitly says provider delivery/durable settings are not connected. Its switches edit in-memory/session preview rules and its test button renders a local toast. It also contains a fully fabricated order/customer/store scenario.

Correction:
- remove this page from production Admin navigation unless/until durable BFF persistence + delivery adapters exist; or label/guard it as Demo-only.
- when implemented, persist tenant rules server-side and make test delivery use a real provider adapter with safe test recipients.
- delete the fabricated live-order widget from production surfaces.

Note: this screen is currently not mounted in `AdminLayout`, which is preferable to exposing it. The orphaned code should be deleted or explicitly retained under a demo/dev boundary.

### 3. Orphaned storefront preview contains a fake Add to Basket control
File: `src/admin/screens/PreviewScreen.tsx`

The preview is not mounted in current Admin navigation, but every product renders an active-looking “Add to Basket” button with no handler. A footer says actions are disabled, but the affordance is still misleading.

Correction:
- delete the orphaned screen if no longer part of the product; or
- render non-interactive product cards / disabled controls with proper disabled semantics.
- Do not create a second storefront implementation: if preview is required, preview the real storefront component tree.

## P1 — connectivity / UX correctness

### 4. Deep order URLs parse an order id but OrdersScreen ignores it
Files: `src/navigation/storefrontRouter.ts`, `src/app/AppLayout.tsx`, `src/features/orders/OrdersScreen.tsx`

`/orders/:orderId` is parsed into `StorefrontRoute.orderId`, but `AppLayout` mounts `<OrdersScreen />` without passing/resolving that id. Direct order links therefore land on the order list rather than the intended order.

Correction:
- pass `activeRoute.orderId` to OrdersScreen and resolve it from real order history/API;
- update the URL when a customer opens/closes an order;
- show an explicit not-found/unauthorised state rather than silently falling back.

### 5. Customer account CMS uses a raw fetch boundary while the rest of storefront uses clients
File: `src/features/account/AccountScreen.tsx`

Account fetches `/api/v1/cms/pages` directly and silently converts failures to an empty list. That makes “no policies” indistinguishable from a backend/auth/tenant failure.

Correction:
- use the same tenant-aware commerce/CMS client boundary as the routed CMS screen;
- show retry/error state separately from genuinely having no published pages.

### 6. Admin environment label is inaccurate
File: `src/admin/AdminLayout.tsx`

Every non-demo Admin session is labelled “Cloud Staging”, including production.

Correction:
- render the actual runtime/environment identity from trusted runtime config;
- never infer “staging” from “not demo”.

## P1 — redundant / duplicate feature surfaces

### 7. Rules are split into three navigation entries backed by one screen
File: `src/admin/AdminLayout.tsx`

Product rules, Courier settings and Order scheduling all mount `ProductRulesScreen` with different views. This is technically connected, but creates three top-level features around one rules engine.

Correction:
- keep separate entries only if users genuinely manage them as distinct jobs;
- otherwise consolidate into a single Rules workspace with Product / Dispatch / Scheduling tabs.
- Do not create separate persistence models for the same rules engine.

### 8. Feature switches are correctly centralised — keep it that way
Files: `src/admin/screens/FeaturesScreen.tsx`, `src/admin/components/FeatureSwitchesPanel.tsx`

This surface is live: it loads/saves through `defaultAdminClient`. The screen also states switches were moved out of Branding. Avoid reintroducing feature toggles into Branding or other pages.

## P2 — misleading fallback / failure presentation

### 9. Analytics turns request failure into valid-looking zero metrics
File: `src/analytics/HttpAnalyticsClient.ts`

Failed/non-OK Insights requests return a complete zero-valued dashboard. This can make an unavailable analytics backend look like a real business period with zero orders/sessions.

Correction:
- return/throw an explicit unavailable state;
- Insights should distinguish “0 real activity” from “analytics unavailable”.

### 10. Production UI still carries Demo/mock implementation files
Examples: `MockCommerceClient.ts`, `MockAdminClient.ts`, `MockAnalyticsClient.ts`, `mockData.ts`, `LiveActivityMockWidget.tsx`.

The runtime factory is correctly HTTP-first and analytics only selects MockAnalyticsClient in DEMO, so these are not automatically leaks. Keep them only behind explicit Demo boundaries and regression-test that production cannot select them.

## Connected surfaces verified in this code audit

- Storefront routing: home, search, aisle, product, basket, checkout, orders, account and CMS.
- Combined catalogue/search/basket/checkout hooks use commerce client boundaries.
- Store/location/fulfilment selection is hook/client driven.
- Order history uses the commerce client; demo scenario creation is correctly gated to Demo UI.
- CMS admin save/delete is server-backed.
- Feature switches load/save through AdminClient.
- Search merchandising loads/saves through AdminClient.
- Store configuration updates through AdminClient.
- Domains create/delete/verify through the admin client.
- Insights uses the HTTP analytics boundary outside Demo.
- Admin role/tenant identity is fail-closed outside Demo.
- Admin Notifications and Preview are not mounted in the current Admin navigation.

## Recommended correction sequence

1. Remove or connect the three Account pseudo-management rows.
2. Fix `/orders/:orderId` end-to-end.
3. Remove orphaned Notifications/Preview fake UI or make it explicitly Demo-only; do not duplicate the real storefront.
4. Make analytics failures explicit.
5. Correct Admin environment labelling.
6. Consolidate Rules navigation if user testing confirms the three entries are redundant.
7. Add a CI UI-connectivity regression that fails when production navigation mounts mock/preview-only screens or active-looking buttons without real actions.

This audit intentionally does not recommend visual redesign. It focuses on truthfulness, wiring, duplication and production-safe behavior.
