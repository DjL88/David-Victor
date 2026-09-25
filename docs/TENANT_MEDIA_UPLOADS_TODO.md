# Tenant Media Uploads

## Goal

Let tenant administrators manage all customer-facing media inside the app without using Firebase or Google Cloud consoles.

## Required media

- [ ] Brand logo variants for light and dark backgrounds.
- [ ] Browser favicon and app/touch icons, with generated sizes and preview.
- [ ] Storefront hero and promotional banners, including responsive crops.
- [ ] Story cards with image or video media, poster frames, ordering, scheduling, and expiry.
- [ ] Product, category, location, and campaign imagery where the catalogue does not provide an authoritative Deliverect asset.

## Upload workflow

- [ ] Provide drag-and-drop and file-picker upload controls in the tenant Admin UI.
- [ ] Validate file type, file size, image dimensions, aspect ratio, video duration, and video codec before publishing.
- [ ] Show upload progress, processing state, previews, and clear recovery errors.
- [ ] Support crop/focal-point selection and safe replacement/removal without leaving broken storefront references.
- [ ] Preserve tenant isolation in object paths and authorization rules.
- [ ] Store metadata, ownership, purpose, alt text, locale, dimensions, duration, and lifecycle state in Firestore.
- [ ] Serve immutable, cacheable renditions while keeping the Admin source asset private.
- [ ] Generate required image renditions and video poster frames asynchronously.
- [ ] Add orphan cleanup, retention, malware/content-type checks, and audit logging.
- [ ] Keep customer records regional; the approved US bucket may be used for public image/video assets.

## Acceptance checks

- [ ] A tenant administrator can upload, preview, publish, replace, reorder, schedule, and remove each supported media type entirely in-app.
- [ ] Another tenant cannot read unpublished media or change any asset it does not own.
- [ ] Storefronts receive the correct responsive asset and fallback for the active tenant and locale.
- [ ] Invalid or oversized files fail safely and do not create incomplete published records.
- [ ] Automated tests cover authorization, tenant isolation, validation, rendition state, fallback, replacement, and cleanup.
