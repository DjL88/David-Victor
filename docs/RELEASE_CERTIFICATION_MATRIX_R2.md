# Round 2 release certification matrix

This matrix separates deterministic repository evidence from runtime proof. A green CI run proves only the exact checked-out commit passed the repository gates; it does not prove browser reachability, Firebase runtime health, partner callback delivery, live payment-provider behaviour, or courier execution.

## Deterministic lanes

- Checkout and Quest: phase16 pilot, Phase 12 picking, Phase 13 settlement, Retail Quest contract, customer tracker and tracker UX. Acceptance alone must remain “placed”; real picking evidence advances preparation; quantity-changing BEST_MATCH substitution must preserve the protected original line total.
- Payments: failure truth, checkout idempotency, checkout tenant scope, payment state safety and tenant isolation. Unknown remains unknown/action-required; failed checkout must not promise no charge; provider-confirmed state must precede local state.
- Catalogue: menu ingestion, channel projection, combined storefront, scale certification and operational webhook suites. Empty/destructive/late snapshots must preserve last-known-good truth; older work must not overwrite newer state; the shipped operating ceiling is 15,000 SKUs.
- CMS and domains: tenant-switch and domain-ownership suites. Late previous-tenant results are rejected and requested, claimed, verified, HTTPS and live remain distinct.
- Customer truth: tracker, checkout hygiene and order-reference suites. Only recognised customer references are shown; opaque upstream/session identifiers and raw provider errors stay hidden.
- Altie: assistant chat, ChangeSet, resource-adapter, knowledge and navigation-safety suites. Authenticated identity is authoritative; approval is scoped/expiring/replay-safe; persisted Branding is verified; unsupported writes remain unsupported.
- Dispatch: Phase 8 and orchestration suites. The verified live boundary is availability validation. Live courier assignment and dispatch-job cancellation remain unsupported until independently proven.
- Accessibility/localisation: story-viewer accessibility, tracker UX, checkout-hygiene dictionaries and locale suites. Narrow-device pixel rendering remains a browser/mobile smoke obligation rather than a CI claim.

## Exact-head gate

Every release-candidate PR must pass typecheck, full Vitest, the deterministic certification subset and production build on the same exact head.

PilotValidationRunner is deterministic demo evidence only and must not be described as staging/runtime proof. Staging smoke should use harmless read-only endpoints and customer journeys only when the verifier network can actually reach the declared origin. Network/DNS unreachability is UNVERIFIED, not an application failure.
