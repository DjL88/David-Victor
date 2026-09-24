# LT Firebase / GCP production bootstrap

The application has two logical deployment environments and they must never share
Firebase/GCP data or secrets:

- `nonprod` → Firebase alias `lt-nonprod`
- `prod` → Firebase alias `lt-prod`

If those exact globally unique project IDs are unavailable, change the aliases in
`.firebaserc` before provisioning. Do not point either alias at the legacy
`hi-domino-d0abb` project.

## Required isolation

Each environment owns its own Firestore database, Storage bucket, Firebase Auth /
Identity Platform configuration, App Check configuration, Secret Manager secrets,
Cloud Tasks queues and runtime service account. Promote the same application image;
do not promote data or secrets between projects.

Production App Hosting is configured to require an ACTIVE
`integrationProfiles/{tenantId}__production` document and only permits the
`production` tenant environment. Staging permits only `staging`.

## Runtime configuration

Populate the production App Hosting secret references declared in
`apphosting.production.yaml`:

- `firebase_project_id`
- `firebase_storage_bucket`
- `firestore_database_id`
- `public_base_url`
- `cloud_tasks_sa_email`
- `cloud_tasks_audience`
- `channel_menu_tasks_queue`
- `channel_realtime_tasks_queue`
- `firebase_web_api_key`
- `firebase_auth_domain`
- `firebase_messaging_sender_id`
- `firebase_web_app_id`

Browser Firebase configuration is injected at build time from those secret
references plus the dedicated project/bucket values. Production also sets
`VITE_APP_MODE=production`, so the browser fails closed instead of silently
falling back to the checked-in preview project. The checked-in
`firebase-applet-config.json` is a non-production AI Studio fallback only; server
runtime environment values take precedence and production fails closed if it
resolves to a listed legacy project.

## Tenant integration profiles

Use one document per tenant and environment:

`integrationProfiles/{tenantId}__{staging|production}`

A production profile must be ACTIVE before the production runtime will use it.
Credential references belong in Secret Manager; recommended names are:

`lt--{tenant-slug}--{environment}--{purpose}`

The profile stores references, never secret values. Keep Deliverect account,
channel, allowed channel links, Retail endpoint policy, DPay environment and the
canonical public integration base URL in the environment-scoped profile.

## Deployment safety

Use explicit project aliases:

```sh
firebase use nonprod
firebase deploy --only firestore:rules,storage

firebase use prod
firebase deploy --only firestore:rules,storage
```

Never make `prod` the implicit/default Firebase project on developer machines.
