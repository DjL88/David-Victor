# Altie trusted operator

Altie is a tenant-scoped Admin assistant that combines deterministic platform actions, curated repository knowledge and a model-backed chat surface. It is **not** an unrestricted autonomous operator.

## Trust model

Authoritative identity comes from the server-authenticated tenant, actor ID and role. Prompt text, chat history, attachments and model output cannot override those values or grant capabilities.

Curated product knowledge is versioned and carries provenance/freshness metadata. Knowledge informs answers but never grants direct Deliverect, payment-provider or cloud access.

## Read path

Altie can invoke registered read-only actions through `AdminAssistantActionService`. Those actions use existing tenant-scoped platform services and return explicit evidence/provenance rather than fabricating unavailable data.

## Trusted write path

The currently executable low-risk write path is Branding:

1. interpret an allow-listed Branding intent;
2. inspect/derive a server-side proposal;
3. create a durable ChangeSet and versioned resource revision;
4. require scoped human approval with expiry/replay protection;
5. execute through the same registered Branding resource adapter used by the platform;
6. re-read persisted state and verify the expected revision;
7. emit a truthful audit receipt;
8. support rollback through a new versioned revision when the live-state conflict checks permit it.

Unsupported actions remain fail-closed. Altie does not directly call provider mutation APIs.

## Navigation safety

Admin navigation targets are allow-listed and selector-safe. Delayed prefill/highlight timers are cancelled on new assistant navigation, manual page changes, identity changes and unmount so stale tenant/page context cannot act later.

Navigation/prefill remains a UI aid; it is never reported as a saved change.

## Failure semantics

- expired or replayed approvals are rejected;
- tenant/action scope mismatches are rejected;
- unsupported actions have no synthetic write path;
- persistence verification failure is reported as potentially-applied and not retry-safe;
- if the verification-failure audit receipt itself cannot be persisted, the route returns an explicit audit-receipt failure rather than claiming a complete receipt;
- unknown operational data remains unknown.

## Remaining limits

- Branding is the intentionally narrow executable resource adapter; other write categories require their own reviewed adapters and tests before they can be enabled.
- Runtime/browser behavior and live AI/provider behavior must be reported separately from repository CI.
- Altie does not receive provider credentials, raw customer exports or unrestricted workspace access.

## Evidence

The server/Admin tests cover tenant/role authority, prompt-injection boundaries, curated knowledge, proposal allow-listing, approval expiry/replay, unsupported actions, persisted verification, receipts/partial failure, rollback and navigation-target/timer safety.
