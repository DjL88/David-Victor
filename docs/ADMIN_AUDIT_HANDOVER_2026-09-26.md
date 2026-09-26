# Admin and Altie audit — 26 September 2026

User requested complete live Admin/rule/flag testing, CMS storefront placement, mobile layouts, and Altie without mandatory external AI. Dispatch/Pay may remain explicitly unavailable. A loaded page or simulation is not end-to-end acceptance.

Base: `1eab468101efa4737685c928c7040a473a5cd48e`. Consolidates PR #305 Altie Facts and PR #304 API error allowlisting with audit fixes. Compare before merging those branches again.

## Workers

Paused all 14 active LTx closeout schedules in ChatGPT; verified zero Pause controls. Prior architecture, Altie and certification conversations reviewed. External-contract gaps remain, including live Dispatch assignment/cancellation and parts of Pay. The simulated pilot runner now rejects staging/production; its tests no longer claim live certification.

## Staging evidence

Leitch Tech Non-Production, tenant `68517fde1c3ddaa7f6d0275c`, existing Super Admin login. No production changes.

- Walked all 22 existing Admin entries: page-load coverage only.
- Products: 64 products, 14 categories; Dave's Delicatessen selection resolved inventory to 15 out-of-stock / 0 unknown.
- CMS: saved draft then published `About Leitch Tech`, slug `about-leitch-tech`, Header & Footer and Account placement. Existing draft retained. Storefront menu rendered the text. Old direct `/pages/...` links failed; fixed router and added footer navigation locally.
- Stories flag: false to true, save, reload confirmed true, then saved original false. Final restored-state reload and actual content effects remain to verify.
- API Logs: both sources initially unavailable. Created the two exact indexes in `firestore.indexes.json`; both reached Enabled. Webhook history became available. Menu history needs final refresh.
- Fees: missing policy prevented setup. Fix preserves missing-policy error, shows an unsaved zero-fee form and creates first policy only on explicit successful save. No staging charges added.
- Brand storefront link incorrectly remained under `/admin`; fixed root link.

## Local changes and evidence

- Altie defaults to local guides/references and authorised reads; optional `ALTIE_AI_MODE=hybrid` permits model enhancement for unresolved questions/files. Local mode does not resolve provider secrets or construct model clients. Backend/data connections remain necessary for live reads.
- Guides cover 23 Admin entries including Super Admin Altie Facts. App/retail/Deliverect references retain provenance and audience filtering. Glossary questions cannot become arbitrary product lookups.
- Browser at 390 × 844: brand wizard fits and closes; Story modal fits with visible 44px close button; CMS document width is 390 with no overflowing main elements. Altie CMS question returned correct steps with `Local guide · no model call`.
- Bounded dynamic-height dialogs, independently scrolling body, reachable top close controls. Shared shell used by Product Rules and Stories; bounded/sticky brand/team/banner editors.
- Supplied logo used for 56px footer mark. CMS date/expiry enforced server-side, direct links and locale-aware footer/header navigation fixed. CMS now uses shared authenticated/App Check headers.
- Root browsing, collection and search-suggestion flags connected to UI. Unimplemented age/deposit/tipping switches disabled and labelled planned; actual restriction rules are separate.
- Raw menu exception strings removed from journal error fields. Unit tests no longer accidentally contact Cloud Storage (`TEST_LIVE_STORAGE` is explicit opt-in).
- Full suite: 1,274 passed, one outdated registry expectation failed; expectation updated for planned controls and focused 9 tests passed. Typecheck/build passed. Certification run completed; read log for exact total. Further Altie glossary fix requires final regression run.

## Remaining acceptance work

1. Publish consolidated code, inspect CI, deploy staging and repeat Super Admin workflows on that deployment.
2. Confirm menu journal recovery, Fees first save/reload, CMS URL/footer/locale/schedules, and flags' customer effects.
3. Complete save/reload/effect coverage for every live rule/toggle/content editor. Restore test changes. No actual paid orders or destructive actions as routine checks.
4. Test remaining mobile screens/dialogs and Altie navigation/retail/app/provider scenarios. Page-load coverage is insufficient for blanket assurance.
5. Inspect remaining prior worker outputs/open PRs for unique unfinished work. Avoid overlapping schedules.

Update this handover with exact commit, checks and deployed evidence. Report unsupported, blocked and untested behaviour separately from verified behaviour.
