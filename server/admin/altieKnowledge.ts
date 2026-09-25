export const ALTIE_KNOWLEDGE_VERSION = '2026-09-25.1';

export interface AltiePageKnowledge {
  section: string;
  label: string;
  purpose: string;
  safeTargets?: string[];
}

const PAGES: AltiePageKnowledge[] = [
  { section: 'brands', label: 'Brands', purpose: 'Platform tenant selection and brand provisioning.' },
  { section: 'memberships', label: 'Team & Access', purpose: 'Tenant membership, roles and access management.' },
  { section: 'stores', label: 'Locations', purpose: 'Location configuration, opening settings and delivery radius.', safeTargets: ['stores-opening-hours', 'stores-batch-radius'] },
  { section: 'catalog', label: 'Products & Stock', purpose: 'Catalogue, ranging, stock and storefront visibility diagnostics.' },
  { section: 'fees', label: 'Fees', purpose: 'Tenant fee policy review and configuration.', safeTargets: ['fees-fixed-delivery', 'fees-save'] },
  { section: 'product_rules', label: 'Product rules', purpose: 'Where → Action product rules and conflict-safe authoring.' },
  { section: 'courier_settings', label: 'Courier settings', purpose: 'Dispatch and courier policy controls represented by the rules engine.' },
  { section: 'order_scheduling', label: 'Order scheduling', purpose: 'ASAP and scheduled-order policy controls represented by the rules engine.' },
  { section: 'branding', label: 'Branding', purpose: 'Logos, colours, typography and brand identity.', safeTargets: ['branding-logo', 'branding-primary-colour', 'branding-typography', 'branding-save'] },
  { section: 'languages', label: 'Languages & wording', purpose: 'Locales, dialects and tenant-specific storefront terminology.' },
  { section: 'features', label: 'Feature switches', purpose: 'Tenant feature switches exposed by Admin.' },
  { section: 'hero_banners', label: 'Banners', purpose: 'Storefront banner authoring and visibility.' },
  { section: 'stories', label: 'Stories', purpose: 'Storefront story media and visibility authoring.' },
  { section: 'search_merch', label: 'Search & Recommendations', purpose: 'Search merchandising and recommendation configuration.' },
  { section: 'pages', label: 'Pages', purpose: 'CMS pages, translated variants and navigation visibility.' },
  { section: 'integrations', label: 'Deliverect Setup', purpose: 'Tenant-scoped Deliverect connection, account selection, location assignment and provisioning guidance.' },
  { section: 'connection_health', label: 'Connection Status', purpose: 'Read-only operational readiness and Deliverect connection diagnostics.' },
  { section: 'domains', label: 'Domains', purpose: 'Tenant domain connection, verification, routing and TLS readiness.' },
  { section: 'media_health', label: 'Media Health', purpose: 'Read-only diagnosis of missing or unreachable media.' },
  { section: 'insights', label: 'Insights', purpose: 'Tenant reporting and operational insight views.' },
  { section: 'audit', label: 'Audit History', purpose: 'Tenant-scoped audit trail and change history.' },
];

const DELIVERECT_READ_ONLY_KNOWLEDGE = {
  mode: 'READ_ONLY_GUIDANCE',
  concepts: [
    'Account: the Deliverect account mapped to the active tenant.',
    'Location/channel link: the store/channel association used to scope menus and operational callbacks.',
    'Menu/catalogue: product and category data supplied through the configured Deliverect integration path.',
    'Orders/picking: order lifecycle and Quest picking or amendment state handled through documented integration callbacks.',
    'Diagnostics: connection health, menu preview concepts, traces and callback evidence are diagnostic signals rather than mutation permission.',
  ],
  guardrails: [
    'Use only tenant-scoped state and read-only diagnostics exposed by this application.',
    'Do not invent provider hosts, payload fields, status codes, payment enums or callback contracts.',
    'When a provider contract is pending or unsupported, say so and coach through verification rather than fabricating a value.',
    'Any future Deliverect-linked mutation must be narrow, typed, tenant-scoped and approval-gated.',
  ],
};

const SHARED_INVARIANTS = [
  'The authenticated server resolves tenant scope; model-supplied tenant identifiers never become authorization context.',
  'Writes require a registered capability, preview or ChangeSet, permission or approval, typed execution, result verification and audit.',
  'Prefer reversible drafts and previews. Never claim a change happened until the application returns an explicit success result.',
  'There is no dedicated Admin Orders mutation screen in the current workspace; do not invent one.',
];

export function getAltieKnowledgeContext(section?: string) {
  const currentPage = PAGES.find((page) => page.section === section) || null;
  return {
    version: ALTIE_KNOWLEDGE_VERSION,
    currentPage,
    adminDirectory: PAGES.map(({ section: pageSection, label, purpose }) => ({ section: pageSection, label, purpose })),
    invariants: SHARED_INVARIANTS,
    deliverect: DELIVERECT_READ_ONLY_KNOWLEDGE,
  };
}
