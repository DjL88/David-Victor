/** Reviewed Admin routes; labels match the live sidebar. No coordinates or writes. */
export const ALTIE_PAGE_GUIDES: Record<string, { label: string; help: string }> = {
  brands: { label: 'Brands', help: 'Choose Manage Brand for an existing retailer, or New brand for the setup wizard. Confirm the selected tenant before editing.' },
  memberships: { label: 'Team & Access', help: 'Review existing memberships and their brand scope. Add teammate changes access; select the intended role and review before saving.' },
  stores: { label: 'Locations', help: 'Search by location name, ID or address, filter status or group, then open the location. Review opening hours and availability; missing provider data is unknown.' },
  catalog: { label: 'Products & Stock', help: 'Search by product name, PLU or barcode and select a location to inspect ranging, pricing and availability. Deliverect/POS owns live stock and prices; this page diagnoses them.' },
  fees: { label: 'Fees', help: 'Review location fee policies and currency, edit the applicable rule and save. Verify the resulting basket charge; a displayed draft is not a charged fee.' },
  product_rules: { label: 'Product rules', help: 'Create or edit a rule. Choose Where conditions, then Actions, scope, priority and enabled state. Review and Save rule. Test a matching product and a non-matching product before relying on it.' },
  courier_settings: { label: 'Courier settings', help: 'Review dispatch rules and supported courier requirements. Saving policy does not enable live assignment or cancellation; those provider operations remain unsupported.' },
  order_scheduling: { label: 'Order scheduling', help: 'Choose ASAP-only, next-opening pre-order or same-day scheduling, then Save scheduling settings. Verify the selected location has opening hours and an eligible checkout slot.' },
  branding: { label: 'Branding', help: 'Review logo, colours, typography and the preview, then save. Altie can prepare supported Branding changes for a separate reviewed and approved ChangeSet; guidance alone changes nothing.' },
  languages: { label: 'Languages & wording', help: 'Select enabled languages and the default language. Review terminology overrides such as basket/cart and collection/pickup, save, then check the customer language.' },
  features: { label: 'Feature switches', help: 'Review each capability toggle and Save Feature Toggles. A switch enables only implemented behaviour; it does not activate an unsupported payment or courier integration.' },
  hero_banners: { label: 'Banners', help: 'Create or edit a banner, choose media, copy and destination, review schedule and visibility, then save. Check the published storefront and any stock-linked conditions.' },
  stories: { label: 'Stories', help: 'Create or edit story media and destination, review visibility and save. The Stories feature switch must also be enabled for published content to appear.' },
  search_merch: { label: 'Search & Recommendations', help: 'Review search and recommendation settings, product selectors and exclusions, save, then try the customer query. Retail glossary aliases do not automatically change storefront search synonyms.' },
  pages: { label: 'Pages', help: 'Choose a page or New, set title and URL slug, then Add Block. Set Status to Published and Navigation Placement to Footer Nav Only for policies, or Header & Footer Nav for key brand pages. Tick Show in Account for account information. Save Page, reload, then open /pages/<slug> on the storefront. Drafts and archived pages stay private.' },
  integrations: { label: 'Deliverect Setup', help: 'Review the selected environment, account and channel links, then run the offered diagnostics. Credentials stay server-side. Do not copy secrets into chat.' },
  connection_health: { label: 'Connection Status', help: 'Run the provided connection checks and inspect the failing stage. Healthy authentication does not prove catalogue, checkout or dispatch permissions.' },
  api_logs: { label: 'API Logs', help: 'Inspect received, verified and processed menu/webhook events. Use source health and timestamps; unavailable history is not an empty successful journal.' },
  domains: { label: 'Domains', help: 'Add the intended hostname, follow its ownership records, verify and check HTTPS readiness. Ownership verification alone does not prove the storefront is serving.' },
  media_health: { label: 'Media Health', help: 'Run a media check and inspect missing or unreachable assets. Fix the source image, then recheck the actual customer view.' },
  insights: { label: 'Insights', help: 'Choose the period and scope, then inspect the metric source and freshness. Missing financial evidence cannot be inferred from traffic or a model answer.' },
  audit: { label: 'Audit History', help: 'Review persisted changes by actor, time and tenant. A proposed change or clicked button is not a successful audit receipt.' },
  altie_facts: { label: 'Altie Facts', help: 'Super Admin can edit reference facts and aliases, save a draft, compare and publish. Drafts do not affect answers; audience controls decide who can retrieve published facts. Facts never grant permissions.' },
};

export function resolvePageGuide(message: string, section?: string) {
  const text = message.trim().toLowerCase();
  const explicit = Object.entries(ALTIE_PAGE_GUIDES).find(([, page]) => text.includes(page.label.toLowerCase()));
  const contextual = /\b(this page|this screen|here|what can i|what should i|how do i|how does|explain)\b/i.test(text);
  const id = explicit?.[0] || (contextual && section && ALTIE_PAGE_GUIDES[section] ? section : undefined);
  return id ? { section: id, ...ALTIE_PAGE_GUIDES[id] } : null;
}
