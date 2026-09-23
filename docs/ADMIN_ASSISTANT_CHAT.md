# Admin Assistant — Conversational Setup

The Admin Assistant has two deliberately separate layers:

1. **Conversation** — natural-language questions through `POST /api/v1/admin/assistant/chat`.
2. **Operational actions** — the existing typed Action Registry / ChangeSet control plane.

The conversation endpoint cannot directly write Firestore, access credentials, execute arbitrary network requests, or bypass approval.

## Runtime configuration

The server tries the following in order:

### Google AI API key

Configure either:

- `GEMINI_API_KEY` (preferred)
- `GOOGLE_API_KEY`

These are server-only secrets. Never expose them as `VITE_*` variables.

The existing `SecretManager` abstraction supports both Cloud Run secret environment variables and Google Secret Manager.

### Vertex AI

If no API key is configured and the Cloud Run environment exposes a Google Cloud project, the assistant uses Vertex AI with Application Default Credentials:

- `GOOGLE_CLOUD_PROJECT` or `GCP_PROJECT`
- optional `GOOGLE_CLOUD_LOCATION` (defaults to `global`)

The Cloud Run service account must have permission to call Vertex AI.

### Model

Optional:

- `GEMINI_MODEL`

Default: `gemini-3.8-flash`, with `gemini-2.5-flash` as a compatibility fallback.

If both a Google AI API key and a Google Cloud project are available, the server can try both provider paths. Transient failures are retried once. If every live provider/model attempt is unavailable, the drawer falls back to a clearly labelled deterministic **Guided mode** rather than stranding the user behind a generic error. Guided mode never claims live data or write access.

## What v1 conversation can do

- hold a short multi-turn conversation
- understand the active tenant, Admin page, role and selected location/resource metadata
- explain how Admin features work
- explain safe next steps
- automatically execute narrowly scoped, allow-listed **read-only** checks for relevant questions (for example product visibility/stock evidence on Products & Stock, or live location configuration on Locations)
- use those trusted read results in the answer without exposing raw credentials or granting write access
- explain that supported mutations can be prepared as reviewable proposals

## What conversation cannot do

- access credentials or secrets
- read arbitrary Firestore documents
- call arbitrary URLs
- apply writes
- issue refunds or cancel orders
- alter integrations
- claim a change happened without an explicit platform action result

The existing deterministic diagnostics remain available separately in the drawer. Automatic reads use the same Action Registry permissions and audit trail; writes still never execute from conversation.

## Next orchestration stage

The next stage can let the model select from a **server-supplied allow-list** of Action Registry tools. The server must still validate the requested action/input and execute it through the existing services. Writes must continue to become ChangeSets rather than direct model mutations.
