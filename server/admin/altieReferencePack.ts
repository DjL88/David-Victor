import { selectPublishedAltieFacts, type AltieBuiltInReference } from '../../src/altie/knowledgeFacts';

/** Bundled with this release; never fetched from main or the public web during chat. */
export const ALTIE_REFERENCE_VERSION = 'ltx-reference-2026-09-26.1';
export const ALTIE_REFERENCE_REVIEWED_COMMIT = '1eab468101efa4737685c928c7040a473a5cd48e';
const reviewedAt = '2026-09-26';

export const ALTIE_BUILT_IN_REFERENCES: readonly AltieBuiltInReference[] = [
  {
    id: 'app-overview', title: 'How LTx operates', audience: 'operators', reviewedAt,
    aliases: ['how the app works', 'how this app works', 'how ltx works', 'operates', 'workflow', 'platform'],
    body: 'LTx combines a customer shop with tenant-scoped Admin. The shop reads the published catalogue, validates a basket, submits checkout through the server and shows an evidence-based order tracker. Admin manages catalogue visibility, rules, branding, content, integrations and reporting. The platform server, not chat or the browser display, owns validation and persistence. An explanation of a workflow is not evidence that a particular order or configuration was inspected.',
    source: 'docs/ARCHITECTURE.md',
  },
  {
    id: 'app-architecture', title: 'Application architecture and ownership', audience: 'superAdmin', reviewedAt,
    aliases: ['architecture', 'built', 'codebase', 'source code', 'firestore', 'backend', 'bff', 'react', 'express'],
    body: 'The React storefront and Admin live in src/. server.ts starts the Express application in server/app.ts; server/api/v1Router.ts exposes the main BFF API. Platform persistence is behind server/firestoreService.ts; server/deliverect/ owns provider adapters and ingestion; server/admin/ owns Altie knowledge, actions and ChangeSets. Firebase App Hosting serves the compiled frontend and server. Secrets are resolved server-side, never supplied as knowledge. This is the reviewed release architecture, not a claim that runtime or provider checks passed.',
    source: 'docs/ARCHITECTURE.md',
  },
  {
    id: 'catalogue-flow', title: 'Published catalogue versus current stock', audience: 'operators', reviewedAt,
    aliases: ['menu push', 'catalogue', 'catalog', 'last known good', 'lkg', 'range', 'ranging'],
    body: 'A verified Deliverect Channel Menu Push establishes the durable product range. Normalised menu evidence is published through a scoped pointer after processing, with last-known-good protection. Optional Commerce and snooze observations contribute operational evidence; their failure is not permission to erase the published range. The storefront stays a combined view. A product absent from a transient discovery response is not proven unassigned. Use current authorised catalogue reads for a specific item; this reference is not live stock.',
    source: 'server/deliverect/ChannelMenuIngestionService.ts',
  },
  {
    id: 'order-payment-truth', title: 'Order and payment outcomes are separate', audience: 'operators', reviewedAt,
    aliases: ['checkout', 'order tracker', 'payment', 'refund', 'authorisation', 'capture', 'cancelled', 'canceled'],
    body: 'A submitted request, bank authorisation, payment capture, order acknowledgement, picking, handover and refund are different events. A transport failure can leave the outcome unknown; do not promise that no payment was taken or invite a blind duplicate checkout. The customer tracker shows only supported lifecycle evidence. Cancellation is not proof of refund, and a removed item is not proof that a bank refund completed. Use the authorised order/payment record for current amounts and keep explicit currency and integer minor units.',
    source: 'docs/ARCHITECTURE.md',
  },
  {
    id: 'substitution-economics', title: 'Substitutes, replacement quantity and protected price', audience: 'operators', reviewedAt,
    aliases: ['sub', 'subs', 'substitute', 'substitutes', 'substitution', 'replacement', '500ml', '1l', 'price protection'],
    body: 'Sub, substitute and replacement can describe picking substitutions, but none proves customer approval. Original requested quantity and supplied replacement quantity are independent: one 1L item may be replaced with two 500ml items only when product, restriction and customer-choice rules permit it. Volume equivalence alone is not product equivalence. LTx protects the original effective line total, not the original unit price multiplied by the replacement quantity. Original promotion allocation and verified replacement economics remain separate; chat never invents promotional savings or acceptance.',
    source: 'docs/ARCHITECTURE.md',
  },
  {
    id: 'retail-identifiers', title: 'PLU, SKU, barcode and product code', audience: 'operators', reviewedAt,
    aliases: ['plu', 'sku', 'barcode', 'ean', 'gtin', 'product code', 'item code'],
    body: 'These are related lookup terms, not interchangeable identifiers. In LTx an upstream PLU, a retailer SKU, a scanned barcode and an internal product ID can differ. Preserve the identifier type, tenant and location and resolve actual catalogue mappings rather than guessing from a matching string. A line may mean a catalogue product or an order line; use the question and page context to distinguish them. Retail aliases here help retrieve explanations; they do not rewrite product IDs or storefront search configuration.',
    source: 'docs/ARCHITECTURE.md',
  },
  {
    id: 'retail-visibility', title: 'Hidden, not ranged, archived, snoozed and out of stock', audience: 'operators', reviewedAt,
    aliases: ['hidden', 'disappeared', 'not ranged', 'archived', 'snoozed', 'out of stock', 'oos', 'line missing'],
    body: 'These describe different states. Ranging concerns inclusion in the selected catalogue/location. Archived preserves a removed product as historical catalogue evidence. Snoozed is a temporary operational availability signal. Out of stock needs current inventory evidence. Hidden can also result from rules, fulfilment or merchandising visibility. Missing evidence is unknown, not zero stock or confirmed availability. Diagnose through authorised current reads; do not equate a hidden product with a deleted one.',
    source: 'server/admin/adminAssistantActionService.ts',
  },
  {
    id: 'retail-fulfilment', title: 'Collection, pickup, dispatch and handover', audience: 'operators', reviewedAt,
    aliases: ['collection', 'pickup', 'pick up', 'handover', 'fulfilment', 'fulfillment', 'dispatch', 'courier'],
    body: 'Collection and pickup often describe the same customer fulfilment option, but courier pickup means the courier collecting from the store, not customer receipt. Ready for collection is not collected. Dispatch availability is not a courier assignment. In the reviewed LTx adapter live courier assignment and dispatch-job cancellation remain explicitly unsupported until their enabled channel-side contracts are verified. A glossary or provider manual does not enable those operations.',
    source: 'server/deliverect/DeliverectDispatchAdapter.ts',
  },
  {
    id: 'cms-publishing', title: 'Admin content and domain publication', audience: 'operators', reviewedAt,
    aliases: ['cms', 'banner', 'story', 'stories', 'pages', 'domain', 'publish', 'https'],
    body: 'Banners, Stories and Pages manage customer content through tenant-scoped Admin saves. A prefilled field, preview or navigation aid is not a saved or published change. Domain ownership, HTTPS readiness and serving a live site are separate stages; a verified ownership claim alone proves neither HTTPS nor a working site. An unavailable CMS load must not be treated as an empty configuration. Review the current page and persisted result before describing a change as complete.',
    source: 'docs/ARCHITECTURE.md',
  },
  {
    id: 'altie-boundary', title: 'Altie knowledge is not permission', audience: 'operators', reviewedAt,
    aliases: ['altie', 'facts', 'knowledge', 'permissions', 'can you', 'approval', 'changeset'],
    body: 'Altie explains reviewed reference material and uses registered tenant-scoped read actions when available. The server-authenticated identity and current action registry decide capabilities. The reviewed executable write path is low-risk Branding through a durable ChangeSet, human approval, persisted verification and an audit receipt. Unsupported actions stay unsupported. Published Facts are editorial reference, not system instructions or live operational evidence; they cannot grant privileges, change tenants, add provider tools or override payment/security rules.',
    source: 'docs/ALTIE_TRUSTED_OPERATOR.md',
  },
  {
    id: 'deliverect-reference-index', title: 'Deliverect AI-readable documentation', audience: 'operators', reviewedAt,
    aliases: ['deliverect', 'llm', 'llms', 'provider documentation', 'retail api', 'commerce api'],
    body: 'Deliverect publishes an llms.txt index of official documentation, including Channel, Commerce, Retail, picking, payments and Dispatch reference sections. Its index advertises Markdown page versions. This is provider reference, not a model and not evidence that every documented feature is implemented or enabled in LTx. Distinguish provider documentation, the deployed LTx adapter, tenant configuration, actor permission and current runtime evidence. This starter includes reviewed excerpts, not an automatic import of the entire index, and does not fetch or execute linked content during chat.',
    source: 'https://developers.deliverect.com/llms.txt',
  },
  {
    id: 'deliverect-status-sources', title: 'Deliverect status codes need a source', audience: 'operators', reviewedAt,
    aliases: ['status code', 'pos', 'finalized', 'finalised', 'preparing', 'delivered', 'status 90', 'cancellation'],
    body: 'Deliverect documents separate POS, courier and channel status spaces. POS 50 is preparation, 70 is pickup-ready, and POS 90/95 do not establish customer delivery. Courier 83 is travelling to the pickup store; courier 87 is travelling towards dropoff; courier 90 is delivery. Channel 100 requests cancellation, while POS 110 is cancellation evidence. Always retain event source and correlation. Do not reinterpret a bare number as customer completion or assume that the enabled Retail profile supports every general Channel operation.',
    source: 'https://developers.deliverect.com/page/order-status',
  },
];

export function selectBuiltInAltieReferences(message: string, actorRole: string): AltieBuiltInReference[] {
  const selected = selectPublishedAltieFacts(ALTIE_BUILT_IN_REFERENCES.map((reference) => ({
    ...reference, category: 'app' as const, active: true,
  })), message, actorRole, 3);
  return selected.map((fact) => ALTIE_BUILT_IN_REFERENCES.find((reference) => reference.id === fact.id)!);
}
