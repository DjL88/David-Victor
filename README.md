# LTx / Leitch Tech — White-Label Retail Commerce Platform

LTx is a multi-tenant retail commerce platform with a customer storefront, tenant administration, Deliverect catalogue/order integration, Quest picking support, payment abstraction, CMS/domain tooling, analytics and the Altie trusted-operator assistant.

## Repository map

- `src/` — storefront, Admin UI, domain models, client adapters and browser-side state.
- `server/` — Express BFF, authentication/tenant boundaries, Deliverect integration, persistence, payment/order services and Altie server actions.
- `server/admin/` — Altie knowledge/actions/ChangeSets and versioned Admin resource adapters.
- `server/deliverect/` — Deliverect Commerce/Retail/Dispatch adapters, ingestion and webhook handling.
- `src/__tests__/` and `server/**/*.test.ts` — production-path regressions and contract tests.
- `docs/ARCHITECTURE.md` — current architecture, trust boundaries and invariants.
- `PROJECT_STATUS.md` — concise current release state and explicit external/runtime evidence gaps.

## Local development

1. Install dependencies with `bun install --frozen-lockfile`.
2. Copy the required values from `.env.example` into your local environment. Do not commit credentials or provider secrets.
3. Run `bun run dev`.

## Quality gates

Before merging, run:

- `bun run lint`
- `bun run test`
- `bun run test:certification`
- `bun run build`

GitHub CI runs typecheck, the full Vitest suite, deterministic certification and the production build. A green repository gate is not the same thing as provider/runtime verification.

## Deployment

Firebase App Hosting is the supported staging/production runtime. Environment-specific configuration lives in `apphosting.yaml` and `apphosting.production.yaml`; sensitive values are referenced through Secret Manager rather than checked into source.

See `docs/FIREBASE_PRODUCTION_BOOTSTRAP.md` for production isolation and provisioning requirements.

## Compatibility policy

LTx / Leitch Tech is the platform presentation brand. Persisted collection names, public API contracts, provider identifiers and legacy analytics identifiers are kept when compatibility requires them. Compatibility aliases are documented instead of being silently renamed or removed.
