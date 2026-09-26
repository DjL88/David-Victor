const ADMIN_ASSISTANT_SECTIONS = new Set([
  'brands',
  'memberships',
  'connection_health',
  'api_logs',
  'catalog',
  'integrations',
  'insights',
  'branding',
  'hero_banners',
  'search_merch',
  'pages',
  'domains',
  'media_health',
  'stories',
  'fees',
  'product_rules',
  'courier_settings',
  'order_scheduling',
  'languages',
  'features',
  'stores',
  'audit',
]);

const SAFE_TARGET = /^[A-Za-z0-9._:-]{1,160}$/;

export function isSafeAdminAssistantSection(value: unknown): boolean {
  return typeof value === 'string' && ADMIN_ASSISTANT_SECTIONS.has(value);
}

export function isSafeAdminAssistantTarget(value: unknown): boolean {
  return value === undefined || (typeof value === 'string' && SAFE_TARGET.test(value));
}

export function isSafeAdminAssistantNavigation(section: unknown, target?: unknown): boolean {
  return isSafeAdminAssistantSection(section) && isSafeAdminAssistantTarget(target);
}
