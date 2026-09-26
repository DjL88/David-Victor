# Round 2 release certification matrix

This is the target release-candidate evidence contract. It separates deterministic repository evidence from runtime proof. A green CI run proves only the exact checked-out commit passed the repository gates; it does not prove browser reachability, Firebase runtime health, partner callback delivery, live payment-provider behaviour, or courier execution.

## Required exact-head gate

A release-candidate PR is certifiable only when the same exact head passes:

1. Typecheck: `bun run lint`
2. Full Vitest: `bun run test`
3. Deterministic certification: `bun run test:certification`
4. Production build: `bun run build`

The executable `test:certification` selection must cover every lane below before this matrix can be marked complete. Removing an older certification fixture is allowed only when an authoritative current suite proves the same shipped invariant.

## Required deterministic lanes

- **Checkout → order → Quest → tracker:** Phase 16 pilot, Phase 12 picking, Phase 13 settlement, Retail Quest contract, customer tracker and tracker UX. Acceptance alone remains “placed”; real picking evidence advances preparation; a 1× original → 2× BEST_MATCH replacement must charge the protected original line total once.
- **Payment unknown/failure/idempotency/tenant isolation:** checkout failure truth, customer error hygiene, checkout idempotency, checkout tenant scope, payment state safety, final settlement and tenant isolation. Unknown remains unknown/action-required; failed checkout must not promise “no charge”; provider-confirmed state changes precede local state changes.
- **Catalogue LKG/out-of-order/15k:** Channel menu ingestion, channel projection, combined storefront, catalogue scale and operational webhook suites. Empty/destructive/late snapshots preserve last-known-good truth; older work cannot overwrite newer state; both catalogue and operational paths must exercise the shipped 15,000-SKU ceiling without weakening deterministic guards.
- **CMS/domain tenant switching:** Sprint 4 CMS/domain truth plus domain ownership coverage. Late previous-tenant results are rejected; unavailable is not silently converted to empty; requested, claimed, verified, HTTPS and live remain distinct states.
- **Customer ID/error truth:** customer tracker, checkout hygiene, failure truth, order-reference and correctness regressions. Only recognised LTx customer references are shown; opaque upstream/session identifiers and raw provider errors stay hidden.
- **Altie trusted operator:** assistant chat, ChangeSet, resource-adapter, knowledge and navigation-safety suites. Authenticated tenant/actor/role is authoritative; approval is scoped, expiring and replay-safe; persisted Branding is re-read and verified; unsupported writes remain unsupported.
- **Dispatch supported vs unsupported:** Phase 8 and dispatch orchestration. The verified live boundary is availability validation through `/fulfillment/validate`. Live courier assignment and dispatch-job cancellation remain unsupported until independently proven.
- **Mobile/accessibility/localisation:** story-viewer accessibility, tracker UX, checkout-hygiene dictionaries and locale suites. Dialog focus/Escape/Tab/reduced-motion and locale-copy regressions are deterministic. Narrow-device pixel rendering remains a browser/mobile smoke obligation rather than a CI claim.

## PilotValidationRunner acceptance

Before final certification, `PilotValidationRunner` must be aligned to current shipped semantics and must not masquerade as live staging proof. The controlled deterministic flow should prove:

- pending checkout projection;
- store acceptance without falsely claiming preparation;
- actual picking-start evidence;
- quantity-changing BEST_MATCH substitution;
- protected original-line pricing;
- exact final payment settlement;
- persisted projection truth.

Its report must make deterministic/demo evidence distinct from runtime evidence. It must not fabricate a Dispatch validation result in a collection flow, and the old unconditional health assertion must be removed.

## Runtime and external evidence

Keep these statuses separate from deterministic CI:

- **Firebase rollout/build:** a successful App Hosting check proves the exact commit built and rolled out to the named backend, not that the customer journey was reachable from the verifier.
- **Read-only staging smoke:** use harmless health/ready endpoints and browser/mobile journeys only when the verifier network can actually reach the declared staging origin. Network/DNS unreachability is **UNVERIFIED**, not an application failure.
- **Deliverect/Quest callbacks:** deterministic signed fixtures prove code behaviour; real callback delivery remains runtime evidence.
- **Payments:** deterministic adapters and contract tests prove state/safety semantics; CI is not a live payment authorization/capture.
- **Dispatch:** live availability validation can be claimed only from actual provider/runtime evidence. Courier assignment/cancellation remains unsupported until a current authoritative contract or fixture exists.

Release certification therefore reports deterministic status and runtime/external status independently. Neither substitutes for the other.
