# Official channel artwork resource pack

Prepared 25 September 2026. This is official-source artwork for review, not a statement of trademark permission, commercial approval, provider integration certification or deployment.

## Live app pathway

`src/components/MarketplaceServiceBadge.tsx` already renders store-service badges. It now uses the extended existing `src/commerce/deliveryMarketplace.ts` registry, locally vendored assets and consistent 56px white tiles. The image is proportionally contained, never cropped or recoloured. The name stays visible and accessible. Image failure produces a text fallback instead of an empty tile. A new service resets failed-image state. External links accept only HTTP(S) URLs without credentials.

`marketplaceForStore` retains the canonical assigned service and own-platform flags. Display identities are NOT Deliverect numeric channel IDs, routing permissions or proof of service availability. No Deliverect login, database access or live third-party icon request has been added. Unknown IDs remain unknown; explicit names/aliases are mapped without concatenating unrelated fields.

## Identity map

| Key | Display name | Kind | Local asset |
| --- | --- | --- | --- |
| deliveroo | Deliveroo | Marketplace | deliveroo.png (32px source only) |
| doordash | DoorDash | Marketplace | doordash.svg |
| just-eat | Just Eat | Marketplace | just-eat.webp |
| thuisbezorgd | Thuisbezorgd.nl | Marketplace | thuisbezorgd.webp |
| lieferando | Lieferando | Marketplace | lieferando.webp |
| takeaway | Takeaway.com | Marketplace | takeaway.webp |
| grubhub | Grubhub | Marketplace | grubhub.svg |
| uber-eats | Uber Eats | Marketplace | uber-eats.webp |
| glovo | Glovo | Marketplace | glovo.svg |
| wolt | Wolt | Marketplace | wolt.webp |
| snappy-shopper | Snappy Shopper | Marketplace | snappy-shopper.webp |
| uber-direct | Uber Direct | Direct delivery | No standalone official product artwork verified; neutral text fallback |
| jet-go | JET Go | Direct delivery | No standalone official product artwork verified; neutral text fallback |

`CHANNEL_NAME_ALIASES` records accepted spellings, including `Just Eat Go` -> `jet-go`, `Thuisbezorgd.nl`, `Lieferando.de/.at` and `Takeaway.com`. Regional brands and Grubhub remain distinct identities. Bare Uber/Go/Drive and generic phrases such as 'My takeaway' do not pick a logo. Unmapped DoorDash Drive and Wolt Drive are not mistaken for their marketplace products.

## Sources and quality

Assets live in `public/brand/channels/`. `sources.json` records source page, original asset URL/archive member, original SHA256, vendored SHA256 and transformation for every logo. Originals were fetched from the companies' own public sites or their linked media-kit CDNs, not Simple Icons or AI-generated/traced copies.

Most app rasters are proportionally reduced within 256px and encoded as lossless WebP, retaining the source canvas and colour. SVG paths are preserved. DoorDash's inline SVG CSS variable is resolved to the exact official header CSS value, not a selected replacement colour. Deliveroo is currently an unchanged 32px official developer favicon: adequate for small badges, NOT a high-resolution master. Uber Eats uses its published green app-icon artwork, not a recoloured/obsolete two-tone wordmark. Snappy Shopper uses the cart icon from its own official site.

JET Go and Uber Direct have verified product names but no reviewed standalone product mark in this pack. Do not silently substitute Just Eat or Uber Eats artwork. Their fallback initials are ordinary UI text, not official logos.

## Usage review before publishing

Public availability does not grant commercial use. JET's media kit asks for permission; Uber's co-marketing guidance requests Brand Desk approval and imposes clear-space/colour rules. Confirm the applicable partner agreement/brand rules for the intended in-app use before publishing. Do not imply endorsement. Keep the original source/provenance record when replacing an asset.

- JET permission notice: https://newsroom.justeattakeaway.com/en-WW/assets/233818/
- Uber guidelines: https://merchants.ubereats.com/us/en/resources/learning-center/co-marketing-tools/
- Glovo press kit: https://about.glovoapp.com/press/
- Wolt media kit: https://press.wolt.com/en-WW/assets/225299/
- Uber Direct: https://merchants.ubereats.com/gb/en/services/uber-direct/
- JET Go: https://developers.just-eat.com/documentation/jet-go

## Verification and boundaries

New tests exercise the actual registry, asset/provenance checksums and the real React badge's image/error/direct/unknown/link behaviour. Run `bun run lint`, `bun run test`, `bun run test:certification`, `bun run build` through PR CI. Authored tests are not executed-test evidence until CI finishes. Browser/device review and brand permission review remain separate gates.

The temporary public asset discovery and SHA-pinned draft-branch import workflows/scripts have been removed. No recurring download job, repository-write workflow, new dependency, production deployment or automatic merge is retained.
