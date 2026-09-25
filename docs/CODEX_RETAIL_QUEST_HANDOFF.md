# Codex handoff: editable Retail/Quest orders

Status: HANDOFF ONLY — implementation, behavioural tests, CI and live validation are not yet complete.
Requested by the repository owner on 25 September 2026. Implement in this branch and this single PR; do not merge or deploy.
Reviewed baseline: `712a374233ff79b6ba27c769a1d2815cbc3532b6` (main when inspected). Reconcile current main, applicable AGENTS.md instructions and overlapping PRs before editing. Leave Altie, logo work and unrelated audits alone.

## Objective and evidence boundary

Retail orders reach Quest but lack amend/substitute/remove/cancel controls. The owner supplies the following diagnosis as confirmed by Deliverect engineers: generic-channel Retail submission requires the matching `.io` environment host, `x-deliverect-version: retail`, and a path routed to the Retail backend. The permitted candidates supplied are `/generic/order/{channelLinkId}` or a specifically provisioned `/{retailChannelName}/order/{channelLinkId}` where the retail channel name can be a dedicated `*-retail` application. Do not silently append `-retail` to an application name or assume the partner has provisioned a scope/route.

The owner also supplies a post-picking finalisation requirement: POST to the same resolved order path plus `/finalized`, after all amendments/substitutions have been applied. Treat these as partner-provided requirements, not as an independently observed production diagnosis. No Deliverect account or live endpoint was accessed for this handoff. The complete finalisation body, order identifier, provider idempotency and response semantics still require a documented contract or approved fixture; do not invent them.

## Findings verified in this baseline

- `server/deliverect/retailOrderEndpoint.ts`: `.io` staging/production defaults already exist. Header selection can still resolve to `{}`; default path remains `/{channelName}/order/{channelLinkId}`. Existing override validation accepts both `.io` and `.com`. Build on this resolver rather than adding another URL builder.
- `server/deliverect/DeliverectBasketMapper.ts`, `buildQuestItemUnavailableActions`: BEST_MATCH currently combines `ITEM_SUBSTITUTION` and `ITEM_SUBSTITUTION_CATALOG`; CUSTOMER_SELECTED emits `ITEM_SUBSTITUTION_CUSTOMER`; cancellation currently also permits amendment.
- `server/deliverect/RetailQuestOrderContract.ts`, `projectRetailQuestOrder`: accepts echoed action arrays or recomputes defaults. Enforce one shared outbound policy here and in the live submitter.
- `server/deliverect/DeliverectApiClient.ts`, retail submission around lines 3130–3460: `hasOnlineAuthorization` is currently `Boolean(options?.paymentId)`. It selects echoed actions, then maps lines back to inferred preferences without passing those arrays to `projectRetailQuestOrder`. That can lose a deliberately narrowed action set. Fix the live path, not just a pure projector test.
- `server/deliverect/PickingStatusIngressService.ts`, `processJob`: delegates to `WebhookService.processWebhook`. Follow the actual completed-picking/amendment/settlement processing before selecting a finalisation hook. No finalisation hook was verified in the reviewed ingress code.
- `src/commerce/deliverectChannelSetup.ts`: `resolveDeliverectCallbackOrigin` includes a global `https://ltx.wtf` default. Merely removing window.location would not establish correct per-tenant, per-environment PUBLIC_BASE_URL behaviour.

## Scope: one implementation PR

### 1. Retail endpoint and header

For `orderRoute === 'retail_quest'`:

- Default to `x-deliverect-version: retail`; retain explicit validated tenant overrides and the documented configuration precedence. The effective retail header must survive empty optional header objects unless a deliberate supported override is supplied.
- Add a separate configurable `retailChannelName` for the retail-order path only. It falls back to the current resolved `channelName`. Do not change OAuth identity/audience, registration identity, standard-channel submission or Commerce checkout as a side effect.
- Keep the path template configurable, including `/generic/order/{channelLinkId}`. Make the distinction between base channel name and dedicated retail name explicit in validation, persistence, server integration context and the Admin form.
- Use `https://api.staging.deliverect.io` for staging and `https://api.deliverect.io` for production. Surface explicitly configured non-retail/mismatched host/header settings as diagnostics rather than silently claiming Retail readiness. Preserve safe validation; do not accept arbitrary hosts, URL credentials, query strings, unsafe ports or cross-environment credential forwarding.
- Record the resolved submission target/environment and allowlisted non-secret headers with the order so finalisation uses the SAME target even if tenant configuration changes later. Never persist or log bearer tokens.
- Log the resolved URL, the value of the safe `x-deliverect-version` header, and configuration provenance for each submission. Do not dump the entire request/headers, customer details or secrets.

### 2. Unavailable-item actions

Use one shared policy across the mapper, projector and live submitter:

- Never send `ITEM_SUBSTITUTION_CUSTOMER` for this generic-channel contract.
- Never combine `ITEM_SUBSTITUTION` with `ITEM_SUBSTITUTION_CATALOG`.
- Allow substitution by default: `["ITEM_AMENDMENT", "ITEM_REMOVE", "ITEM_SUBSTITUTION_CATALOG"]`.
- Use `ITEM_SUBSTITUTION` instead of catalogue substitution only behind an explicit per-tenant capability flag and verified availability of the existing GET substitutes endpoint. Do not make a network probe part of ordinary payload mapping.
- Remove if unavailable / do not substitute: `["ITEM_AMENDMENT", "ITEM_REMOVE"]`.
- Cancel if unavailable: `["CANCEL_ORDER"]`.
- Echoed upstream actions may narrow, never broaden, trusted customer preference and enabled channel capability. Validate and intersect them; preserve an explicitly empty set instead of treating it as absent and rebuilding broader defaults. Treat absent and empty differently. Filter unsupported/unknown action values. Do not infer the customer's original preference back from the final action array.
- CUSTOMER_SELECTED needs explicit handling: removing the unsupported CUSTOMER enum must not silently broaden consent from selected substitutes to arbitrary catalogue products. Preserve only a supported candidate-constrained path or fall back to removal with a visible explanation. Document the choice and test it.
- Preserve existing quantities, bundle price protections, remarks and approved candidate constraints; do not change monetary semantics while fixing actions.

### 3. Durable post-picking finalisation

- Locate the real picking-completed transition and applied-amendment ledger. A completed-status message alone is not proof that concurrent amendment jobs finished. Use an order-scoped completion barrier/revision and durable state; do not rely on sleeps or queue arrival order.
- Add a small separate final body builder for final item PLUs, quantities, prices and reconciled totals in integer minor units. Include the provider-required order identity from an approved contract. The channelLinkId identifies the channel, not necessarily the individual order: do not omit order identity or guess how it is supplied.
- Use the recorded retail base/path plus `/finalized`, the same scoped authentication mechanism with freshly resolved credentials, and the retail header. Do not store an old bearer token with an order. Never switch to a new tenant's/environment's endpoint during retry.
- Store finalisation state, `finalizedAt`, attempts, payload/order revision and a deterministic local operation key under the correct tenant/order. Use an atomic durable claim/lease/outbox so duplicate or concurrent workers cannot independently finalise. No in-memory-only production guard.
- Mark finalised only after the contract-defined acknowledgement. Suppress further sends after confirmed success. Retry 429/5xx using bounded exponential backoff with jitter via the existing authenticated Cloud Tasks framework; respect Retry-After where applicable. Record typed terminal failures and a recoverable operator-visible status.
- "Never send twice" cannot be truthfully guaranteed by a finalizedAt boolean across remote acceptance followed by timeout/crash. Test the ambiguous-outcome window. Use provider-supported idempotency/reconciliation only if verified; otherwise retain UNKNOWN/reconciliation-required and do not blindly replay an ambiguous POST. Do not fabricate an idempotency header or a status endpoint.
- `RETAIL_FINALIZE_ENABLED`: default true for retail_quest tenants, false/not applicable outside that route; an explicit false is honoured. Keep a separate contract-readiness gate: if finalisation request/identity/idempotency semantics cannot be verified, finish the isolated builder/outbox/tests with the uncertainty explicitly blocked instead of making live guesses.
- Finalisation must occur only after required amendments and relevant settlement policy have succeeded. Preserve failed/cancelled orders and payment ceilings; do not auto-capture, create another order or manufacture POS success.

### 4. Payment truth

- Only emit `orderIsAlreadyPaid: true` and `payment.due: 0` after server-side verification of an authorised payment for this tenant, basket, currency and payable amount. A nonempty paymentId or browser flag is not proof.
- Recognise legitimately captured payments only where the existing payment contract treats them as paid; reject failed, cancelled, unrelated, insufficient or expired authorisations. Preserve approved amount ceilings.
- Refuse unpaid Retail submission by default; honour an explicitly configured `RETAIL_ALLOW_UNPAID_ORDERS=true` only through authorised configuration. In that exception, keep `orderIsAlreadyPaid: false` and a truthful nonzero due amount as applicable. Do not introduce real charges/refunds/captures during tests.

### 5. Admin setup and callback origin

- Update `src/commerce/deliverectChannelSetup.ts` and the live `DeliverectChannelSetupGuide.tsx` caller plus the existing server/config schemas as needed.
- Derive callback URLs from the server-resolved tenant/environment PUBLIC_BASE_URL, not `window.location`, forwarded headers or an unrelated global tenant origin. Validate an HTTPS origin. Missing configuration must produce a clear pending/error state rather than a fake READY URL.
- Display the resolved Retail order URL and safe header values, their configuration source, and an explicit reminder that partner provisioning is separate.
- Preserve the actual canonical registered webhook paths and HMAC/tenant routing. Fix any server registration-response URL generation sharing this issue so it agrees with the guide; do not create redundant webhook route families.
- Document that channel-link callbacks should be moved to the verified App Hosting staging origin by an authorised operator. Do not make the external change in this PR.

### 6. Behavioural tests and completion evidence

Use the actual production units and live application composition. Fake only external boundaries (HTTP server, clock, queue/storage adapter or test emulator); never replace the worker/mapper/projector/resolver under test with a test-only copy.

Required cases:

1. Real retail submitter to stubbed HTTP: `.io` environment host, generic/provisioned retail path, default/override retail header, safe header logging, tenant name precedence, escaping and non-retail regression.
2. All preference mappings, unsupported CUSTOMER filtering, mutually exclusive substitution modes, tenant flag, missing versus empty/narrow upstream actions, and no re-widening through the real submitter/projector roundtrip.
3. Verified authorised/paid payment versus missing/failed/expired/cross-tenant/cross-basket/insufficient authorisation; explicit unpaid exception retains honest paid/due fields.
4. Real signed picking ingress/worker path: no finalisation before every amendment is applied; successful finalisation exactly once under duplicate completion, concurrent delivery and worker restart; record readback verifies success.
5. 429/5xx backoff, terminal 4xx, network timeout/unknown outcome, acknowledgement-before-local-commit crash, cancellation, disabled flag and non-retail orders. Show the limits of external exactly-once guarantees rather than claiming more than the test demonstrates.
6. Admin origin ignores browser/preview origin, correctly separates tenant and environment, fails safely when missing, and displays the resolver's real outbound target/header.
7. Final body reconciles item amounts, fees/discounts and final total without floats or lost currency/exponent information; conflicting or incomplete finalisation evidence blocks safely.

Run the repository's real Bun scripts for focused tests, lint/typecheck, full tests, existing deterministic certification suite and build. Inspect package.json first. Update old tests that encode the now-rejected partner contract; do not simply delete coverage or assert source-text strings. List every changed live caller as `file:line` in the PR and distinguish locally executed tests, Actions CI and live staging evidence. CI green is not Deliverect certification.

## External operations — not delegated to Codex

- The owner proposes a separately supervised staging experiment: configure `/generic/order/{channelLinkId}` and `x-deliverect-version: retail`, then place one authorised/paid test order. Do not run it or change Admin/live settings in this task.
- Deliverect may need to provision the dedicated retail application/scope, route its order and finalized paths, associate the intended channel link and refresh its capability matrix; alternatively confirm generic-path access for this scope.
- An authorised operator must point callbacks at the verified App Hosting staging PUBLIC_BASE_URL, not an AI Studio preview origin. The exact current origin is not guessed here.
- Do not contact partner staff, publish internal names/account identifiers, alter OAuth scopes/secrets/DNS/cloud resources, merge, deploy or submit certification.

## Handoff and review expectations

Reply on this PR with a short implementation plan, then implement all unblocked work in this same branch. Identify any finalisation contract question precisely without blocking safe routing/action/payment changes. Keep incomplete behaviour clearly gated. End with changed live call sites, test commands/results, known external provisioning requirements and remaining verification gaps. Never claim that the paid test order, live Quest editability or POS release succeeded without observed evidence.
