# Admin Assistant Control Plane

This document describes the Admin control-plane boundary used by both conventional Admin UI flows and the context-aware Admin Assistant.

## Architecture

```
Admin UI / Assistant Drawer
        |
        | Firebase ID token + server-derived tenant
        v
Cloud Run BFF
        |
        +-- Admin workspace context
        +-- RBAC capabilities
        +-- AdminActionRegistry
        +-- AssistantChangeSet
        +-- ConfigurationRevisionService
        +-- AuditLog compatibility + AuditEventV2
        |
        v
Explicit resource adapters only
```

The assistant is not granted direct Firestore, Secret Manager, arbitrary HTTP, browser automation, or provider credentials.

## Action registry

Every assistant-visible action is registered with:

- a Zod input schema;
- one explicit capability;
- a risk classification: `READ`, `LOW_WRITE`, `HIGH_WRITE`, or `RESTRICTED`;
- preview support;
- undo support;
- an execution flag.

Assistant discovery exposes two modes:

- `EXECUTE_READ`: deterministic read-only actions that can run now;
- `PROPOSE_ONLY`: previewable write actions that can be stored as a change set but cannot execute.

Credential-shaped fields such as passwords, client secrets, API keys, access tokens, refresh tokens and authorization values are rejected before an action payload is accepted.

## Workspace context

The Admin shell carries context separately from the action payload:

- tenant;
- organisation;
- market;
- region;
- location group;
- location;
- current Admin section;
- selected resource;
- current filters;
- authenticated actor.

Tenant scope is always re-derived by the server. Model-supplied tenant identifiers do not become authorization context.

## Change sets

Assistant write requests are stored as durable `AssistantChangeSet` records under:

`tenants/{tenantId}/assistantChangeSets/{changeSetId}`

The current lifecycle supports:

`PROPOSED -> VALIDATED -> APPROVAL_REQUIRED -> APPROVED`

The broader status contract also reserves `APPLYING`, `APPLIED`, `PARTIALLY_FAILED`, `FAILED` and `ROLLED_BACK`.

Important: approval is not execution. Every persisted change set currently carries `executionEnabled: false`.

Change-set creation includes:

- immutable validated action inputs;
- actor and role;
- prompt/request;
- affected resources;
- before/after snapshots where available;
- diff and warnings;
- idempotency key and request hash;
- reversibility metadata.

High-risk approval requires `assistant.approveHighRisk`. Lower-risk approval requires `assistant.executeLowRisk`.

## Configuration revisions

`ConfigurationRevisionService` provides a generic durable revision store:

- create immutable draft;
- compute JSON diff;
- validate;
- publish with a `PublishedConfigurationPointer`;
- reject stale writers through optimistic concurrency;
- retry safely through idempotency;
- resolve the current published configuration;
- rollback by publishing a new revision containing the prior known-good payload.

Revision data is stored under:

- `tenants/{tenantId}/configurationRevisions/{revisionId}`
- `tenants/{tenantId}/configurationPointers/{resourceKey}`

A published pointer is not automatically treated as live operational configuration. Each resource must explicitly opt into the revision layer through a typed adapter before assistant execution is enabled.

## Audit

Existing `AuditLogEntry` writes remain for Admin UI compatibility.

Control-plane operations additionally write `AuditEventV2` records under:

`tenants/{tenantId}/auditEventsV2/{eventId}`

Audit V2 records actor type, action, resource IDs, change-set ID, before/after/diff where supplied, approval metadata, result and reversibility. Internal model reasoning is not stored.

## Current assistant capability

Enabled deterministic reads:

- catalogue inspection;
- product visibility diagnosis;
- store configuration inspection;
- integration/connection diagnosis.

Proposal-only foundations:

- branding;
- product rules;
- fee policies.

## Explicitly not enabled

- arbitrary Firestore writes;
- arbitrary HTTP or browsing;
- Secret Manager access;
- credential exposure;
- live catalogue/inventory mutation;
- payment/refund/cancellation side effects;
- tenant deletion;
- Team/RBAC mutation by the assistant;
- applying an approved change set without a typed versioned resource adapter.

## Next adapters

Recommended order:

1. Branding
2. CMS pages/content
3. Product rules
4. Location operational settings
5. Fee policies
6. Scheduling/dispatch configuration

Each adapter should implement preview, validation, revision creation, publish, rollback, and audit mapping before its action can move from `PROPOSE_ONLY` to executable.
