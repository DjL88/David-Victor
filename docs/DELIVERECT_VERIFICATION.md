# Deliverect Staging Verification & Contract Checklist (docs/DELIVERECT_VERIFICATION.md)

**Status:** Live Staging Connected & Verified (OAuth, Accounts, Locations, Channel Links, Products & Categories)  
**Reference:** Deliverect Open API / Eve REST, Deliverect Commerce API, Dispatch, DPay, Quest Picking

---

## 1. Verified Live Staging Endpoints

| Endpoint | Method | Result / Contract Found | Verified Status |
|---|---|---|---|
| `/oauth/token` | POST | HTTP 200 OK. `client_credentials` grant with audience `https://api.staging.deliverect.com`. Returns bearer token and TTL (`expires_in: 3600`). | VERIFIED LIVE |
| `/accounts` | GET | HTTP 200 OK. Returns Eve collection `_items` containing Account `68517fde1c3ddaa7f6d0275c` ("DELIVERECT-TEST / Daves Deli"). | VERIFIED LIVE |
| `/locations` | GET | HTTP 200 OK. Returns Eve collection `_items` with 4 physical locations: Folgate Tuckshop, Spitalfield Spirits, Liqueurs of Liverpool Street, Deli Delivery. | VERIFIED LIVE |
| `/commerce/{accountId}/stores` | GET | Official Commerce Get Stores contract: `GET /commerce/{accountId}/stores?page=1&size=50`. Returns pagination envelope `{ total: number, page: number, size: number, items: [...] }` parsed directly via `items` without inventing fields. | VERIFIED CONTRACT |
| `/channelLinks` | GET | HTTP 200 OK. Returns 6 commercial channel links (Direct test channels, Deliveroo Retail channel 6002, Uber Eats Retail channel 6007). | VERIFIED LIVE |
| `/products` | GET | HTTP 200 OK. Returns 25 products with prices in minor units (e.g. 89 = £0.89), images on Google Cloud Storage (`ikona-bucket-staging`), GTINs, productTags, nutritionalInfo. | VERIFIED LIVE |
| `/productCategories` | GET | HTTP 200 OK. Returns 25 categories with hierarchical `subCategories` tree. | VERIFIED LIVE |
| `/baskets` | GET | HTTP 200 OK. Returns active Eve collection of baskets for the account. | VERIFIED LIVE |
| `/orders` | GET | HTTP 200 OK. Returns active orders collection. | VERIFIED LIVE |
| `/fulfillment/validate` | POST | Endpoint registered (405 on GET). Requires Dispatch payload verification. | IN PROGRESS |
| `/baskets` | POST | HTTP 403 `insufficient_permissions` with current staging credentials. Requires basket write scope or merchant POS authorization. | BLOCKED ON DELIVERECT PERMISSIONS |

---

## 2. Unresolved External Contracts & Questions for Deliverect Colleagues

| ID | Domain | Contract Item | Question / Verification Required | Status |
|---|---|---|---|---|
| **DV-01** | **OAuth & Baskets** | Basket Write Scope | `POST /baskets` returns 403 `{"code":"insufficient_permissions"}`. Confirm which scope or merchant permission must be granted to the client credentials (`4BLXg0gM62Pq...`) to create and update baskets. | PENDING DELIVERECT TEAM |
| **DV-02** | **Dispatch** | Dispatch Validation Payload | Confirm exact request schema for `POST /fulfillment/validate` (coordinates vs address vs channelLinkId). | PENDING DISPATCH TEST |
| **DV-03** | **DPay** | Manual Capture & Token Proxy | Confirm whether Basis Theory token proxy is enabled for account `68517fde1c3ddaa7f6d0275c` and the exact payment request route. | PENDING PAY TEAM CONFIRMATION |
| **DV-04** | **Quest** | Picking Amendments Payload | Confirm Quest webhook payload signature and substitution callback contract. | PENDING QUEST TEST |
| **DV-05** | **DPay** | Manual Capture Endpoint | Confirm exact endpoint and payload for executing capture of an authorized DPay payment (`/pay/channel/{channelLinkId}/payments/{paymentId}/capture`). | PENDING PAY TEAM CONFIRMATION |
| **DV-06** | **DPay** | Post-Pick Uplift / Reauthorization | Does DPay support authorising an agreed maximum ceiling above the initial basket total, followed by partial capture of the picked total? If final picked value exceeds authorized amount, what is the verified additional-auth / reauth contract? | PENDING PAY TEAM CONFIRMATION |
| **DV-07** | **DPay** | Residual Hold Release | When capturing an amount lower than the authorized maximum, does DPay / underlying PSP automatically release the residual hold immediately or upon settlement? | PENDING PAY TEAM CONFIRMATION |
| **DV-08** | **Dispatch** | Availability & Fee Fields | Confirm exact response fields for `/fulfillment/validate` (`validationId`, `expiresAt`, `deliveryFee`, `etaMinutes`, carrier info). | PENDING DISPATCH TEST |
| **DV-09** | **Quest** | Substitute Candidate Schema | For `GET /integrations/deliverect/orders/:orderId/substitute/:plu`, confirm the exact JSON schema expected by Quest when returning customer-selected candidate arrays. | PENDING QUEST TEST |
| **DV-10** | **Webhooks** | HMAC Header & GET Signing | Confirm header name (`x-server-authorization-hmac-sha256`) and verify that GET callbacks use an empty string as payload for signature calculation. | PENDING WEBHOOK TEST |

---

## 3. Staging Test Matrix Plan & Live Onboarding Workflow

The Admin UI provides a guided 3-stage live onboarding flow under **Integrations → Deliverect**:
1. **Credentials & OAuth Test (`Test Deliverect OAuth`):** Acquires and caches staging OAuth token with safe diagnostic latency and token expiration reporting. Emits `OAUTH_VERIFIED` without assuming or faking account connectivity.
2. **Account Link Discovery & Selection:** Discovers all linked accounts directly from Deliverect without manual entry of Account IDs. Selection persists the mapping as `ACCOUNT_MAPPED`.
3. **Commerce Store Discovery:** Queries linked accounts and physical locations for all active Commerce Stores and Channel Links, automatically projecting them to `COMMERCE_VERIFIED` / `CONNECTED`.

| Test ID | Area | Action | Expected Staging Outcome |
|---|---|---|---|
| `AUTH-01` | Auth | Request staging token with client credentials | 200 OK; access token cached until `expires_at` |
| `AUTH-02` | Auth | Invalid secret test | 401 Unauthorized; zero mock fallback |
| `ACC-01` | Accounts | Get Linked Accounts | Returns provisioned staging test accounts |
| `LOC-01` | Locations | Retrieve Locations | Separate physical location IDs from channel link IDs |
| `STORE-01` | Stores | Store discovery by coordinates & distance | Returns nearby Commerce stores with distance in metres |
| `STORE-02` | Stores | State evaluation | Preserves `open`, `closed`, `busy`, `paused` states |
| `MENU-01` | Menus | Root Menu retrieval | Store-agnostic brand catalogue without local prices |
| `MENU-02` | Menus | Store Menu retrieval | Store-specific price, availability, and active status |
| `BASK-01` | Basket | Create basket with real store & fulfillment | Returns Deliverect basket ID |
| `BASK-02` | Basket | Add item with `menuId` + `plu` | Authoritative basket total calculated by Deliverect |
| `DSP-01` | Dispatch | Validate delivery address | Returns `available: true`, `validationId`, and expiry |
| `PAY-01` | DPay | Tokenize card and request payment | Reaches `authorized` with `captureMode: manual` |
| `CHECK-01`| Checkout | Submit checkout with basket & payment ref | Asynchronous order placement initiated |
| `QST-01` | Quest | Simulate item picked & substitute | Inbound HMAC verified, order projection updated |
| `PAY-02` | DPay | Partial capture of final amount | Captures final amount (`<= authorized ceiling`) |
