# Channel brand asset library

Prepared 25 September 2026.

## Final compact icon library

The app now has a dedicated 32×32 circular presentation library in `public/brand/channels/round/`.

Each channel has an individual SVG and the canonical mapping lives in `public/brand/channels/round/map.json`. The round SVGs embed the locally retained source artwork, so they remain standalone when copied or downloaded individually.

The compact set is:

| Key | Display name | Kind | 32×32 icon |
| --- | --- | --- | --- |
| deliveroo | Deliveroo | Marketplace | round/deliveroo.svg |
| doordash | DoorDash | Marketplace | round/doordash.svg |
| just-eat | Just Eat | Marketplace | round/just-eat.svg |
| thuisbezorgd | Thuisbezorgd.nl | Marketplace | round/thuisbezorgd.svg |
| lieferando | Lieferando | Marketplace | round/lieferando.svg |
| takeaway | Takeaway.com | Marketplace | round/takeaway.svg |
| grubhub | Grubhub | Marketplace | round/grubhub.svg |
| uber-eats | Uber Eats | Marketplace | round/uber-eats.svg |
| glovo | Glovo | Marketplace | round/glovo.svg |
| wolt | Wolt | Marketplace | round/wolt.svg |
| snappy-shopper | Snappy Shopper | Marketplace | round/snappy-shopper.svg |
| uber-direct | Uber Direct | Direct delivery | round/uber-direct.svg |
| jet-go | JET Go | Direct delivery | round/jet-go.svg |

### Final corrections

- **Snappy Shopper** uses the official red basket/favicon artwork on the aqua circular background requested for the UI.
- **JET Go / Just Eat Go** intentionally uses the same Just Eat presentation artwork as Just Eat.
- All compact icons share the same 32×32 circular footprint so they align cleanly when shown side by side.
- The original source assets remain separately retained under `public/brand/channels/`; the presentation layer does not replace provenance.

## Live app pathway

`src/components/MarketplaceServiceBadge.tsx` uses `badgeIconUrl` from the existing `src/commerce/deliveryMarketplace.ts` registry and renders the icon on a 32×32 circular baseline. If a presentation icon fails, the component falls back to initials while keeping the channel name visible.

`marketplaceForStore` continues to preserve canonical assigned-service identity. Display identities are not Deliverect numeric channel IDs, routing permissions or proof of service availability. Unknown numeric IDs are not guessed.

## Original source artwork

The retained source assets and source manifest remain in `public/brand/channels/` and `public/brand/channels/sources.json`.

Those source files were fetched from the companies' own public sites or linked media-kit CDNs. The new round SVGs are presentation wrappers built from those retained files.

Deliveroo's retained source is still the official 32px developer-site favicon. Uber Eats uses its published green app-icon artwork. Snappy Shopper uses the basket favicon from its own site.

## Aliases

`CHANNEL_NAME_ALIASES` and `round/map.json` include common accepted names such as:

- `Just Eat Go` → `jet-go`
- `Thuisbezorgd.nl` → `thuisbezorgd`
- `Lieferando.de` / `Lieferando.at` → `lieferando`
- `Takeaway.com` → `takeaway`
- `Snappy Shopper` → `snappy-shopper`
- `Uber Direct` → `uber-direct`

Regional JET identities and Grubhub remain separate channel keys. Bare `Uber`, `Go`, `Drive`, DoorDash Drive and Wolt Drive are not silently mapped to a marketplace product.

## Usage note

Public availability of a logo is not the same as trademark permission. Applicable partner brand rules and agreements still govern production use. The library keeps original artwork/provenance separate so assets can be reviewed or replaced without changing the channel identity map.

## Verification

Regression coverage now checks:

- all 11 original sourced assets and their provenance hashes;
- all 13 compact round icon mappings;
- Snappy Shopper's round presentation contains the retained Snappy source artwork and aqua background;
- JET Go contains the retained Just Eat source artwork;
- the React badge uses the 32×32 round icon path;
- direct-service classification remains distinct from marketplace classification;
- safe-link and failed-image behaviour remains intact.
