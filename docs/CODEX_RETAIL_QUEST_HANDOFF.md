# Codex handoff: LeitchTech Retail/Quest orders and substitution search

Status: HANDOFF ONLY. This document is not an implemented fix or executed test evidence.
Updated at the repository owner's request, 25 September 2026. It supersedes earlier default-name, generic-path-first and substitution-search instructions in this PR.
Reviewed main: `a86f26c196a7d58dbb4d230dbd6c4b087aedda11`. Reconcile current main, applicable AGENTS.md and overlapping PRs before implementation. Use this branch/PR; do not merge or deploy. Leave Altie and channel icons alone.

## Evidence and coordination

- Owner-supplied staging test: submission to `https://api.staging.deliverect.io/leitchtech/order/{channelLinkId}` with `X-Deliverect-Version: retail` allowed Quest editing. The supplied test was unpaid; this distinguishes Quest editability from our separate payment-safety policy. No live request was made by this handoff task.
- Owner confirms the final retail application/path name is `leitchtech`. Do not invent a `-retail` suffix or change OAuth scope/audience from this name alone.
- The supplied traces show both applications invoking the same Deliverect-internal substitute-search route. Our example includes `searchPhrase=nuts&isSubItem=false` and returns HTTP 200 with `[]`; the comparison example has no search phrase and its response body was not supplied. This does not establish which downstream source was used or that identical searches were compared.
- Owner-supplied partner guidance: `ITEM_SUBSTITUTION` selects the channel callback; `ITEM_SUBSTITUTION_CATALOG` selects Deliverect catalogue search. Treat this as the integration-specific requirement, not as something proven by the internal GET alone. The internal route is diagnostic evidence, NOT a public integration endpoint to call or copy into configuration.
- A missing callback log is inconclusive: wrong callback origin, gateway rejection, incomplete logs or a request never reaching this deployment are alternatives. Confirm the exact stored actions for the order line and correlate provider outbound-callback evidence before attributing an empty result to catalogue configuration.
- Public general action documentation still shows CUSTOMER and combined substitution actions: https://developers.deliverect.com/page/retail-orders-item-unavailable-actions . Record that conflict; do not use this generic example to undo the owner's more specific channel requirement.
- Public HMAC documentation specifies empty-string payload signing for GET: https://developers.deliverect.com/reference/hmac-authentication . It also documents pre-certification staging temporary keys. Preserve strict environment/profile gating and do not infer a production key from a URL identifier.
- PR #247 overlaps routing, callback origins, Admin headers and assignment display. Reviewed head: `dc8ee4de2862851356f28e4e9c96da2a84a9cd40`. Its actual diff retains `/{channelName}/order/{channelLinkId}` despite a stale description mentioning `/generic`. It adds a default retail header, but `headers: {}` still removes that default. Its request/runtime-origin-first callback change conflicts with the owner's server-configured PUBLIC_BASE_URL requirement. Coordinate these files rather than overwrite that PR or duplicate its work. Preserve #245's tenant commerce-data restoration.

No customer names, emails, IP addresses, trace IDs, actual order/item/channel identifiers, credentials or raw operational exports are included in this handoff or permitted as fixtures.

## Current code findings

- `server/deliverect/retailOrderEndpoint.ts` already defaults the environment host to `.io`; main can still resolve no version header. Keep one URL resolver.
- `server/deliverect/DeliverectBasketMapper.ts::buildQuestItemUnavailableActions` combines SUBSTITUTION/CATALOG for BEST_MATCH and emits CUSTOMER for CUSTOMER_SELECTED.
- `server/deliverect/DeliverectApiClient.ts::submitRetailOrder` selects echoed actions, then reconstructs preferences without passing those narrowed arrays to `projectRetailQuestOrder`. Its paid flag uses paymentId presence, not independently verified authorisation.
- `server/api/v1Router.ts::handleSubstituteCallback` around lines 3438-3535 reads orderId/channelOrderId/plu but does not pass searchPhrase/isSubItem to the service. It resolves an order before authentication and treats a fallback route identifier as a literal tenant ID. Its staging-key fallback depends on a found order projection.
- `server/deliverect/SubstitutionCallbackService.ts` returns/re-ranks existing candidates; it does not generate store recommendations or filter on a search phrase. It contains an unscoped adapter fallback and global correlation lookup that must not become cross-tenant data paths.
- `server/deliverect/PickingStatusIngressService.ts::processJob` delegates to the real webhook worker. Trace amendment processing and settlement before choosing the finalisation hook; completion arrival alone is insufficient.

## 1. Retail endpoint, configuration and submission

For `orderRoute === 'retail_quest'`, implement the owner-confirmed defaults:

```text
staging:    POST https://api.staging.deliverect.io/leitchtech/order/{channelLinkId}
production: POST https://api.deliverect.io/leitchtech/order/{channelLinkId}
header:     x-deliverect-version: retail
finalise:   POST {recordedSubmissionUrl}/finalized
```

- Add/use a separately configurable retailChannelName in the integration profile and resolver; default it to `leitchtech` for this generic Retail integration. Do not silently repurpose the legacy channelName, credentials, registration identity, OAuth scope/audience or Commerce checkout.
- Retain explicit validated tenant/environment overrides and path-template support, including `/generic/order/{channelLinkId}` when explicitly configured. No automatic path retry or fallback after an ambiguous order POST.
- Empty optional headers must not remove the retail default. An incompatible version/host setting must produce an explicit configuration diagnostic, not a false Retail-ready state. Preserve validation, HTTPS, environment isolation and safe placeholder escaping; reject arbitrary hosts/ports, URL credentials and unsafe paths.
- Show effective URL, retail header and configuration source in Admin. Record the resolved submission target/environment with the order for later finalisation; store no bearer token.
- Log resolved URL and allowlisted non-secret header values only. Never dump request bodies or authentication headers.

## 2. One restrictive unavailable-action policy

Share the same policy through mapper, persisted basket/order, actual submitter and projector. Do not infer a customer's preference back from the action array.

| Customer intent | Outbound actions |
| --- | --- |
| Best match / general substitution allowed | ITEM_AMENDMENT, ITEM_REMOVE, ITEM_SUBSTITUTION_CATALOG |
| Customer-selected candidates, channel callback enabled and ready | ITEM_AMENDMENT, ITEM_REMOVE, ITEM_SUBSTITUTION |
| Remove if unavailable / do not substitute | ITEM_AMENDMENT, ITEM_REMOVE |
| Cancel if unavailable | CANCEL_ORDER |

- Never send ITEM_SUBSTITUTION_CUSTOMER for this generic-channel contract. Never send SUBSTITUTION and CATALOG together.
- Callback mode needs explicit tenant capability/readiness configuration; do not synchronously probe the network during payload mapping. A selected-only preference must not silently become arbitrary catalogue consent when the callback is disabled or a candidate is missing.
- Persist all customer-approved candidates, order-line correlation identifiers and applicable price/quantity constraints before submission. Stop sending substituteCandidate in the order by default; retain it only under a separately approved compatibility flag.
- Intersect echoed upstream restrictions with trusted customer policy and enabled channel capabilities. Explicit empty arrays stay empty; absent is not empty. Drop unsupported actions and preserve narrow arrays all the way into the final HTTP payload.
- Keep remarks, quantities, bundle pricing protections and integer monetary semantics unchanged.

## 3. Public substitute callback: scope, search and observable outcomes

Extend the existing handler/service, not the private Deliverect service or an unrelated new route family.

### Contract and input

- Accept bounded scalar searchPhrase and isSubItem, plus existing orderId/channelOrderId/plu parameters. Keep documented/observed legacy aliases; support q/search/term only through an explicit normalisation policy with deterministic precedence.
- Parse isSubItem strictly: the string "false" is false, not Boolean("false"). Reject duplicate/array/object-valued ambiguous identifiers and malformed booleans. Bound query length and result limit (maximum 20).
- An internal Deliverect order-item ID is not a PLU. Resolve line IDs and sub-items through actual persisted correlation. Do not reinterpret an opaque item ID as a product code or silently substitute a parent item.
- The supplied internal route does not establish Deliverect's outbound path, order ID, query forwarding or response envelope. Keep that boundary configurable and explicitly pending a redacted partner outbound request/response fixture.

### Tenant resolution and authentication

- Resolve a route-bound candidate tenant/profile/store from the existing registered webhook identifier or a unique persisted accountId/channelLinkId binding BEFORE accessing an order projection. Do not treat every external identifier as a tenant ID.
- Account/channel links may be ambiguous across tenants or stores. Require explicit route/profile binding or another independently verified discriminator; reject ambiguity instead of choosing the first match, scanning tenant secrets or using brand-alpha/default adapters.
- Verify GET HMAC against the resolved tenant/environment profile using the empty-string payload and constant-time comparison with strict signature syntax. An existing pre-certification staging temporary key may be used only when explicitly enabled for that profile/environment and taken from trusted persisted configuration; never in production or simply because a caller supplied a channel ID. Keep legacy signing modes separately controlled; do not auto-detect permissive alternatives in live mode.
- After authentication, correlate either our channelOrderId or Deliverect's external order ID WITHIN that scope, then enforce the order's channel/location and source-line binding. No global lookup may return another tenant's order or candidates.
- Unknown order + known unique channel must still resolve/authenticate correctly. This does not manufacture the missing line, stock, price or customer consent. With insufficient item context return a successful empty candidate list and a typed internal reason; never fetch another tenant's order or fabricate a BEST_MATCH policy. Store recommendations without an order require enough authenticated source-item context and explicit policy.
- Reject invalid/missing signatures, forbidden/ambiguous scopes and malformed requests appropriately. Only legitimate no-results are HTTP 200; do not disguise authentication or upstream outages as successful empty searches.

### Candidates and search

- Start with saved customer candidates in their approved order; preserve quantity and permitted-price constraints. Then add deterministic store-available recommendations where the customer's actual consent permits them. A selected-only preference is not permission to add arbitrary alternatives merely because they are labelled recommendations.
- General recommendations come from the same tenant/store catalogue, active, ranged, in stock and not snoozed. Exclude the original item and duplicate PLUs. Match category, known size/unit and permitted price constraints without guessing unknown data. Respect any existing allergen/age restrictions and payment ceiling; a similarity price band is not authorisation for an uplift.
- Without search, saved eligible candidates precede eligible recommendations. With searchPhrase, case-insensitively filter eligible candidates by name/brand/PLU and keep saved-first order among matches. A saved candidate that does not match the search is not silently inserted as a search match.
- Return at most 20 items with verified {plu, name, price, quantity}, integer nonnegative minor-unit prices, valid quantity, and currency/exponent handled by existing money code. Do not hard-code GBP, silently convert major to minor twice, or default an unknown price to zero.
- Response envelope is an explicit per-profile choice: BARE_ARRAY => [...], SUBSTITUTE_ITEMS => {"substitute_items":[...]}. Preserve BARE_ARRAY for existing configurations until a partner-approved fixture authorises another shape. Empty results use the selected envelope; never switch envelopes based on whether there are results.
- Keep the callback on bounded, cached/local catalogue reads where possible; avoid unbounded sequential live calls. Target sub-second handling, but report measured latency and degradation honestly rather than promise it.

### Observability

Emit one structured completion record for EVERY callback, including early rejection and exceptions: request/correlation ID, method, registered route template, sanitised path/query shape, signaturePresent boolean, resolved tenant/environment/profile (when available), resolved order ID type, resolution outcome, candidate source, count, status and duration.

- Preserve useful contract diagnostics without logging raw originalUrl/query/header dumps. Allowlist and bound query fields; redact signature/token/authorization/customer values and hash opaque order/item identifiers. Raw search phrases may contain personal data: log length/hash by default and allow bounded redacted text only in explicitly enabled short-lived staging diagnostics. Never log signature values, bearer tokens or customer candidate lists.
- Log reasons such as ORDER_NOT_FOUND, LINE_NOT_RESOLVED, CALLBACK_DISABLED, NO_MATCH, CATALOGUE_UNAVAILABLE and INVALID_SIGNATURE distinctly. These are internal diagnostics, not permission to expose order existence or customer data.
- Correlate provider outbound traces with our inbound completion records. No inbound record alone does not prove catalogue mode.

## 4. Finalisation and payment safeguards

- Preserve the original finalisation scope: execute after PICKING completion AND the order-scoped amendment barrier/revision is complete, using the recorded submission URL plus `/finalized`, matching profile/environment authentication and retail header.
- Isolate the final body builder. Final lines/totals must reconcile in integer minor units. The channelLinkId is not the order ID; obtain the exact finalisation body, order identity and acknowledgement from an approved contract. These internal search traces do not validate finalisation semantics.
- Use durable tenant/order outbox state, atomic claim/lease, attempts, payload revision and finalizedAt. Suppress duplicate/concurrent sends after confirmed success; do not use in-memory-only guards.
- Retry safely retryable 429/5xx using authenticated Cloud Tasks, bounded backoff/jitter and Retry-After. A timeout or acknowledgement-before-local-commit crash can have an unknown remote outcome: use documented provider idempotency/reconciliation if available, otherwise mark UNKNOWN/review-required rather than blindly repeat a possibly completed POST. Never claim a local boolean guarantees remote exactly-once execution.
- RETAIL_FINALIZE_ENABLED defaults true for retail_quest, not applicable for other routes, with explicit false honoured. Contract readiness remains a separate fail-closed gate; do not guess external request fields to satisfy the flag.
- Only emit orderIsAlreadyPaid:true/payment.due:0 after verified tenant/basket/currency/amount payment authorisation (or a valid captured state under the existing payment contract), not paymentId presence. Unpaid submission is refused unless RETAIL_ALLOW_UNPAID_ORDERS is explicitly enabled; retain truthful unpaid fields then. The owner's successful unpaid editability test does not authorise removal of this policy.
- Do not charge, capture, refund, recreate orders, release a cancelled order or claim POS success in test/handoff work.

## 5. Callback URLs and Admin integration

Use the server-resolved tenant/environment PUBLIC_BASE_URL in the guide AND registration response. It must identify the verified App Hosting staging origin for staging; production is independently configured. No AI Studio preview origin, browser-origin priority, arbitrary forwarded-header origin, unrelated global default or private Deliverect service address.

Validate HTTPS origin and exact configured environment/tenant binding. Missing configuration produces a clear not-ready state. If a staging fallback is retained after coordinating #247, it must be an explicitly configured/allowlisted App Hosting origin, not whatever host happens to receive the request. Keep canonical route paths and show the actual resolved retail endpoint/header. An authorised operator, not Codex, changes channel-link URLs externally.

## 6. Required behavioural acceptance cases

Test actual production mapper, projector, submitter, Express route, signature verifier and worker; control only external storage/HTTP/clock/queue boundaries. Do not mock the unit or verifier under test, copy its logic into tests, or use source-string assertions as behavioural evidence.

1. Real submitter uses staging/production .io + leitchtech + retail header; profile overrides work; headers:{} retains default; generic path remains explicitly configurable; non-retail route is unchanged.
2. Preference matrix above, no CUSTOMER, no combined modes, callback-readiness gating, selected-only consent, missing/empty/narrow echoed actions surviving the actual mapper-submit-projector roundtrip.
3. Signed empty-body GET with searchPhrase returns only matching eligible candidates, saved choices first, max 20; name/brand/PLU are case-insensitive; output money/quantity are valid.
4. Unknown order with authenticated unique channel resolves without a projection; insufficient line context yields the configured empty envelope and logs its reason. Both external and channel-order IDs map only inside the same tenant/store. Known cross-tenant orders never leak.
5. Correct handling of isSubItem=false/true, internal line IDs versus PLUs, unsupported sub-item mapping, duplicate query keys, untrusted scope hints and ambiguous reused channels.
6. Signature missing/invalid/wrong tenant, strict hex checks, profile-gated staging key, no production temporary key, no fallback to a default tenant or another secret.
7. No results is 200 [] or 200 {substitute_items:[]} according to the profile; malformed/auth failures and catalogue outages retain truthful error semantics. Logs are emitted for success/empty/early rejection/error and contain no tokens/signatures/customer data/raw query injection.
8. Recommendation dedupe, store availability/snooze/stock constraints, missing prices, currency mismatch, all saved candidates retained in approved order, no unapproved alternatives or amount uplifts.
9. Real completed-picking worker finalises only after all amendments; duplicate/concurrent/restarted processing does not resubmit after confirmed success. Cover 429/5xx, terminal failures, timeout/unknown outcome, cancellation, disabled flag and non-retail orders.
10. Verified payment versus a bare paymentId, failed/expired/other-tenant/other-basket/insufficient authorisation; explicit unpaid exception remains truthful.
11. Admin and registration use configured PUBLIC_BASE_URL; reject/ignore attacker-controlled Host/X-Forwarded-Host and browser preview origins. No fake READY URLs.

Use only synthetic identifiers/catalogues. List every changed live caller as file:line. Run actual package.json scripts for focused tests, typecheck/lint, full tests, existing deterministic audit suite and build. Distinguish authored tests, executed tests, CI and live partner evidence. Update obsolete contract expectations without deleting useful coverage. Documentation-only CI is not implementation validation or Deliverect certification.

## Handoff / external decisions

Post a short plan, coordinate #247 and implement safe unblocked work in this same branch/PR. Keep contract-dependent callback parsing/envelopes and finalisation explicitly gated until the actual partner outbound request/response and finalisation fixture are confirmed. No live Deliverect/retail API access, secret/DNS/cloud changes, paid test orders, partner contact/provisioning, merges, deployment or certification submission.

Outstanding partner evidence: exact outbound callback URL/path/query and signing profile; forwarded order and line identity; response envelope; catalogue search scope for this account/location; finalisation body/order identity/acknowledgement/idempotency. The permanent app name is no longer an open naming question: the owner confirmed leitchtech. Do not infer current Codex execution from an @mention; the last observed bot reply requested a repository environment.
