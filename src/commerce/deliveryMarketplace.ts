export type DeliveryMarketplaceKey =
  | 'leitch-tech'
  | 'deliveroo'
  | 'uber-eats'
  | 'just-eat'
  | 'other';

export interface DeliveryMarketplaceIdentity {
  key: DeliveryMarketplaceKey;
  label: string;
  iconUrl?: string;
  colour: string;
  isLeitchTech: boolean;
  isThirdPartyMarketplace: boolean;
}

const MARKETPLACES: Record<DeliveryMarketplaceKey, DeliveryMarketplaceIdentity> = {
  'leitch-tech': {
    key: 'leitch-tech',
    label: 'Leitch Tech',
    iconUrl: '/brand/lt-logo.png',
    colour: '#0B4A57',
    isLeitchTech: true,
    isThirdPartyMarketplace: false,
  },
  deliveroo: {
    key: 'deliveroo',
    label: 'Deliveroo',
    iconUrl: 'https://cdn.simpleicons.org/deliveroo/00CCBC',
    colour: '#00CCBC',
    isLeitchTech: false,
    isThirdPartyMarketplace: true,
  },
  'uber-eats': {
    key: 'uber-eats',
    label: 'Uber Eats',
    iconUrl: 'https://cdn.simpleicons.org/ubereats/06C167',
    colour: '#06C167',
    isLeitchTech: false,
    isThirdPartyMarketplace: true,
  },
  'just-eat': {
    key: 'just-eat',
    label: 'Just Eat',
    iconUrl: 'https://cdn.simpleicons.org/justeat/FF8000',
    colour: '#FF8000',
    isLeitchTech: false,
    isThirdPartyMarketplace: true,
  },
  other: {
    key: 'other',
    label: 'Other channel',
    colour: '#64748B',
    isLeitchTech: false,
    isThirdPartyMarketplace: false,
  },
};

function searchable(values: unknown[]): string {
  return values
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

export function detectDeliveryMarketplace(...values: unknown[]): DeliveryMarketplaceIdentity {
  const text = searchable(values);
  if (/\bdeliveroo\b|\broofoods\b/.test(text)) return MARKETPLACES.deliveroo;
  if (/\buber\s*eats\b|\bubereats\b/.test(text)) return MARKETPLACES['uber-eats'];
  if (/\bjust\s*eat\b|\bjusteat\b/.test(text)) return MARKETPLACES['just-eat'];
  if (/\bleitch(?:\s+technology|\s+tech)?\b|\bltx\b|\bbwydi\b/.test(text)) return MARKETPLACES['leitch-tech'];
  return MARKETPLACES.other;
}

export function marketplaceForStore(store: any): DeliveryMarketplaceIdentity {
  const channelLinkId = String(store?.channelLinkId || '');
  const ownService = Array.isArray(store?.services)
    ? store.services.find((service: any) => String(service?.id || '') === channelLinkId)
    : undefined;
  const persistedKey = String(ownService?.marketplace || store?.marketplace || '') as DeliveryMarketplaceKey;
  if (persistedKey && MARKETPLACES[persistedKey]) return MARKETPLACES[persistedKey];
  return detectDeliveryMarketplace(
    ownService?.name,
    ownService?.channel,
    store?.channelName,
    store?.application,
    store?.channel,
    store?.provider
  );
}

