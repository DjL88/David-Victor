export type DeliveryMarketplaceKey =
  | 'leitch-tech' | 'deliveroo' | 'doordash' | 'just-eat' | 'thuisbezorgd'
  | 'lieferando' | 'takeaway' | 'grubhub' | 'uber-eats' | 'glovo' | 'wolt'
  | 'snappy-shopper' | 'uber-direct' | 'jet-go' | 'other';

export type ChannelServiceKind = 'marketplace' | 'direct-delivery' | 'platform' | 'unknown';

export interface DeliveryMarketplaceIdentity {
  key: DeliveryMarketplaceKey;
  label: string;
  iconUrl?: string;
  colour: string;
  isLeitchTech: boolean;
  isThirdPartyMarketplace: boolean;
  serviceKind?: ChannelServiceKind;
  assetStatus?: 'official-source' | 'user-provided' | 'pending' | 'platform' | 'unknown';
  maxIconPixels?: number;
}

function identity(
  key: DeliveryMarketplaceKey, label: string, colour: string,
  serviceKind: ChannelServiceKind, asset?: string
): DeliveryMarketplaceIdentity {
  return Object.freeze({
    key, label, colour, serviceKind,
    iconUrl: asset ? `/brand/channels/${asset}` : undefined,
    isLeitchTech: serviceKind === 'platform',
    isThirdPartyMarketplace: serviceKind === 'marketplace',
    assetStatus: asset ? 'user-provided' : serviceKind === 'direct-delivery' ? 'pending' : 'unknown',
    maxIconPixels: 32,
  });
}

/** Public presentation identities, NOT provider numeric IDs or routing authorisation. */
export const CHANNEL_BRAND_REGISTRY: Readonly<Record<DeliveryMarketplaceKey, DeliveryMarketplaceIdentity>> = Object.freeze({
  'leitch-tech': Object.freeze({
    key: 'leitch-tech', label: 'Leitch Tech', iconUrl: '/brand/lt-logo.png',
    colour: '#0B4A57', isLeitchTech: true, isThirdPartyMarketplace: false,
    serviceKind: 'platform', assetStatus: 'platform', maxIconPixels: 40,
  }),
  deliveroo: identity('deliveroo', 'Deliveroo', '#00CCBC', 'marketplace', 'round/deliveroo.png'),
  doordash: identity('doordash', 'DoorDash', '#EB1700', 'marketplace', 'round/doordash.png'),
  'just-eat': identity('just-eat', 'Just Eat', '#FF8000', 'marketplace', 'round/just-eat.png'),
  thuisbezorgd: identity('thuisbezorgd', 'Thuisbezorgd.nl', '#FF8000', 'marketplace', 'round/thuisbezorgd.png'),
  lieferando: identity('lieferando', 'Lieferando', '#FF8000', 'marketplace', 'round/lieferando.png'),
  takeaway: identity('takeaway', 'Takeaway.com', '#FF8000', 'marketplace', 'round/takeaway.png'),
  grubhub: identity('grubhub', 'Grubhub', '#FF8000', 'marketplace', 'round/grubhub.png'),
  'uber-eats': identity('uber-eats', 'Uber Eats', '#06C167', 'marketplace', 'round/uber-eats.png'),
  glovo: identity('glovo', 'Glovo', '#00A082', 'marketplace', 'round/glovo.png'),
  wolt: identity('wolt', 'Wolt', '#009DE0', 'marketplace', 'round/wolt.png'),
  'snappy-shopper': identity('snappy-shopper', 'Snappy Shopper', '#174E86', 'marketplace', 'round/snappy-shopper.png'),
  // User-supplied partner artwork is reserved for dispatch tracking, never marketplace links.
  'uber-direct': Object.freeze({
    ...identity('uber-direct', 'Uber Direct', '#000000', 'direct-delivery', 'round/uber-direct.png'),
    assetStatus: 'user-provided' as const,
  }),
  'jet-go': Object.freeze({
    ...identity('jet-go', 'JET Go', '#FF8000', 'direct-delivery', 'round/jet-go.png'),
    assetStatus: 'user-provided' as const,
  }),
  other: identity('other', 'Other channel', '#64748B', 'unknown'),
});

export const CHANNEL_NAME_ALIASES: Readonly<Record<string, DeliveryMarketplaceKey>> = Object.freeze({
  'deliveroo': 'deliveroo', 'roofoods': 'deliveroo',
  'doordash': 'doordash', 'door dash': 'doordash',
  'just eat': 'just-eat', 'justeat': 'just-eat',
  'thuisbezorgd': 'thuisbezorgd', 'thuisbezorgd.nl': 'thuisbezorgd',
  'lieferando': 'lieferando', 'lieferando.de': 'lieferando', 'lieferando.at': 'lieferando',
  'takeaway': 'takeaway', 'takeaway.com': 'takeaway',
  'grubhub': 'grubhub', 'grub hub': 'grubhub',
  'uber eats': 'uber-eats', 'ubereats': 'uber-eats',
  'glovo': 'glovo', 'wolt': 'wolt',
  'snappy shopper': 'snappy-shopper', 'snappyshopper': 'snappy-shopper',
  'uber direct': 'uber-direct', 'uberdirect': 'uber-direct',
  'jet go': 'jet-go', 'jetgo': 'jet-go', 'just eat go': 'jet-go', 'justeatgo': 'jet-go',
  'leitch tech': 'leitch-tech', 'leitch technology': 'leitch-tech', 'leitch': 'leitch-tech',
  'ltx': 'leitch-tech', 'bwydi': 'leitch-tech',
});

function normalise(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function ownKey(value: unknown): DeliveryMarketplaceKey | undefined {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CHANNEL_BRAND_REGISTRY, value)
    ? value as DeliveryMarketplaceKey : undefined;
}

function exactAlias(value: string): DeliveryMarketplaceKey | undefined {
  return Object.prototype.hasOwnProperty.call(CHANNEL_NAME_ALIASES, value)
    ? CHANNEL_NAME_ALIASES[value] : undefined;
}

export function detectDeliveryMarketplace(...values: unknown[]): DeliveryMarketplaceIdentity {
  // Values remain separate: ['Uber', 'Direct'] must not invent a product identity.
  // Ignore numbers/objects; Deliverect numeric channel IDs require verified metadata.
  const texts = values.flatMap(value => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .map(normalise).filter(Boolean);
  for (const text of texts) {
    const key = exactAlias(text);
    if (key) return CHANNEL_BRAND_REGISTRY[key];
  }
  for (const text of texts) {
    // Explicit product distinctions precede looser marketplace-name matching.
    if (/\buber\s*direct\b/.test(text)) return CHANNEL_BRAND_REGISTRY['uber-direct'];
    if (/\b(?:jet\s*go|just\s*eat\s*go)\b/.test(text)) return CHANNEL_BRAND_REGISTRY['jet-go'];
    if (/\b(?:door\s*dash|wolt)\s+drive\b/.test(text)) continue;
    if (/\bdeliveroo\b|\broofoods\b/.test(text)) return CHANNEL_BRAND_REGISTRY.deliveroo;
    if (/\bdoor\s*dash\b/.test(text)) return CHANNEL_BRAND_REGISTRY.doordash;
    if (/\bjust\s*eat\b/.test(text)) return CHANNEL_BRAND_REGISTRY['just-eat'];
    if (/\bthuisbezorgd(?:\.nl)?\b/.test(text)) return CHANNEL_BRAND_REGISTRY.thuisbezorgd;
    if (/\blieferando(?:\.(?:de|at))?\b/.test(text)) return CHANNEL_BRAND_REGISTRY.lieferando;
    if (/\btakeaway\.com\b/.test(text)) return CHANNEL_BRAND_REGISTRY.takeaway;
    if (/\bgrub\s*hub\b/.test(text)) return CHANNEL_BRAND_REGISTRY.grubhub;
    if (/\buber\s*eats\b/.test(text)) return CHANNEL_BRAND_REGISTRY['uber-eats'];
    if (/\bglovo\b/.test(text)) return CHANNEL_BRAND_REGISTRY.glovo;
    if (/\bwolt\b/.test(text)) return CHANNEL_BRAND_REGISTRY.wolt;
    if (/\bsnappy\s*shopper\b/.test(text)) return CHANNEL_BRAND_REGISTRY['snappy-shopper'];
    if (/\bleitch(?:\s+technology|\s+tech)?\b|\bltx\b|\bbwydi\b/.test(text)) return CHANNEL_BRAND_REGISTRY['leitch-tech'];
  }
  return CHANNEL_BRAND_REGISTRY.other;
}

export function marketplaceForStore(store: any): DeliveryMarketplaceIdentity {
  const channelLinkId = String(store?.channelLinkId || '');
  const ownService = channelLinkId && Array.isArray(store?.services)
    ? store.services.find((service: any) => String(service?.id || '') === channelLinkId)
    : undefined;
  const persistedKey = ownKey(ownService?.marketplace || store?.marketplace);
  if (persistedKey) return CHANNEL_BRAND_REGISTRY[persistedKey];
  return detectDeliveryMarketplace(
    ownService?.name, ownService?.channel, store?.channelName,
    store?.application, store?.channel, store?.provider
  );
}

export function isStorefrontChannelStatusVisible(status: unknown): boolean {
  const normalized = String(status ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return normalized === 'ACTIVE' || normalized === 'SUBSCRIBED' || normalized === 'ONBOARDING' || normalized === 'ON_BOARDING';
}

export function isStorefrontMarketplaceService(service: any): boolean {
  if (!isStorefrontChannelStatusVisible(service?.status)) return false;
  return detectDeliveryMarketplace(service?.marketplace, service?.name, service?.channel).serviceKind === 'marketplace';
}

export function dispatchProviderIdentity(order: any): DeliveryMarketplaceIdentity | undefined {
  const identity = detectDeliveryMarketplace(
    order?.dispatch?.providerDisplayName,
    order?.dispatch?.providerId,
    order?.delivery?.deliveryOption?.providerName,
    order?.delivery?.deliveryOption?.displayName,
    order?.delivery?.deliveryOption?.providerId,
  );
  return identity.serviceKind === 'direct-delivery' ? identity : undefined;
}
