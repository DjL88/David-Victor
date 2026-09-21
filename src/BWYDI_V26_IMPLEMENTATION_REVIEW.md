# Bwydi v26 — Basket / Checkout / Quest Implementation Review

Date: 21 Sep 2026

## Verdict

Gemini has made genuine progress: the live `DeliverectApiClient` now uses the real Commerce basket API for Collection baskets and no longer delegates the core live basket methods to `BasketService`. The raw checkout client has also been repaired to include `channelOrderId`, `channelOrderDisplayId`, and an unpaid `third_party` `externalId`.

However, the repository is **not yet ready for a customer end-to-end Collection order**. Several items marked complete in `PROJECT_STATUS.md` are only partially implemented or contradicted by the source.

The next work should remain narrowly focused on **Collection Basket -> Async Checkout -> Quest**.

---

## What is genuinely implemented

### Real live Collection basket path
`server/deliverect/DeliverectApiClient.ts` now implements live:

- `createBasket()` -> real `POST /commerce/{accountId}/baskets`
- `getBasket()`
- `updateBasketItem()`
- `updateBasketItems()`
- `updateBasketCustomer()`
- `updateBasketStore()`
- `validateBasket()`
- `reconcileBasket()`
- `checkout()` -> unpaid Collection checkout
- `getCheckout()`

Demo remains separate through `MockDeliverectAdapter`; staging/production use `DeliverectApiClient` when configured.

### Real basket mapper
`server/deliverect/DeliverectBasketMapper.ts` is a good addition:

- rejects local `bsk_...` IDs
- keeps Deliverect prices as integer minor units
- retains `menuId` per line for future full-array PATCH operations
- uses Deliverect `payment.total` as the authoritative payable total

### Raw unpaid checkout payload repaired
`server/deliverect/DeliverectCommerceBasketApi.ts` now sends:

```ts
order: {
  channelOrderId,
  channelOrderDisplayId,
  by: 'Bwydi Web App',
  includeCutlery: false,
},
payments: [{
  type: 'third_party',
  externalId,
  isPrepaid: false,
  amount: amountMinor,
  metadata: {},
}]
```

This matches the successful staging order shape already observed.

### Quest safety guards improved
`WebhookService.ts` now correctly:

- skips Dispatch on Collection / pickup picking events
- skips payment settlement when there is no authorised payment to capture
- keeps Collection from entering a phantom courier/payment-capture lifecycle

### Quest substitute callback response shape improved
`SubstitutionCallbackService.getQuestSubstituteCandidates()` now exposes the expected array shape:

```ts
[
  {
    plu,
    quantity,
    name,
    price,
  }
]
```

That is a meaningful improvement over returning Bwydi policy metadata directly.

---

# P0 blockers before the next customer test

## P0-1 — Customer basket currently tries to create a Delivery basket

The live path deliberately supports Collection only:

```ts
if (fulfillmentType !== 'pickup') {
  throw new CommerceError(
    'INVALID_FULFILLMENT',
    'Delivery checkout is not enabled on the real Deliverect basket path yet. Please choose collection.'
  );
}
```

That part is correct.

The problem is the storefront defaults to:

```ts
const [fulfillmentType, setFulfillmentTypeState] =
  useState<'delivery' | 'pickup'>('delivery');
```

and `useBasket` automatically creates an empty basket whenever a store becomes selected.

Result: a normal customer journey can call `POST /baskets` with `delivery` before adding an item. This is exactly the error shown in the latest runtime logs.

### Required fix

Do **not** automatically create an empty real Commerce basket merely because a store was selected.

The real basket should be created lazily on the **first add-to-basket action**.

For the current milestone:

- If `fulfillmentType === 'pickup'`: create the real Deliverect basket.
- If `fulfillmentType === 'delivery'`: do not call `/baskets`; show a clear temporary message / open the fulfilment selector saying Collection is currently the supported transactional test path.
- Never silently change Delivery to Collection.

This also aligns with the product-first plan: the fulfilment store becomes transactional when the customer actually starts a basket.

### Files

- `src/hooks/useBasket.ts`
- `src/app/AppLayout.tsx` only if a callback is needed to open the fulfilment modal

---

## P0-2 — Store switching is still wired to the wrong operation

`DeliverectApiClient.updateBasketStore()` is implemented correctly enough to call the real Commerce `/store` endpoint.

But `HttpCommerceClient.selectStore()` currently does this for an existing basket:

```ts
const reconciled = await this.reconcileBasket(existingBasketId, storeId);
```

The server `reconcileBasket()` ignores `destinationStoreId` on the live path. Therefore selecting another store does **not** actually migrate the Deliverect basket.

### Required fix

`selectStore()` should call:

```ts
updateBasketStore(existingBasketId, storeId, { confirmMigration: true })
```

then reconcile the returned basket if required.

The store-switch diff should compare **before vs after** prices, unavailable lines and adjusted quantities.

### Files

- `src/commerce/HttpCommerceClient.ts`
- optionally improve `server/deliverect/DeliverectApiClient.ts::updateBasketStore()` diff calculation

---

## P0-3 — Basket persistence key conflicts with the single-basket/store-switch model

`useBasket` currently stores basket IDs under:

```ts
bwydi:basket:${activeStoreId}
```

That creates one remembered basket per store while the intended architecture is a single current basket that migrates when the customer changes store.

This can leave stale Deliverect basket IDs behind and can restore an older basket after store switching.

### Required fix

Use one current basket key per tenant/session, for example:

```ts
bwydi:basket:${tenantId}
```

Store the current basket ID and its current store in the basket itself.

When the basket is cleared, also clear this storage key.

### File

- `src/hooks/useBasket.ts`

---

## P0-4 — Collection checkout still calls DPay tokenisation first

`PROJECT_STATUS.md` says fake DPay tokenisation was bypassed for Collection. The source does not currently do that.

`CheckoutModal.handleDirectAuthorizeCheckout()` still calls:

```ts
const token = await defaultPaymentClient.createToken(...)
```

before calling `checkoutBasket()`, even when the basket is Collection.

In staging the dynamic payment client resolves to the HTTP DPay path, so Collection checkout can fail before it ever reaches the already-proven unpaid Commerce checkout.

### Required fix

Split Collection and Delivery checkout branches.

For **Collection MVP**:

```text
reconcile basket
-> update customer on basket
-> POST /checkouts
-> unpaid third_party Commerce checkout
-> poll real checkout status
```

No DPay token. No authorization buffer. No Dispatch.

Leave the existing payment path for future Delivery/DPay work, but do not execute it for pickup.

### Files

- `src/features/checkout/CheckoutModal.tsx`
- `src/commerce/CommerceClient.ts`
- `src/commerce/HttpCommerceClient.ts`

---

## P0-5 — Checkout API typing is still lying

The server now returns a `CheckoutResult`, but the frontend contract still declares:

```ts
checkoutBasket(...): Promise<Order>
```

and `HttpCommerceClient.checkoutBasket()` returns `Promise<Order>`.

The UI then uses `as any` to discover whether the object is really a checkout or an order.

### Required fix

Introduce / expose the real async contract:

```ts
checkoutBasket(...): Promise<CheckoutResult>
```

or rename it to:

```ts
checkout(...): Promise<CheckoutResult>
```

Then make `CheckoutModal` treat successful submission as **pending**, never as an already-confirmed `Order`.

### Files

- `src/commerce/CommerceClient.ts`
- `src/commerce/HttpCommerceClient.ts`
- `src/features/checkout/CheckoutModal.tsx`

---

## P0-6 — The status endpoint still does not refresh a pending checkout

`GET /checkouts/:checkoutId` now correctly refreshes Deliverect when the stored checkout is pending.

But the storefront polls:

```text
GET /checkouts/:checkoutId/status
```

and that route only asks Deliverect when there is **no local checkout at all**.

If the local projection exists as `CHECKOUT_PENDING_CONFIRMATION`, `/status` repeatedly returns pending and can remain there forever unless a webhook happens to update it.

### Required fix

Make `/checkouts/:checkoutId/status` use the same refresh policy as `/checkouts/:checkoutId`:

```ts
if (
  !checkout ||
  checkout.status === 'CHECKOUT_PENDING_CONFIRMATION' ||
  checkout.status === 'CHECKOUT_SUBMITTING'
) {
  const upstream = await adapter.getCheckout(checkoutId);
  ...persist upstream...
}
```

Or remove the duplicate logic and have the frontend poll the full checkout endpoint.

### File

- `server/api/v1Router.ts`

---

## P0-7 — Firestore IAM is now a transaction-safety blocker, not just an Admin warning

The latest runtime still reports that the service account lacks `roles/datastore.user` and Deliverect discovery is not persisted.

That was tolerable while browsing catalogue data. It is **not safe for real checkout**.

`saveCheckoutProjection()` and `saveOrderProjection()` are intentionally fail-closed outside demo mode. Therefore this sequence is possible:

```text
Deliverect checkout succeeds
-> Bwydi attempts to persist checkout
-> Firestore PERMISSION_DENIED
-> BFF returns failure to customer
-> customer retries
-> potential second real order
```

### Required action in Google Cloud

Grant the App Hosting / Cloud Run runtime service account:

```text
Cloud Datastore User
roles/datastore.user
```

Do this **before placing a customer-facing real checkout**.

Also verify `/ready` becomes healthy and `FIRESTORE_PERSISTED` becomes true.

---

# P1 — Order correlation / Quest preparation

## P1-1 — PROJECT_STATUS claims correlation IDs are persisted; `saveOrderProjection()` does not currently populate them

`OrderProjection` defines:

- `basketId`
- `channelOrderId`
- `channelOrderDisplayId`
- `channelOrderRawId`
- `channelLinkId`
- `deliverectAccountId`
- `deliverectLocationId`

but `saveOrderProjection()` does not assign most of them to the projection object.

The universal external-ID resolver therefore has fields to search, but new real orders will not reliably contain those fields.

### Required fix

When saving a raw/normalized Deliverect order, persist at least:

```ts
basketId:
  order.basketId || order.basket?.id || order.originalBasket?.id,

channelOrderId:
  order.channelOrderId || order.orderReference,

channelOrderDisplayId:
  order.channelOrderDisplayId || order.displayId,

channelOrderRawId:
  order.channelOrderRawId,

channelLinkId:
  order.channelLinkId || order.storeId,
```

and use `channelOrderId` as a final stable fallback if Deliverect does not expose an internal order ID in the Commerce checkout response.

### File

- `server/firestoreService.ts`

---

## P1-2 — Raw Deliverect order payload is not yet normalized for Quest projection

The successful staging order shape has top-level:

```text
items[]
payment
channelOrderId
channelOrderDisplayId
channelLinkId
orderType
pickupTime
orderIsAlreadyPaid
```

But `saveOrderProjection()` primarily initializes picking items from:

```ts
order.originalBasket?.items
```

A raw Commerce/Deliverect order can therefore be persisted with:

- zero `itemsCount`
- no `picking.items`
- missing total/currency metadata

This would make Quest amendment handling unable to find the original line.

### Required fix

Create a dedicated raw-order normalization function before persistence, or extend `saveOrderProjection()` to support both Bwydi `Order` and raw Deliverect Commerce order shapes.

Preferred architecture:

```text
raw Deliverect order
-> DeliverectOrderMapper
-> normalized Bwydi Order / OrderProjection input
-> saveOrderProjection
```

### Suggested new file

- `server/deliverect/DeliverectOrderMapper.ts`

---

## P1-3 — Quest substitute route blocks valid external IDs before the universal resolver gets a chance

The substitute callback route currently starts with:

```ts
const orderProj = await FirestorePlatformService.getOrderProjection(orderId);
```

and returns 404 in live mode if it is not a direct internal order ID.

The Quest callback identifier may be a `channelOrderId` / other external order correlation value.

### Required fix

Use:

```ts
getOrderProjectionByExternalIdentifier(orderId)
```

in the route itself.

Then pass the resolved canonical order ID to the substitution service.

### File

- `server/api/v1Router.ts`

---

## P1-4 — BEST_MATCH substitution callback currently returns no candidates

`getQuestSubstituteCandidates()` now emits the correct array shape, but it only converts candidates already stored in the order projection.

For `BEST_MATCH`, `getSubstitutionForPlu()` supplies policy metadata but no candidate list, so Quest receives:

```json
[]
```

unless candidates were pre-populated elsewhere.

### Required next step

Do not invent the ranking contract yet. Use the first real Quest order and `dllm` to determine:

- what identifier Quest requests
- what product/candidate context Deliverect already exposes
- whether Bwydi is expected to return brand/store catalogue candidates or only customer-preselected candidates

Then implement an authoritative candidate resolver against the selected store's real Deliverect catalogue.

### Files later

- `server/deliverect/SubstitutionCallbackService.ts`
- likely `DeliverectApiClient` / store catalog helper

---

# P1 — Minor but important basket correctness issues

## `useBasket` stale closure dependencies
Callbacks that create baskets reference `fulfillmentType` but do not consistently include it in their dependency arrays. Add it to `updateQuantity`, `addMultipleItems`, `addBundleToBasket`, etc.

## `clearAllBaskets()` does not clear remembered basket storage
Use the same persistence helper as normal basket updates.

## Bundle update can replace the whole basket
`HttpCommerceClient.addBundleToBasket()` sends one bundle line to `/baskets/:id/items`. On the real Commerce path this endpoint has full replacement semantics. Existing lines can therefore be wiped.

Until bundle serialization is proven against the live Commerce contract, either:

- merge the existing mapped lines plus the bundle into the complete replacement array, or
- temporarily disable bundle add on the real path with a clear capability message.

Do not silently risk deleting the rest of the cart.

---

# Documentation truth issues

`PROJECT_STATUS.md` currently overstates several completed items:

- says Collection bypasses DPay tokenisation — source still calls `defaultPaymentClient.createToken()`
- says `/checkouts/:id/status` refreshes pending state from Deliverect — it does not when a pending local projection already exists
- says external correlation IDs are persisted — interface fields exist, but `saveOrderProjection()` does not populate most of them
- says Phases A-D are complete — Phase A still has broken real store switching through `HttpCommerceClient.selectStore()` and Collection-only UX is not gated

`docs/DELIVERECT_CAPABILITY_MATRIX.md` is also stale in the opposite direction: it still says storefront basket/checkout are delegated to `BasketService`, which is no longer true in `DeliverectApiClient`.

Update both only after the next staging gates pass.

---

# Recommended execution sequence

## Gate 0 — fix infrastructure first
1. Grant `roles/datastore.user` to runtime identity.
2. Confirm Firestore persistence succeeds.
3. Confirm `/ready` is healthy.

## Gate 1 — real customer Collection basket
1. Select Collection explicitly.
2. Select store.
3. **No basket should be created just by selecting the store.**
4. Add VIC1011 qty 1 -> real Deliverect basket ID.
5. Increase to qty 2 -> authoritative £4.20.
6. Add second normal product.
7. Remove first product.
8. Refresh page -> same real basket restored.
9. No `bsk_...` IDs anywhere.

## Gate 2 — real store switch
1. Basket contains 2 items.
2. Select another store.
3. Call real `/basket/{id}/store` operation.
4. Reconcile.
5. Show diff if price/OOS changes.
6. Confirm Deliverect basket now reports new store ID.

## Gate 3 — real customer unpaid Collection checkout
1. Add customer name/email/phone to basket.
2. Reconcile.
3. Do **not** call DPay.
4. Submit unpaid `third_party` checkout once with a stable idempotency/reference.
5. Persist checkout before telling frontend it is safely tracked.
6. Poll real Deliverect checkout state.
7. Persist normalized order with all correlation IDs.
8. Order appears in Deliverect/Quest.

## Gate 4 — Quest staging proof with `dllm`
Create a three-line Collection order:

- A: pick normally
- B: reduce quantity
- C: mark unavailable and substitute

Before Quest activity, capture `orders` and `retailOrders` through `dllm`.

After each Quest action:

- capture `retailOrders`
- capture `pickerStatus` / `pickerStatusHistory`
- inspect `commTraces`
- compare the actual inbound webhook payload with Bwydi's normalizer

Only after observing the real payload should the generic Quest event normalizer be tightened.

---

# Immediate recommendation

Do **not** ask Gemini to implement another broad roadmap batch.

The best next patch is a small controlled set covering:

1. lazy Collection basket creation / no automatic Delivery basket
2. correct live store switching
3. Collection checkout DPay bypass + proper `CheckoutResult` typing
4. pending checkout polling refresh
5. order/correlation normalization
6. Quest substitute route external-ID resolver

Then run the four staging gates above before touching Delivery, DPay, or Dispatch.
