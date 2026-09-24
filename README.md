# LT / Leitch Tech — White-Label Retail Commerce Platform

Multi-tenant storefront and administration platform with Deliverect integration.

## Local development

1. Install dependencies with `bun install --frozen-lockfile`.
2. Configure the required local environment values. Do not commit credentials or provider secrets.
3. Run `bun run dev`.

## Quality gates

Before merging, run:

- `bun run lint`
- `bun run test`
- `bun run test:certification`
- `bun run build`

The GitHub CI workflow runs typecheck, the full test suite, the deterministic certification gate and the production build. Provider/staging certification remains separate from repository CI and must not be inferred from a green local build.

## Branding and compatibility

LT / Leitch Tech is the platform presentation brand. Existing persisted collection names, public API contracts, provider identifiers and compatibility surfaces are not renamed merely for presentation branding; migrations must be explicit and backwards-compatible.

## Deployment

Production uses dedicated deployment configuration and tenant/environment integration profiles. Follow the repository production bootstrap documentation rather than relying on AI Studio preview configuration.
