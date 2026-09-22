# Admin UX & Capability Audit — 22 September 2026

This audit reviews the current Admin screen-by-screen against the operating standard:

> load → inspect → create/edit → save → reload → disable/delete where relevant → reload → audit

Production Admin must also be honest about source and persistence. Controls must not claim success when a change is only local, simulated, or rejected by durable storage.

## Information architecture

The Admin navigation is now organised around operator jobs rather than implementation areas:

- **Platform** — Brands, Team & Access
- **Shop** — Locations, Products & Stock, Fees
- **Rules** — Product Rules, Country Rules
- **Marketing** — Branding, Banners, Stories, Search & Recommendations, Pages
- **Connections** — Deliverect Setup, Connection Status, Domains, Notifications, Media Health
- **Reports** — Insights, Audit History

Live Preview is removed from navigation. Feature Flags is removed as a standalone navigation destination because feature switches already exist inside Brands/Branding.

## Page-by-page status

| Area | Status | What is working now | Further development |
|---|---|---|---|
| Brands | **Core complete** | Real tenant list/provision/delete via Admin BFF; white-label copy; super-admin scoped. | Move destructive tenant lifecycle onto richer approval/change-set flow; add concise brand health summary. |
| Team & Access | **Core complete** | Membership list/create/revoke, role display and tenant scoping. | Proper invitation/email lifecycle, membership edit flow, identity provisioning status and capability-level role editor. |
| Locations | **Strong core** | Real location rows, search/filter/group/status, pagination, bulk selection, CSV exports, opening-hours visibility, delivery radius edit + bulk radius. | Shop-info panel with map, contact details, hygiene rating, channel links; richer bulk edits; location-group hierarchy; per-location fee/settings overrides. |
| Products & Stock | **Strong operational view** | Live provider data in non-demo mode, location/category/search filters, pagination, activity/OOS counts, exports, product diagnostics. | Keep provider-managed rather than turning into a PIM. Add source freshness timestamps and deeper visibility trace links. Live catalogue/inventory mutation should wait for an explicit provider write adapter. |
| Fees | **Core complete at tenant level** | Durable fee policy load/save with fail-closed persistence and money normalization. | Per-location/location-group overrides, distance/radius fee policies, inheritance/resolution view, revision/change-set adapter. |
| Product Rules | **Strong core** | CRUD, enable/disable, templates, real catalog tags/categories/PLUs, Where → Action editor, geography picker, courier and scheduling tabs. | Version/change-set adapter, conflict analysis, inherited scope view, clearer separation of product vs order/dispatch policy as the system grows. |
| Country Rules | **Not connected** | Honest regulatory preview only. | Durable country/region policy model, regulatory source/version metadata, enforcement in Rule Engine, audit/versioning. Editing is intentionally disabled until then. |
| Branding | **Strong / version foundation complete** | Full tenant branding, fonts/assets, durable saves, fail-closed persistence, first Assistant proposal→approval→apply→rollback adapter. | Migrate the conventional Branding screen onto the same revision/change-set path so button and assistant operations use one control plane. |
| Banners | **Core complete** | CRUD/reorder/schedule, linked product/category inventory logic and media upload. Live writes now fail closed. | Revision/change-set adapter, stronger publish/rollback history, consolidated media-health feedback inside editor. |
| Stories | **Core complete** | CRUD, location targeting, stock AND/OR matching, scheduling, multiple media frames and product linking. Live writes now fail closed; blocking alerts removed from key save/upload paths. | Revision/change-set adapter; richer media-health feedback; simplify the long editor into staged sections if usage proves dense. |
| Search & Recommendations | **Core complete** | Typo aliases, synonyms, rewrites and ranking rules; durable Firestore save now fails closed. | Version/change-set adapter, performance feedback from search analytics, test-query sandbox showing before/after ranking. |
| Pages | **Durability fixed / core usable** | Page CRUD, reusable blocks, metadata/SEO, draft/published state. This audit moves persistence from ephemeral Cloud Run disk to tenant-scoped Firestore. | Move screen networking into AdminClient/Action Registry; page revisions/publish/rollback; visual storefront preview and richer locale workflows. |
| Deliverect Setup | **Functionally rich, UX dense** | Credentials/environment flow, OAuth test, account discovery/mapping, store import, diagnostics, menu inspection and test order tooling. | Break advanced diagnostics from the primary onboarding journey; richer completion/status checklist; keep credential mutation human-only. |
| Connection Status | **Strong** | Multi-stage health view, request trace, runtime/source diagnostics. | Add links from failed stages directly to the relevant setup/location/catalog context; retain as read-only diagnostics. |
| Domains | **Core complete, cleaned** | Real AdminClient list/create/delete, tenant routing and DNS guidance. Mock tenant fallback and raw unauthenticated fetch fallbacks removed. | Domain verification lifecycle, SSL/DNS status checks and clearer pending/verified state when hosting integration supports it. |
| Notifications | **Preview only** | Rule/template/channel and live-status design preview. Cross-tenant preview leakage removed. | Durable settings backend, provider adapters (email/SMS/push/WhatsApp), delivery logs/retries and real test sends. UI now explicitly says preview-only. |
| Media Health | **Strong** | Live asset checking, failure/fallback counts, affected asset list and recheck. | Deep-link failures directly to product/banner/story/page editor; optionally scheduled/background health scan. |
| Insights | **Core usable** | Storefront/search/conversion reporting and export surface, with explicit error/retry state. | Continue validating event completeness and add provenance/freshness labels so operators know the reporting window/source. |
| Audit History | **Strong core** | Tenant audit history, assistant/human markers, reversible/reversed status and exports. | Unified Audit V2 detail view (change-set actions, approval, before/after diff), direct links to affected resources and controlled undo where supported. |
| Feature Flags | **Consolidated** | Feature switches remain available through Brands/Branding. | Remove the redundant standalone screen once no deep links depend on it. |
| Live Preview | **Retired from Admin nav** | Storefront itself remains the authoritative place to inspect the real customer experience. | Keep only as an internal developer component if still useful; do not present it as a primary Admin workflow. |

## Changes made in this audit

1. Reorganised Admin navigation into Platform / Shop / Rules / Marketing / Connections / Reports.
2. Removed Live Preview and standalone Feature Flags from primary navigation.
3. Changed the default tenant-admin landing page to Products & Stock; platform super-admin lands on Brands.
4. Removed remaining Bwydi branding from the Brands page.
5. Simplified labels across Products & Stock, Banners, Stories, Search & Recommendations, Deliverect Setup and Connection Status.
6. Removed mock tenant fallback and raw fetch fallbacks from Domains.
7. Made Notifications explicitly preview-only and stopped brand-alpha preview settings leaking into other tenants.
8. Made Country Rules genuinely read-only while no backend/enforcement exists.
9. Replaced several blocking browser alerts with inline feedback in Branding, Stories, Banners and Product Rules.
10. Hardened live Story, Banner, Search and Dispatch persistence so failed Firestore writes do not return false success.
11. Migrated CMS Pages from ephemeral Cloud Run filesystem storage to tenant-scoped Firestore; disk remains Demo/Test fallback only.
12. Capability-gated CMS read/write routes through the Admin control-plane permissions.

## Priority roadmap after this pass

### P0 — correctness / honesty
- Notification persistence + real provider adapters, or keep it preview-only.
- Country Rules persistence/enforcement before enabling edits.
- Verify all remaining Admin mutation services follow the same fail-closed rule.

### P1 — unify Admin control plane
- CMS Pages → Action Registry + revision/change set.
- Product Rules → revision/change set.
- Locations → revision/change set and grouped changes.
- Fees → scoped inheritance + revision/change set.
- Scheduling/Dispatch → revision/change set.

### P2 — operator experience
- Location shop-info drawer: map, opening hours, hygiene rating, contacts, delivery channels.
- Per-location fees and regional/location-group inheritance.
- Deep links from Media Health, Connection Status and Audit to the affected resource.
- Search query test lab and analytics feedback.
- Break Deliverect Setup advanced diagnostics into a secondary/advanced view.
