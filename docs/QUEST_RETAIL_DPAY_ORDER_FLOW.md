# Quest-first order flow with DPay manual authorisation

## Decision

The default terminal order-creation route is `retail_quest`.

A customer order must use exactly one Deliverect order-creation route:

- `retail_quest`: submit the reconciled basket through the Channel/Retail Create Order API so it is available to Quest.
- `commerce_checkout`: use Commerce Basket Checkout.

Never create a Retail order and then call Commerce Checkout for the same customer order. The Commerce route is retained behind configuration for future use.

## Payment lifecycle

For online card payments using Deliverect Pay:

1. Build and reconcile the authoritative basket.
2. Calculate the customer-approved authorisation ceiling.
3. Request DPay with `captureMode: "manual"`.
4. Wait for DPay to report the payment as `authorized`.
5. Submit the Retail/Channel order to Quest, linking the local order projection to the DPay `paymentId`.
6. Quest performs picking, quantity amendments, removals and substitutions.
7. Derive the final payable amount from the final Quest picking state.
8. If the final amount is within the authorised amount, capture exactly the final amount.
9. If the final amount exceeds the authorised amount, reauthorise the additional amount first, then capture the final amount.
10. If the order is cancelled before capture, release/cancel the authorisation. If already captured, refund according to the cancellation flow.

The Channel/Retail order is marked as already paid for operational/POS purposes when a valid online authorisation exists, so the store must not collect payment again. This is separate from PSP settlement: the payment projection remains `AUTHORIZED` until final capture.

## Retail order mapping

The Quest route uses:

- `POST /{channelName}/order/{channelLinkId}`
- pickup order type `1`
- delivery order type `2`
- `itemUnavailableActions` from the customer's substitution preference
- `substituteCandidate` for customer-selected alternatives
- `orderIsAlreadyPaid: true` only when an online payment authorisation is linked
- current basket total in the Channel Order payment block, not the higher authorisation ceiling

The authorisation ceiling is persisted separately and is never presented as the order total.

## Configuration

Tenant integration configuration supports:

- `orderRoute: "retail_quest" | "commerce_checkout"`
- optional `channelName` override for the Channel API scope

The normal Retail/Quest path derives `channelName` automatically from the OAuth grant `genericChannel:<channel_scope>`. A manual `channelName` is only required when the OAuth provider omits scope metadata or the credentials expose more than one Channel scope.

Environment fallbacks:

- `DELIVERECT_ORDER_ROUTE`
- `DELIVERECT_CHANNEL_NAME` (optional Channel-scope override)

If no order route is configured, the server defaults to `retail_quest`.

## Important implementation note

The existing `PaymentService.settleOrderPayment()` already calculates the authoritative final Quest amount, captures a lower final amount, and requests reauthorisation if the final amount exceeds the authorised ceiling.

The live `DeliverectDPayAdapter` now uses the published Pay API contracts for gateway discovery, payment request/manual authorisation, payment lookup and refunds. The public docs also expose a re-authorisation route, but the meaning of its `amount` field must still be confirmed for our partner contract before enabling it automatically.

Deliverect's current public Pay endpoint index does **not** expose a manual capture operation even though `captureMode: "manual"` explicitly supports pre-authorise-now/capture-later behaviour. Do not guess a capture URL. Final live capture therefore remains guarded until Deliverect confirms the enabled capture contract for this integration.

## Idempotency

Use one stable internal order reference across payment, Retail order submission, Firestore projections and webhooks. Basket/order retry logic must return the existing order rather than creating a second live order.

A `channelOrderId` must never be reused to create another order.
