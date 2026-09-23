# Storefront UX & Localisation Audit — 23 September 2026

## Goal

Make the white-label storefront consistent across mobile and desktop, CMS-driven where appropriate, and localisation-ready rather than relying on hard-coded English.

The operating rule for localisation is:

> tenant enables languages → customer chooses from those languages → UI uses typed translations → CMS resolves content for that locale → tenant default is fallback → en-GB is final fallback.

## First implementation slice

This branch implements:

- tenant-scoped enabled storefront languages
- default language configuration in Admin > Branding
- locale-aware Account UI
- consistent Account content across mobile and desktop using the same responsive cards
- CMS pages selectable by language
- CMS pages can explicitly opt into Account > Information & Policies
- Account policy pages resolve selected locale → tenant default → en-GB
- editable customer support email, phone and support hours
- locale-aware currency/date formatting helpers for subsequent storefront migration
- persistent floating Ask Admin AI launcher

## Storefront audit

| Area | Current state | Main follow-up |
|---|---|---|
| Header / navigation | Strong responsive foundation; some labels already translated. | Finish audit of desktop header/store controls and remove remaining hard-coded labels. |
| Home | Strong commerce/UI structure. | Localise promotional controls, catalogue errors, deal/filter labels and dynamic editorial copy. |
| Stories | Strong responsive viewer. | Localise action labels and ensure CMS/story authored content has locale strategy. |
| Banners / promotions | Functionally rich. | Localise Featured/Combo/Filter/Details controls; support locale-specific authored banner copy. |
| Aisles / categories | Strong responsive navigation. | Translate search/empty-state/navigation labels; preserve provider-translated category names. |
| Search | Core usable. | Translate placeholder, trending/empty states and search-merchandising feedback. |
| Product detail | Rich product/compliance view. | Translate nutritional/compliance/manufacturer headings and empty-media states. |
| Basket | Functionally mature. | Replace remaining hard-coded bundle/deal/savings labels with typed translations. |
| Checkout | Functionally mature but text-heavy. | Highest localisation priority after Account: many customer-facing labels still hard-coded despite translation keys already existing. Keep QA simulation controls demo-only. |
| Location / fulfilment | Good responsive modals. | Translate fulfilment, address and serviceability labels. |
| Store picker / shop info | Rich live store information. | Translate headings/statuses/services; add hygiene rating and external channel links from the Admin/location roadmap. |
| Orders | Core live order history works. | Translate customer-facing states/actions; demo scenarios remain sandbox-only. |
| Order tracking | Rich lifecycle and payment state. | Translate lifecycle/payment/picking labels and use locale-aware money/date formatters. |
| Account | **Improved in this branch.** | Later connect real saved addresses/payment methods/notification preferences as provider capabilities become available. |
| CMS pages | Durable Firestore foundation from PR #27. | Add richer translation workflow (duplicate page into another language, missing-translation health, publish grouping/versioning). |
| Favourites / Buy Again | Already uses i18n in several places. | Finish small remaining Add/Added labels and locale-aware pricing. |

## CMS/localisation model

CMS pages remain separate tenant-scoped documents per locale. Translated variants should share the same `slug` so the storefront can select the correct version without changing navigation intent.

Example:

- `delivery-information` / `en-GB`
- `delivery-information` / `fr-FR`
- `delivery-information` / `de-DE`

Account policy navigation chooses the current customer locale first, then the tenant default locale, then `en-GB`.

## Next implementation order

1. Checkout customer copy
2. Header + location/fulfilment
3. Search + Aisles
4. Product details/compliance
5. Orders + order tracking
6. Basket bundle/deal copy
7. Home/banner/story controls
8. Store information
9. Translation health in Admin/CMS (missing locale coverage, duplicate-to-language, publish grouping)

## AI-led Admin direction

The Admin Assistant remains constrained by the Action Registry / ChangeSet control plane. The floating launcher makes AI available from every Admin page without replacing deterministic controls.

Next AI UX steps:

- conversational response rendering instead of raw diagnostic JSON
- page-aware suggested tasks based on current resource
- create reviewable proposals directly from chat
- show diff/impact inline before approval
- deep-link from assistant evidence to the affected product/location/banner/page
- allow language/CMS proposals only through typed schemas and revision-backed adapters
