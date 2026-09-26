# Altie trusted operator — first visible-guidance slice

Tracks #232. This slice is guidance, not an autonomous task executor.

## Live path

`AdminAssistantDrawer` uses `useAdminWorkspace().navigateTo`.
`AdminWorkspaceContext` delegates to the existing `AdminLayout` navigation/guide
handler, then mounts `AltieGuidanceNotice`. Existing deterministic prefills and
approval/ChangeSet services are unchanged. The notice observes a real
`data-admin-ai-target` under the Admin main region and displays a non-interactive
pointer. It never clicks, fills, saves, calls a backend, or claims persisted success.
A missing/off-screen target gets an honest fallback instead of a success animation.

The pointer follows observed layout/scroll changes with a calm CSS transition;
`prefers-reduced-motion` removes that transition. The notice is dismissible, can
hide the pointer, and leaves keyboard focus to the existing navigation system.
User pointer interaction outside the notice dismisses this initial cue.

## Context isolation

The workspace is keyed by tenant, actor ID, actor role and actor tenant. A change
remounts the context and its descendants before they render under the new
identity, clearing selected resources, filters, location scope and local drawer/
form state. Ordinary page navigation retains useful same-tenant context.
Backend authentication and tenant checks remain authoritative.

## Explicit remaining work

- This notice follows the first destination only, not the full multi-step
  execution stream. Existing Next/Back controls remain authoritative. Connect
  actual step events/receipts before claiming complete watch-and-execute support.
- `AdminLayout` owns its pre-existing delayed navigation/prefill timers outside
  this context. Bind/cancel those on tenant/user/role/page change and unmount;
  this PR does not claim to fix that separate race.
- Validate all model-provided page/target identifiers at the existing navigation
  boundary. This notice uses literal attribute comparison but does not replace
  the older navigation selector implementation.
- Add reviewed before/after plans, scoped and expiring approvals, idempotent
  actions, persisted-result verification, partial-failure and undo semantics.
- Integrate a curated, versioned knowledge pack through a real server caller.
  Deliverect knowledge is not permission to connect to Deliverect, even read-only.
  Do not ingest operational exports, auth code, internal API routes or credentials
  from the uploaded dllm archive.

## Evidence

`src/admin/AltieGuidance.test.tsx` exercises the actual provider/notice via ReactDOM
and jsdom: identity changes, same-tenant context preservation, literal target
lookup, no synthetic click/submit, missing targets, pointer hiding, dismissal and
cleanup. The actual pointer geometry helper also has dependency-free regression
cases for visible, clipped, missing, off-screen and invalid targets. Browser layout,
reduced-motion behaviour and a live AI conversation still require browser
validation. Authored tests, executed tests, CI status and production deployment
must be reported separately.

