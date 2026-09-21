# Bwydi North Star (docs/NORTH_STAR.md)

**Status:** Authoritative product vision. Everything else in `docs/` (ARCHITECTURE.md, DOMAIN_MODEL.md, DELIVERECT_CAPABILITY_MATRIX.md, DELIVERECT_VERIFICATION.md, CURRENT_STATE.md, `PROJECT_STATUS.md`) describes the current implementation; this document describes the full target product it is building toward. When the two disagree, this is the direction to build in, not the current state to preserve.

**Origin:** Captured verbatim from the product owner (david.leitch@deliverect.com) on 2026-09-21 as a full-scope brief covering onboarding, customer experience, catalogue architecture, rules engine, checkout/payments/picking, admin UX, white-labeling, and the build sequencing to get there. Section 33 ("The order we should actually build it") is the load-bearing section for prioritization — read it before starting new work.

---

## 1. The North Star

Bwydi is a multi-tenant, white-label retail ordering platform powered by Deliverect.

It should not be another catalogue database. Deliverect remains authoritative for retailer/store/menu/product/price/availability/order data, while Bwydi owns the customer experience, merchandising, rules, branding, discovery, checkout orchestration, CRM and white-label layer.

The core principle is:

> Deliverect owns commerce truth. Bwydi makes that truth easy, attractive and intelligent for customers.

Staging and production should never silently fall back to mock catalogue, fake stock, synthetic totals, local baskets or fabricated integrations. Demo mode can simulate things explicitly.

## 2. Brand onboarding / Deliverect connection

A new retailer should be very easy to onboard.

A Platform Super Admin creates the brand/tenant, then connects it to Deliverect using the appropriate OAuth/Deliverect credentials, discovers the accessible Deliverect accounts and Channel Links, and explicitly selects which stores belong to that Bwydi tenant.

The tenant wall is important. Even if one Deliverect credential can see 100 stores belonging to several concepts, Brand A should only ever see the exact locations provisioned to Brand A.

So onboarding ultimately looks like:

```
Create Brand
   ↓
Connect Deliverect
   ↓
Select Deliverect Account
   ↓
Discover Channel Links / Locations
   ↓
Select all / selected / unassigned stores
   ↓
Check location health
   ↓
Configure branding/domain/rules
   ↓
Publish
```

Location health should verify things we have already discovered matter in practice: valid address, geolocation, fulfilment types, opening hours, menu, at least one orderable product, Commerce access and other required configuration.

If by "logging in via Deliverect" we mean retailer/platform onboarding, that is the intended use. Customer authentication is separate and belongs to Firebase/Auth rather than Deliverect.

## 3. Product-first customer experience

The customer experience should be product-first rather than shop-first.

The ideal entry journey is:

```
Bwydi
 ↓
Postcode / GPS
 ↓
Delivery or Collection
 ↓
discover eligible nearby stores
 ↓
show one combined shopping experience
```

The customer should not initially have to think: "Which branch do I want?"

They should see products across the relevant nearby stores, with Bwydi understanding which stores carry each product and at what price.

The root catalogue should therefore be store-agnostic, while store availability carries: ranging; price; snooze/OOS; orderability; quantity restrictions; store-specific availability.

For delivery, Dispatch eventually decides which stores can actually service the customer. For Collection, nearby collection stores are returned by distance, with the earlier target being roughly the nearest 5–10 stores and a sensible collection radius such as 20 km.

Once the customer puts the first item in the basket, Bwydi chooses/locks the fulfilment store that can fulfil that basket.

Baskets remain single-store.

Changing store later should be possible, but it must genuinely migrate/rebuild/reconcile the real Commerce basket and clearly explain products that become unavailable or change price.

## 4. Catalogue and Retail data

The long-term Deliverect architecture should move beyond relying solely on published menus.

You want to support Deliverect's retail model properly:

```
Retail Master Catalogue
        +
Location Inventory
        ↓
Deliverect
        ↓
Published Commerce menus
        ↓
Bwydi storefront
```

Master product data contains things such as identifiers, names, images, barcodes, traits, tags and product metadata.

Location inventory supplies store-level: range; availability; pricing; channel pricing; stock/OOS; quantity restrictions; deposit information.

Bwydi should never invent missing inventory information. If Commerce only exposes orderability rather than an exact count, Bwydi should show what is genuinely available rather than pretend it knows "3 left".

## 5. Categories and subcategories

The Deliverect flat/sequential category structure should be reconstructed into usable customer navigation where required.

The feature we built should support structures such as:

```
Fruit & Vegetables
   Fruit
      Bananas
      Berries
      Citrus
```

and:

```
Dairy & Eggs
   Milk
      Whole Milk
      Semi Skimmed Milk
```

Leaf navigation should not show nonsensical duplication such as:

```
All Bananas | Bananas
```

but instead use the parent as a navigational control:

```
← All Fruit | Bananas | Berries | Citrus
```

If another store introduces products/categories that are not represented in the canonical/master category scaffold, they should not accidentally attach themselves to the last sequential parent.

They fall into an automatically generated fallback such as "Other" or the more customer-friendly current idea: "Store Specials & Local Products".

If that fallback contains no products, it does not exist in the UI.

## 6. Deliverect Merchandise collections

This is a distinct requirement from ordinary categories.

Our testing suggests Deliverect's standard Commerce menu payload does not identify a category as Merchandise. A category configured as Merchandise-only disappeared from normal `categories[]`; configuring the same Deals category as Standard + Merchandise caused it to appear once as an ordinary standard category with no Merchandise marker.

So Bwydi should not infer Merchandise from category names or ordering.

The desired architecture is instead:

```
Deliverect standard categories
        ↓
Bwydi aisles / catalogue navigation


Deliverect Merchandise
        ↓
Bwydi merchandising collections
        ↓
Deals / featured shelves / campaigns / recommendations
```

We need Deliverect to confirm the supported API/resource for Merchandise.

Once exposed, Merchandise could power curated rails such as: Deals, Meal Deals, Lunch for £5, New In, Seasonal, Top Picks, Back to School, Christmas — without those collections corrupting the customer's normal aisle hierarchy.

## 7. Merchandising and CMS

Bwydi owns the digital merchandising layer.

That includes: promotional banners; stories; collections; search merchandising; recommendation rails; bundles/meal deals; campaign content; informational pages; featured products/categories.

Content should be data-driven.

There shouldn't need to be a ridiculous collection of feature flags such as "Enable Stories". If there are no active Stories, the Stories area simply doesn't render.

Likewise, dead/broken media shouldn't leave black placeholder areas. Banners and stories should render only when there is valid active content.

Media Health should proactively check configured image/video URLs and report failures.

## 8. Search and recommendations

Search needs to operate against the actual catalogue available around the customer, not a mock master list.

It should eventually support: product; brand; category; tags; dietary properties; synonyms; merchandising boosts; recommendations; recent/frequent searches.

The rules/merchandising system can influence search ranking without changing Deliverect product truth.

## 9. Basket — Deliverect authoritative

This is the immediate priority.

In Demo: `BasketService` is acceptable.

In Staging/Production: **REAL Deliverect Commerce Basket** must be mandatory.

The customer journey needs real support for: create basket; get basket; add item; increase/decrease quantity; multiple items; remove item; customer details; change store; change fulfilment; validate; reconcile; checkout.

All totals come back from Deliverect.

Bwydi can display an estimated £4.20 before a call if needed for responsiveness, but after Deliverect returns the basket: Deliverect's £4.20 is authoritative.

Money remains integer minor units throughout server/domain logic. No more ambiguity where `3` sometimes means £3 and sometimes means 3p.

## 10. Collection Checkout

Collection is deliberately the first fully supported transactional journey.

We've already proved the staging transaction:

```
real Commerce basket
    ↓
real item
    ↓
real reconcile
    ↓
third_party
isPrepaid:false
    ↓
real Deliverect order
```

Therefore customer Collection should work before we complicate it with DPay or Dispatch.

For the first production-quality flow:

```
Choose Collection
 ↓
real basket
 ↓
customer/contact details
 ↓
reconcile
 ↓
unpaid Collection checkout
 ↓
CHECKOUT_PENDING
 ↓
Deliverect checkout status/webhook
 ↓
confirmed order
```

Checkout is asynchronous. Bwydi must not interpret `POST checkout → HTTP success` as `order confirmed` until Deliverect confirms it.

## 11. Delivery Checkout

Delivery comes immediately after Collection is stable.

Delivery adds: validated delivery address; geocoding/map; eligible store/serviceability; delivery fee; courier availability; delivery ETA; delivery slots where appropriate; Dispatch.

The UI needs to be thoroughly tested for: Delivery → Collection, Collection → Delivery, change address, change store, change postcode, basket no longer serviceable, some products not available at new store.

No null-address crashes and no assumptions that every order has a delivery address.

## 12. DPay / payments

DPay comes after real Basket + Checkout + Quest are stable.

For card/payment journeys, the planned lifecycle is essentially:

```
Basket
 ↓
DPay authorization
 ↓
Checkout
 ↓
Quest picking
 ↓
items may change
 ↓
final authoritative total
 ↓
capture/settle correct amount
```

No arbitrary invented authorization buffer unless Deliverect/DPay explicitly requires one.

Unpaid Collection orders should never enter the DPay settlement workflow.

## 13. Quest picking

Quest is one of the most important differentiators for retail.

A real test should eventually be:

```
Customer orders 3 products
        ↓
Deliverect
        ↓
Quest

Item A → picked
Item B → quantity 2 becomes 1
Item C → unavailable → substitute
        ↓
Deliverect picking/amendment events
        ↓
Bwydi customer order updates
        ↓
final amount updated
```

Bwydi needs to process: picking started; item picked; quantity amended; item removed; substituted; picking complete; cancellation; final picked amounts.

For Collection: `Picking Complete → Ready for Collection`. There must be no Dispatch orchestration. And if the order was unpaid Collection: no payment capture either.

## 14. Substitutions

Customer substitution choices are a major part of the desired retail flow.

Desired options include things such as: Best match; Remove item; Specific substitute; Possibly cancel order depending on policy.

Deliverect Retail supports concepts such as item-unavailable actions and customer-selected substitute candidates, although we still need Deliverect to confirm exactly how these preferences are passed from Commerce-created orders into Retail/Quest.

Quest's substitute lookup endpoint should return actual eligible products, not a Bwydi policy object.

We can use the attached `dllm` project to inspect real `retailOrders`, `pickerStatusHistory`, item amendments and communication traces during staging tests rather than guessing.

## 15. Rules Engine

You want this to become one of Bwydi's strongest admin capabilities.

The UI concept is:

```
WHERE ...
DO ...
```

For example:

```
WHERE tag = Alcohol
AND country = Scotland
DO prevent combination discount
```

or:

```
WHERE product tag = Medicine
DO maximum quantity = 2
```

or:

```
WHERE category = Energy Drinks
DO age verification
```

Possible actions include: hide/snooze; quantity cap; combined/group quantity cap; no discount; no recommendation; no upsell; age restriction; warning; badge; prevent purchase; eligibility rule.

Product Rules and Country/Regulatory Rules should be real persisted rules evaluated server-side, not just an admin UI disconnected from checkout.

This also needs multi-country support rather than coding UK-specific regulation throughout the application.

## 16. Tags, traits and regulatory information

Raw Deliverect numeric tag IDs should never appear to customers or normal admins.

Bwydi should resolve Deliverect tag IDs against canonical definitions and expose readable concepts such as: alcohol; tobacco; vegan; vegetarian; halal; HFSS; prepared food; milk/cocoa; energy drinks; etc.

Those feed: filtering; rules; age verification; restrictions; product badges; search; analytics.

Unknown IDs belong in diagnostics.

## 17. Store / Location experience

"Store Fleet" becomes simply Locations.

Admin sees clean rows with: name; address; opening hours; status; fulfilment methods; Deliverect Channel Link; location group; menu/catalogue health; media/connection state.

There should be bulk operations and: All / Assigned / Unassigned filters, plus Select all visible.

Location groups from Deliverect/location metadata should help rules such as: Scotland, England, Wales, London, Region A, Franchise Group B — rather than admins repeatedly selecting every individual store.

## 18. Store information / store finder

Customers can use Bwydi as a proper store finder.

A location dialog/page should eventually contain: opening hours; map; address; contact details; distance; collection/delivery status; channels; food hygiene rating; relevant service information.

For UK brands, the Food Standards Agency hygiene rating integration was specifically wanted.

Where Deliverect exposes other active marketplace channels, there is also scope to provide links such as: Order on Bwydi, Deliveroo, Uber Eats, Just Eat, Visit in store — rather than pretending Bwydi is the customer's only option.

## 19. Fees

Fees should be configurable sensibly, particularly by location.

Possible fee models include: fixed service/bag fee; delivery base fee; per mile/km; delivery radius; store-specific fee; other brand policies.

Currency fields must use proper currency inputs. £0.30 must remain £0.30 rather than morphing into £0.003.

## 20. Customer accounts

Customer identity should be based around Firebase/Auth initially.

You want to support: guest checkout where appropriate; email/password; Google; other federated providers; SSO where required.

A canonical Bwydi customer profile then supports: addresses; favourites; order history; Buy Again; preferences; notification choices; loyalty identity; CRM mappings.

## 21. CRM and Loyalty

Bwydi should have adapter-based CRM/loyalty integration rather than hard-wiring one provider.

The core Bwydi customer/order profile stays consistent while retailer-specific integrations can plug in.

Later possibilities include: customer creation/update; loyalty ID; earn; redeem; offers; segments; CRM events — but this is lower priority than getting Basket → Checkout → Quest correct.

## 22. Notifications

Notifications should become event-driven from the real order state.

Supported channels are intended to include: Push / FCM; Email; SMS; WhatsApp.

Examples: Order confirmed, Picking started, Substitution requires attention, Order amended, Ready for collection, Courier assigned, Out for delivery, Delivered.

Providers should be adapters rather than scattered direct calls.

The admin should configure notifications rather than modifying source code.

## 23. White-label domains

A major goal is: adding a new brand must not require deploying another Bwydi build.

Instead:

```
shop.brand-a.com
order.brand-b.co.uk
brand-c.bwydi.com
       ↓
same Bwydi deployment
       ↓
hostname → tenant
       ↓
runtime branding/config
```

A tenant determines: logo; colours; fonts; domain; pages; stories; banners; Deliverect connection; allowed locations; fees; rules; integrations.

There must be no accidental brand-alpha fallback in production.

## 24. Branding

Brands should control their visual identity without engineering help.

That includes: logo; icon/favicon; colours; typography; optionally upload a font TTF; imagery; pages/content.

The frontend should remain one application rather than a fork per retailer.

## 25. Branded mobile apps / Capacitor

After the web/PWA experience is solid, Bwydi should be suitable for packaging through Capacitor.

The architecture remains:

```
shared React application
shared commerce/business logic
       ↓
Web / PWA
Android
iOS
```

Brand-specific builds can change: app name; icon; splash; associated domain; deep links; push credentials.

But we should not maintain a different checkout implementation for each native app.

## 26. Admin UX

Admin needs to be understandable by a retail operator, not a software engineer.

The simplified information architecture we've been moving toward is approximately:

```
PLATFORM
Brands
Team

SHOP
Locations
Products & Stock
Fees

RULES
Product Rules
Country Rules

MARKETING
Branding
Banners
Stories
Search & Recommendations
Pages

CONNECTIONS
Deliverect Setup
Connection Status
Domains
Notifications
Media Health

REPORTS
Insights
Audit History
```

Things like Live / Demo / RBAC / SuperAdmin should not be confusing badges all over the interface.

Permissions determine what a user can access.

Live Preview is removed.

## 27. Products & Stock Admin

Admin does not become another PIM.

The purpose is visibility and operational troubleshooting.

Desired capabilities include: pagination; search/filtering; active count; snoozed count; ranged/unranged where available; store availability; price differences; tag/trait visibility; media health; diagnostics.

Something like `48 of 64 active`, `16 of 64 snoozed` is more useful than a giant product dump.

## 28. Media Health

Media Health should be a real operational tool rather than demo decoration.

It should test: product image URL; banner; Story image/video; branding assets.

Then identify: OK; broken; timeout; bad MIME type; missing.

Customer-facing components should gracefully hide unusable optional content rather than displaying black boxes.

## 29. Security / tenancy

The platform has to fail closed.

That includes: exact store provisioning; strict tenant boundaries; no unauthenticated cache reset; no production demo confirmation route; secure Admin/Super Admin RBAC; no fallback tenant in production; no mock order on API failure; no mock catalogue on API failure; server-side rule enforcement; authenticated webhooks with dedupe/idempotency.

## 30. Persistence and observability

Firestore should persist Bwydi platform state such as tenant configuration, rules, CMS, checkout/order projections, customer profiles and diagnostics.

Disk/memory fallback is useful for resilience in development, but transactional state cannot depend on ephemeral App Hosting disk.

The Firestore IAM issue we've seen needs to be resolved.

Operational tooling should include: capability matrix; audit log; integration health; webhook diagnostics; request IDs; raw/sanitized integration fixtures; order correlation IDs; connection status.

The Deliverect `dllm` tooling gives us a powerful staging microscope for carts, orders, retailOrders, pickerStatusHistory, commTraces — without becoming a production dependency.

## 31. Performance

The storefront should feel extremely fast even though there may be several stores underneath it.

The performance plan includes: route/code splitting; lazy-load Admin completely away from customer bundle; request coalescing; sensible catalogue caching; avoid repeatedly loading every store catalogue; cache normalized Deliverect data; prefetch strategically; image optimisation; responsive media; skeleton/loading UI; measure LCP/INP and API latency rather than guessing.

The current ~2 MB JS bundle should eventually be broken up rather than sent to every shopper upfront.

## 32. Analytics and commercial platform

Longer term the platform should give both Bwydi and tenants meaningful information such as: orders; revenue; conversion; basket size; search behaviour; store performance; unavailable items; substitutions; media failures; rule blocks; fulfilment usage.

There is also scope for platform usage/billing based on tenants/locations/transactions.

## 33. The order we should actually build it

The full wishlist is large, but the sequence should remain disciplined:

| Phase | Outcome |
|---|---|
| Now | Real customer Deliverect Collection basket |
| Next | Real async Collection checkout |
| Then | Quest picking + qty amendments + substitutions |
| Then | Customer/order tracking and final picked state |
| Then | DPay authorization/capture |
| Then | Delivery + Dispatch |
| Then | Auth/customer/CRM/loyalty/notifications |
| Then | Product/Country Rules fully enforced |
| Then | Merchandise API/collections once Deliverect confirms source |
| Then | White-label domains/onboarding automation |
| Then | Performance hardening |
| Then | Capacitor iOS/Android branded apps |
| Ongoing | Admin simplification, diagnostics, CMS, analytics and Retail Catalogue/Inventory expansion |

So the immediate spine remains:

```
Deliverect
Store/Menu
   ↓
REAL Basket
   ↓
REAL Reconcile
   ↓
REAL Checkout
   ↓
REAL Order
   ↓
Quest
   ↓
Amend / substitute
   ↓
Final customer order
```

Everything else — CRM, Loyalty, DPay, Dispatch, notifications, domains, branded apps — is designed to sit around that spine rather than replace it.
