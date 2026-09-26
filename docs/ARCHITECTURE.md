# LTx architecture

This document describes the current production architecture and the boundaries that must stay true during future changes.

## 1. Runtime shape

LTx is a React storefront/Admin application served with an Express BFF on Firebase App Hosting.

- Browser entry: `src/`
- Server entry: `server.ts`
- API surface: `server/api/v1Router.ts`
- Persistent platform state: Firestore through `server/firestoreService.ts`
- Sensitive runtime configuration: Secret Manager through `server/secrets.ts`
- Environment/runtime policy: `server/runtimeMode.ts`, `server/firebaseTarget.ts`, App Hosting configs

The browser never receives provider client secrets or raw Secret Manager values.

## 2. Tenant and authentication boundary

Tenant identity is resolved before tenant-owned data is read or mutated.

- Storefront tenant: hostname/domain resolution or an explicit non-production preview override.
- Admin tenant: verified Admin identity/membership plus an explicitly resolved tenant scope.
- Platform Super Admin: may select tenant scope explicitly; a missing tenant must not silently become a retailer tenant.
- Order/payment reads: ownership/tenant checks happen before provider or financial state is returned.

Demo/test fallbacks are allowed only behind explicit demo/test runtime checks.

## 3. Commerce/catalogue flow

```
Deliverect Channel Menu Push
        |
        v
ChannelMenuIngestionService
        |
        +--> durable raw/normalised evidence
        +--> scoped hosted-menu pointer
        +--> last-known-good protection
        |
        v
DeliverectApiClient / CommerceDiscoveryService
        |
        +--> optional fresh Commerce verification
        +--> operational snooze/product state
        |
        v
BFF catalogue/search routes
        |
        v
HttpCommerceClient
        |
        v
storefront hooks/screens
```

Key invariants:

- Channel Menu Push is durable range truth.
- Partial/empty/late/error snapshots cannot destructively replace valid last-known-good catalogue state.
- Commerce/provider failure does not erase durable catalogue truth.
- Reads/writes are bounded for large catalogues.
- Money remains integer minor units plus explicit currency.

## 4. Basket, checkout and order flow

```
Storefront basket
   -> BFF basket/rules validation
   -> Deliverect Commerce basket
   -> Dispatch availability validation (delivery only)
   -> payment authorisation boundary
   -> checkout/order submission
   -> durable OrderProjection
   -> provider/Quest/webhook updates
   -> customer tracker/My Orders
```

Key invariants:

- Product Rules are enforced server-side as well as presented client-side.
- Customer-facing status is evidence-based; timers/POS/payment events do not invent delivery/handover state.
- Customer-visible references never expose opaque provider/session identifiers.
- Cancellation state, payment refund/release state and Dispatch state are separate truths.
- Unknown financial/provider outcome remains unknown.

## 5. Quest substitutions and pricing

Quest picking amendments resolve against the durable order projection.

For substitutions:

- original requested quantity and accepted replacement quantity are independent;
- the protected ceiling is the original effective **line total**, not original unit price multiplied by replacement quantity;
- replacement effective retail/promo total is calculated separately;
- customer charge is the lower of protected original effective total and replacement effective total;
- retail delta, customer delta and price-protection value remain separately persisted/reportable;
- duplicate/out-of-order amendments are idempotent/fail-closed.

## 6. Payment boundary

Payment code is provider-neutral at the platform boundary while current supported behavior remains evidence-driven.

- provider selection/config is tenant-bound;
- capability declarations describe implemented/tested LTx operations only;
- currency/minor units cannot silently change;
- provider IDs do not prove authorisation/capture/refund;
- webhook/event handling is tenant-scoped and deduplicated;
- unsupported provider operations fail closed.

No provider endpoint should be added from assumption or documentation analogy.

## 7. Dispatch boundary

Verified Dispatch availability/validation is distinct from courier assignment.

- availability/validation may return provider validation evidence;
- assignment, customer-side cancellation cutoff, handover and age/PIN semantics stay unsupported/UNKNOWN until a current contract or trusted fixture proves them;
- courier events cannot independently rewrite unrelated order/payment truth.

## 8. Admin, CMS and domains

Admin screens use tenant-scoped platform clients and fence asynchronous results across tenant switches.

CMS/domain invariants:

- unavailable is not the same as empty;
- failed saves must not mutate local UI as if persistence succeeded;
- in-flight older-tenant results cannot overwrite the active tenant;
- domain presentation distinguishes Requested → Claimed → Verified → HTTPS → Live;
- repository UI may represent/configure lifecycle state but does not claim external DNS/cloud mutation unless that action actually occurred.

## 9. Altie trusted operator

Altie has three layers:

1. curated versioned knowledge with provenance/freshness;
2. registered read actions through existing tenant-scoped services;
3. reviewed write actions through durable ChangeSets and typed resource adapters.

Current executable write scope is deliberately narrow: low-risk Branding.

A trusted write follows:

```
intent
 -> inspect
 -> server-derived proposal
 -> durable ChangeSet/revision
 -> scoped expiring approval
 -> capability-checked adapter
 -> persisted reread verification
 -> audit receipt
 -> optional versioned rollback
```

Prompt/model content cannot override tenant, actor, role or registered capabilities.

## 10. Tests and release evidence

The repository distinguishes:

- authored tests;
- exact-head CI success;
- merged SHA;
- Firebase App Hosting rollout success;
- runtime/browser/provider verification.

Do not collapse those into a single “deployed/verified” claim.

Primary gates:

- `bun run lint`
- `bun run test`
- `bun run test:certification`
- `bun run build`

## 11. Compatibility seams intentionally retained

Some legacy names remain because changing them would be a migration, not cleanup.

Examples include:

- persisted collection/API/provider identifiers;
- legacy `artie` analytics identifiers where historical continuity requires them;
- `BwydiLogo` compatibility export while callers migrate to `LTLogo`;
- explicit demo/mock adapters used only behind demo/test runtime boundaries.

Do not remove a compatibility seam merely because the name is old. Prove that no persisted/API/test/runtime caller depends on it first.

## 12. Cleanup rule

For dead-code or config removal, trace:

```
entry point -> caller/import -> service -> persistence/provider/UI effect -> tests/deployment
```

Classify candidates as:

- **SAFE_TO_REMOVE** — no production/test/build/deploy caller and replacement/ownership is clear.
- **KEEP_COMPATIBILITY** — still required by persisted/API/history/demo compatibility.
- **NEEDS_CONFIRMATION** — evidence is incomplete; document it and leave code in place.
