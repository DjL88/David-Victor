import type { TenantFeatureFlags } from '../commerce/models';

export type FeatureSwitchOwner =
  | 'CONTENT'
  | 'CATALOGUE'
  | 'FULFILMENT'
  | 'COMPLIANCE'
  | 'CHECKOUT'
  | 'INTEGRATION'
  | 'PLATFORM';

export interface TenantFeatureDefinition {
  key: keyof TenantFeatureFlags;
  title: string;
  description: string;
  owner: FeatureSwitchOwner;
  /** Tenant admins may deliberately change this capability from the Features page. */
  tenantConfigurable: boolean;
  /** Only platform superadmins can view or change this switch. */
  platformOnly?: boolean;
  /** Effective value when an older tenant config has not stored the switch yet. */
  defaultEnabled?: boolean;
  unavailableReason?: string;
}

export const TENANT_FEATURE_DEFINITIONS: readonly TenantFeatureDefinition[] = [
  { key: 'showLtLaunchSplash', title: 'LT first-launch film', description: 'Show the LT launch film once per browser before this retailer storefront first opens.', owner: 'PLATFORM', tenantConfigurable: false, platformOnly: true, defaultEnabled: true },
  { key: 'showLtFooterWatermark', title: 'LT footer watermark', description: 'Show the subtle LT platform mark in the customer storefront footer. Disable only for an agreed unbranded plan.', owner: 'PLATFORM', tenantConfigurable: false, platformOnly: true, defaultEnabled: true },
  { key: 'enableStories', title: 'Stories', description: 'Show published Story content on the storefront.', owner: 'CONTENT', tenantConfigurable: true },
  { key: 'enableSearchSuggestions', title: 'Search suggestions', description: 'Show query suggestions while customers search.', owner: 'CATALOGUE', tenantConfigurable: true },
  { key: 'enableRootCatalogBrowse', title: 'Browse before choosing a location', description: 'Allow catalogue browsing before a fulfilment location is selected.', owner: 'CATALOGUE', tenantConfigurable: true },
  { key: 'enableCollection', title: 'Collection', description: 'Offer collection where the selected location and integration support it.', owner: 'FULFILMENT', tenantConfigurable: true },
  { key: 'enableAgeVerification', title: 'Age verification capability', description: 'Market and product age restrictions remain enforced independently.', owner: 'COMPLIANCE', tenantConfigurable: false, unavailableReason: 'Planned: verified staff/customer age-check workflow is not connected.' },
  { key: 'enableDepositReturnScheme', title: 'Configured deposit charges', description: 'Deposit configuration must be connected to basket and payment calculations before activation.', owner: 'COMPLIANCE', tenantConfigurable: false, unavailableReason: 'Planned: deposit charging is not connected.' },
  { key: 'enableTipCourier', title: 'Courier tipping', description: 'Requires a supported live payment and delivery integration.', owner: 'CHECKOUT', tenantConfigurable: false, unavailableReason: 'Planned: live courier tipping is not connected.' },
  { key: 'enableSequentialCategoryGrouping', title: 'Sequential category grouping', description: 'Interpret supported empty provider categories as catalogue group headings.', owner: 'INTEGRATION', tenantConfigurable: true },
] as const;

export const TENANT_CONFIGURABLE_FEATURE_KEYS = new Set<keyof TenantFeatureFlags>(
  TENANT_FEATURE_DEFINITIONS.filter((definition) => definition.tenantConfigurable).map((definition) => definition.key)
);
