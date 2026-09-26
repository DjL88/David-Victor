# LTx Project Status

**Status:** release-candidate codebase on Firebase App Hosting staging  
**Current focus:** final certification, runtime evidence and non-destructive architecture/code hygiene  
**Last updated:** 26 September 2026

## What is implemented

- Multi-tenant storefront and Admin boundaries with fail-closed tenant isolation.
- Deliverect catalogue ingestion with last-known-good protection, bounded operational state handling and source-health evidence.
- Basket/checkout/order tracking with customer-safe error states and opaque upstream identifiers hidden from customer views.
- Quest picking/substitution economics with independent replacement quantity, protected original line total and persisted finance/export evidence.
- Payment settlement safety with tenant ownership, authorization ceiling, unknown-state handling and a provider-neutral framework boundary.
- Product Rules, promotions/search merchandising and truthful Insights semantics.
- CMS Pages/Banners/Stories/Languages and domain lifecycle UI with tenant-switch fencing and unavailable-vs-empty state handling.
- Altie server grounding plus a low-risk Branding trusted-write path using durable ChangeSets, scoped expiring approval, persisted verification, audit receipts and rollback.
- Accessibility/reduced-motion handling on current storefront story flows.
- Exact-head CI gates for typecheck, full Vitest, deterministic certification and production build.

## Release evidence

Repository CI and Firebase App Hosting rollout evidence are tracked separately from runtime/browser/provider verification.

A successful App Hosting build/rollout means the exact merge SHA deployed successfully to the configured staging backend. It does **not** by itself prove browser journeys, real Deliverect callbacks, payment-provider behavior or Dispatch partner behavior.

## Intentionally unsupported / evidence-dependent

The following remain fail-closed unless a current provider contract or trusted fixture proves them:

- live courier assignment beyond verified Dispatch availability/validation;
- customer-side Dispatch cancellation cutoff/handover semantics;
- age/PIN handover semantics not represented by verified provider evidence;
- unverified payment-provider capture/void/adjustment endpoints;
- unrestricted Altie writes outside registered, capability-checked resource adapters.

## Final closeout work

1. Run the final current-head certification matrix after all merge gates settle.
2. Record any runtime/browser/mobile checks that can actually be observed from an authorised environment.
3. Perform the non-destructive architecture/hygiene pass:
   - remove only proven-dead/unplugged code;
   - retain documented compatibility seams;
   - clean proven-unused repository env/secret references without deleting external secrets;
   - simplify naming/module boundaries where behavior is unchanged;
   - keep architecture and operational docs aligned with shipped code.

Historical migration notes belong in Git history and issue/PR records rather than this status file.
