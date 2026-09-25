# Grace Altie trust evaluation

Evaluation baseline: current `main` at `09ef3699bf69bada7f04b5cc4d2d2b4f90d90948`.

Issue #232 is closed as completed. The Altie integration PRs reviewed before taking this slice were #233, #235 and #240; all are merged. No open Altie PR was returned by the repository search at evaluation start.

## Existing coverage confirmed on main

The current suite already covers several #232 trust boundaries, so this branch does not duplicate them:

- `src/admin/AltieGuidance.test.tsx`: tenant/user/role/actor-tenant context reset, same-identity context preservation, literal first-destination target lookup, missing-target fallback, no synthetic click/submit, pointer dismissal and Escape cleanup.
- `src/admin/altieGuidanceTarget.test.ts`: missing/off-screen/invalid geometry.
- `server/admin/adminChangeSetService.test.ts`: explicit approval state, independent approval for high-risk proposals, role capability checks, apply/rollback state transitions and no autonomous execution.
- `server/admin/adminResourceAdapters.test.ts`: live-state drift protection before apply/rollback.
- `server/admin/adminActionRegistry.test.ts`: credential-shaped assistant action input rejection and proposal-only capability exposure.
- `server/admin/adminAssistantChatService.test.ts`: tenant-bound instructions, draft-only guided wording and bounded history.

## New regression coverage in this branch

`src/admin/AltiePrefillRace.regression.test.tsx` drives the real production path
`AdminLayout -> AdminWorkspaceProvider.navigateTo -> handleAssistantNavigate -> showAssistantDestination`
using only synthetic identities/data and a small drawer driver.

The tests assert that a queued `admin-ai-prefill` is cancelled when:

1. the Admin workspace unmounts before the delayed prefill runs;
2. the operator leaves the target page before the delayed prefill runs.

Current `AdminLayout.tsx` schedules the prefill through nested `window.setTimeout` calls and does not retain/cancel those timer handles on page/identity change or unmount. The merged #235 documentation already identified this timer boundary as remaining work.

## Evidence status

These tests are authored and committed, but they have **not** been executed in this run.

- The branch has no GitHub Actions run because the connector blocked PR creation.
- A local checkout/test run was attempted, but this runtime cannot resolve `github.com`, so dependencies/repository checkout are unavailable.
- GitHub issue/PR comment writes were also blocked by the connector safety gate, so no owning-PR comment is claimed.
- No production file, secret, cloud/DNS setting, Deliverect setting or deployment was changed.

## Deferred rather than invented

- Approval expiry/staleness beyond live-state drift: the current code has drift protection, but no explicit approval TTL contract was found. This evaluator does not invent an expiry duration or field name.
- Reduced-motion browser behaviour: the production class is present, but no real browser media-query run is claimed.
- Prompt-injection/model-behaviour assertions: current system instructions mark attachments as untrusted data, but no live-model result is claimed from deterministic unit tests.
- Deliverect access: none was attempted; explanatory knowledge is not permission to connect.
