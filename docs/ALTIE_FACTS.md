# Altie Facts and the LTx reference starter

## Local-first chat

Admin chat defaults to local page guides, authorised reads and reviewed reference facts. No external model is required for these paths. Set server-side `ALTIE_AI_MODE=hybrid` only to opt into model enhancement for unresolved questions and attachments. Local mode reports unknown answers and does not send files to a model. This removes external AI dependence; live tenant data still requires the app backend.

This is a reference/grounding feature, not a newly trained language model or an expansion of Altie's permissions. The code must be integrated and deployed before the page is available in a given environment. Repository CI, staging deployment and observed browser/model behaviour are separate evidence states.

## Operator workflow

A Platform Super Admin opens **Platform → Altie Facts**. This starter is a **platform-wide library**, independent of the selected tenant. It is not a place to store private retailer configuration, customer records, order details or credentials.

1. Read the bundled application, retail and Deliverect reference sections.
2. Add an editorial fact, or copy a bundled section into an editable draft. Copying does not replace or disable the code-managed reference; conflicting implementation guidance needs a reviewed code/reference update.
3. Give it a short title, plain explanation, matching phrases, category and source reference. Sources are displayed as text and are not fetched automatically.
4. Choose **Super Admin only** (the default) or explicitly choose **All tenant operators**. The latter can inform answers for every tenant after publication.
5. **Save draft**. Altie still uses the previous published snapshot.
6. Compare local, saved and published content; then **Publish saved draft** and confirm its audience. A draft with unsaved edits cannot be published from the page.
7. Untick Active and save/publish to archive a fact. No history is silently deleted.

A successful publication changes what a subsequent chat request may retrieve. It does not rewrite earlier messages or erase content a previously authorised user already received. Changing tenant or actor remounts this page, cancels outstanding requests and discards its local state. Unsaved changes are not persisted across navigation or identity changes.

If a write or its acknowledgement fails, the page does not claim success or automatically retry. It preserves local edits and requires a fresh server read. An optimistic revision conflict requires comparison with the current saved draft; it must not blindly overwrite another operator's edits. **Restore published draft** restores the current published content as a new draft revision, not an arbitrary historical rollback.

## Useful first facts

A useful reference explains a concept and its limits, for example:

- “Sub” can mean a picking substitution. It does not prove customer approval or authorise a replacement.
- A retailer SKU, upstream PLU and scanned barcode are related identifiers that require an actual catalogue mapping; they are not interchangeable strings.
- An item may be not ranged, hidden by a rule, archived, snoozed or out of stock. Those are different conditions.
- A domain ownership check is not evidence that HTTPS is ready or the storefront is serving successfully.

Use matching phrases such as `sub`, `replacement`, `price protection`, or `menu push`. Matching uses whole normalised phrases; `sub` does not match `subscription`. These aliases select reference material only. They do not change storefront search synonyms, product identifiers, order economics, permissions or provider payloads.

## What is connected

```
Authenticated Super Admin
  -> AltieFactsScreen -> HttpAltieFactsClient
  -> existing Admin security + shared session/membership verification
  -> altieFactsRouter -> AltieFactsService
  -> platformKnowledge/altieFacts + immutable revisions

Authenticated chat request
  -> existing AdminAssistantChatService.chat
  -> loadAltieKnowledge
       -> existing curated page/safety topics
       -> deployed, audience-filtered bundled reference pack
       -> published, active, audience-filtered editorial facts
  -> bounded model context + existing authorised read evidence/action registry
```

The new reference loader extends the existing knowledge mechanism rather than replacing it. Explanation questions are not short-circuited into an incidental local field-prefill reply. Existing deterministic read/navigation helpers, action permissions and approved Branding ChangeSets remain separate.

The bundled pack lives in `server/admin/altieReferencePack.ts`. Its version and reviewed source commit describe the app baseline reviewed for the references; they are not a claim that the code is deployed or that a provider contract has been certified. The pack contains a dozen starter sections, not a complete codebase index. Developer architecture is Super Admin-only; ordinary operator explanations are separately scoped.

The live chat loader uses the **server-authenticated actor role**, not a role claimed in a prompt, upload, source document, page context or request body. Audience filtering covers both content and source metadata before model context or response metadata is created. An unavailable editorial store is explicitly recorded as unavailable; the loader keeps the bundled/core knowledge, not stale cached private facts or a fabricated empty editorial success.

## Data, audit and limits

The shared strict schemas are in `src/altie/knowledgeFacts.ts`:

- at most 40 editorial facts;
- at most 2,000 characters per explanation, 120 per title, 12 matching phrases and a 100,000-byte fact pack;
- up to three matching bundled sections plus three matching published editorial facts per turn, alongside the bounded existing page/safety knowledge;
- explicit category/audience/active fields; unique stable fact IDs;
- expected revision required for save, publication and draft restoration.

Current state is held in `platformKnowledge/altieFacts`. Each mutation commits the current state and a full immutable revision snapshot with actor, action and time in **one Firestore transaction**. The subcollection is `revisions`; the history endpoint returns the latest 20 summaries through a bounded single-field query. This starter has no arbitrary historical rollback UI or revision pruning job.

The existing client Firestore default-deny rule covers this root collection. Only the server Admin SDK accesses it. No new browser Firestore grant, composite index, queue, service account, provider operation or secret is added. Normal authorised use creates application data in the existing database; this PR does not provision infrastructure.

The service only uses process memory in explicit demo/test mode. Live storage errors do not silently fall back to memory or generate successful persistence receipts. Transaction-acknowledgement uncertainty is reported as unconfirmed, not “nothing changed”.

The credential-pattern validator catches obvious token/key/private-key forms and credential-bearing source URLs. **It is a heuristic, not a complete secret/PII scanner or a guarantee that arbitrary prose is safe.** Human review remains mandatory; do not paste private data. Fact text is rendered as text, not HTML, and source URLs are not automatically navigated, fetched or executed.

## Deliverect reference boundary

Official discovery sources reviewed for the starter:

- https://developers.deliverect.com/llms.txt
- https://developers.deliverect.com/page/order-status

The official index points to additional provider documentation and Markdown versions. It is an index, not a model. The starter includes bounded reviewed references and the LTx-specific interpretation; it does not import the full documentation site, follow arbitrary URLs at runtime, or enable every operation described upstream.

Always distinguish:

1. what the provider documents;
2. what the deployed LTx adapter implements;
3. what the tenant has configured/enabled;
4. what the actor is authorised to do;
5. what current operational evidence confirms.

An editorial note cannot enable live Dispatch assignment/cancellation or an unverified payment operation. Prompt instructions cannot bypass the server action registry, tenant boundaries or approval chain. Model-level instruction resistance is not an absolute guarantee; enforcement of actual actions stays in server code.

## Export and maintenance

**Export published reference** generates a private Markdown document from the same bundled pack and active published facts. Drafts are excluded. The export is Super Admin-only and can include implementation/internal editorial content; do not publish or upload it to another service without reviewing that exposure. No public `llms.txt` endpoint is introduced. `docs/altie/llms.txt` is a repository documentation index, not a browser-served knowledge endpoint.

When source behaviour changes, review the corresponding bundled explanation, provenance and tests in the same release. Do not auto-generate claims of working behaviour from filenames or an unreviewed main branch. A future schema/budget expansion needs versioning and tests; it must not silently reinterpret published facts. Tenant-specific glossary overlays, semantic/vector retrieval, automatic docs refresh, comprehensive Deliverect ingestion and historical rollback are intentionally outside this starter.

## Regression and release gate

New tests exercise the real storage service transition/transaction path, HTTP routes, authenticated client, actual React screen and actual model caller (with only the external model/provider boundary stubbed). They cover draft/archive/audience exclusion, authority spoofing, immutable audit failure, optimistic conflicts, request cancellation, old-identity responses, bounded errors and provenance. Prompt-injection tests verify context/tool boundaries; they are not a live-model security certification.

Release requires exact-head `bun run lint`, full `bun run test`, `bun run test:certification` and `bun run build`, independent review and compatibility with the chosen release base. Observe deployed Super Admin/tenant workflows separately before claiming runtime acceptance. No main/production promotion is implied by a feature PR or green tests.
