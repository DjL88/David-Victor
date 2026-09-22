# Support request: Quest orders accepted but show no picking amendment options at all

## Summary

Orders submitted through our Retail Channel integration are accepted by Deliverect and reach Quest for picking, but Quest never offers **any** editing capability on them — no substitution, no quantity amendment, no item removal, and no order cancellation from the picker side. This happens for every item in the order (not item-specific), and is consistent across environments and API hosts we've tried. We believe this points to a provisioning/capability gap on our Channel integration rather than a payload issue, and would like it confirmed and (if needed) enabled.

## Environment

- Environment: staging
- Channel name: `bwydi`
- Account: as registered under our staging OAuth credentials

## What we observed

- In Quest, an item shows: **"Replacements and quantity changes are not available"**, with the **Pick** button disabled.
- This is not limited to a specific PLU — every item on the order behaves this way.
- The order also cannot be cancelled from within Quest.
- The order **is** correctly accepted and does reach Quest — this isn't a rejected/failed submission.

## What we've already ruled out on our side

1. **Per-item `itemUnavailableActions` payload** — we compute this correctly from the customer's substitution preference (verified against our own logic and against a real working example from another Retail integration on your platform). A representative example order we submitted:
   ```json
   {
     "channelOrderId": "BWYDI-439181A62AD82AC2",
     "channelLinkId": "6aadaa0cb3aef90f42ab345d",
     "items": [
       {
         "plu": "JOE1006",
         "itemUnavailableActions": ["ITEM_AMENDMENT", "ITEM_REMOVE", "ITEM_SUBSTITUTION", "ITEM_SUBSTITUTION_CATALOG"]
       },
       {
         "plu": "JOE1005",
         "itemUnavailableActions": ["ITEM_AMENDMENT", "CANCEL_ORDER"]
       }
     ]
   }
   ```
   Viewable at: `https://retail.staging.deliverect.com/orders/6ab24b5d3e3ee624692c77f1`

   Even the item with full substitution actions granted (`JOE1006`) showed no editing capability in Quest — so this isn't about the specific action list we send per item.

2. **API host (`api.staging.deliverect.com` vs `api.staging.deliverect.io`)** — we noticed another Retail integration on your platform (Snappy Shopper) submits orders to `api.deliverect.io` rather than `.com`. We switched our order submission to `api.staging.deliverect.io` as a test:
   ```
   POST https://api.staging.deliverect.io/bwydi/order/6aadaa0cb3aef90f42ab345d
   ```
   The order (`channelOrderId: BWYDI-2BCA18A7995ABCAF`) was accepted successfully and reached Quest — but the behavior was identical: no editing capability offered. So the API host isn't the differentiator either.

3. **`orderType` value** — we send `1` for pickup / `2` for delivery, matching the convention used in a real, working order from another Retail integration on your platform. This doesn't appear to be a delivery/pickup misclassification.

## An observation that may be relevant

Looking at the order's Communication Traces, we see Delivery Manager (DMA) calls (`delivery-manager.staging.deliverect.com/newOrder`, `/statusUpdate`, `device-manager.staging.deliverect.com/pushNotifications`) firing essentially simultaneously with the Quest picking-status webhook call, immediately after order placement. If a Retail order is meant to go through Quest's picking/substitution stage *before* being handed to DMA, this simultaneous/immediate DMA engagement may be relevant to why no editing stage is being offered — though we're not certain this is cause vs. an unrelated parallel process.

## What we'd like confirmed

1. Is the Channel/integration behind `channelLinkId: 6aadaa0cb3aef90f42ab345d` (channel name `bwydi`) provisioned with Quest Retail picking capabilities (substitution, amendment, cancellation), as distinct from a standard restaurant/Channel order flow?
2. Is there an additional configuration step (in the Partner Portal, or on your side) required to enable this for our integration?
3. Is our OAuth scope confirmed to include Retail/Quest picking capability, or is that still pending on your side?
4. Should Retail orders be submitted via a specific endpoint/host or channel-name convention we haven't been told about (for context: we tried both `api.staging.deliverect.com/bwydi/order/...` and `api.staging.deliverect.io/bwydi/order/...`, both accepted, same behavior)?

Happy to provide additional order IDs, payloads, or timestamps on request.
