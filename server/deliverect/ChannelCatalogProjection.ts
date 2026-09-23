/**
 * Channel catalogue projection rules.
 *
 * A tenant has one authoritative/master catalogue structure. Location menu pushes
 * may contribute PLUs and per-location inventory overrides, but cannot silently
 * replace the master category/menu structure.
 */
export interface ChannelCatalogItem {
  plu: string;
  gtin?: string | string[];
  name?: string;
  imageUrl?: string;
  price?: number;
  status?: string;
  stock?: number | boolean;
  snoozed?: boolean;
  [key: string]: unknown;
}

export interface LocationCatalogPush {
  locationId: string;
  channelLinkId: string;
  catalogId: string;
  items: ChannelCatalogItem[];
  structure?: unknown;
}

export interface LocationInventoryOverride {
  locationId: string;
  channelLinkId: string;
  plu: string;
  gtin?: string;
  identityKey: string;
  catalogId: string;
  name?: string;
  imageUrl?: string;
  price?: number;
  status?: string;
  stock?: number | boolean;
  snoozed?: boolean;
}

export interface RogueCatalogDiagnostic {
  locationId: string;
  channelLinkId: string;
  catalogId: string;
  masterCatalogId: string;
  reason: 'CATALOG_ID_MISMATCH';
}

export interface ChannelCatalogProjection {
  masterCatalogId: string;
  masterLocationId: string;
  structure?: unknown;
  products: Record<string, ChannelCatalogItem>;
  inventoryOverrides: LocationInventoryOverride[];
  rogueCatalogs: RogueCatalogDiagnostic[];
}

const cleanPlu = (value: unknown) => String(value ?? '').trim();

export function normalizeGtin(value: unknown): string | undefined {
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const cleaned = String(candidate ?? '').trim().replace(/\s+/g, '');
    if (cleaned) return cleaned;
  }
  return undefined;
}

/**
 * Tenant-wide product identity: prefer GTIN because it is stable across
 * Deliverect accounts/locations, then fall back to PLU when no GTIN exists.
 */
export function channelProductIdentity(item: Pick<ChannelCatalogItem, 'gtin' | 'plu'>): string | undefined {
  const gtin = normalizeGtin(item.gtin);
  if (gtin) return `gtin:${gtin}`;
  const plu = cleanPlu(item.plu);
  return plu ? `plu:${plu}` : undefined;
}

function overrideFrom(
  push: LocationCatalogPush,
  item: ChannelCatalogItem
): LocationInventoryOverride {
  const plu = cleanPlu(item.plu);
  const gtin = normalizeGtin(item.gtin);
  const identityKey = channelProductIdentity({ plu, gtin });
  if (!identityKey) throw new Error('Inventory override requires GTIN or PLU.');
  return {
    locationId: push.locationId,
    channelLinkId: push.channelLinkId,
    catalogId: push.catalogId,
    plu,
    ...(gtin ? { gtin } : {}),
    identityKey,
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.imageUrl !== undefined ? { imageUrl: item.imageUrl } : {}),
    ...(item.price !== undefined ? { price: item.price } : {}),
    ...(item.status !== undefined ? { status: item.status } : {}),
    ...(item.stock !== undefined ? { stock: item.stock } : {}),
    ...(item.snoozed !== undefined ? { snoozed: item.snoozed } : {}),
  };
}

/**
 * Projects multiple location pushes into one tenant catalogue.
 *
 * - master location owns structure and master catalogId
 * - GTIN is the canonical identity when present; PLU is the fallback
 * - this deliberately lets the same GTIN merge across multiple Deliverect accounts
 * - duplicate identities are de-duplicated deterministically (master wins across locations)
 * - other locations may add previously unseen identities to the canonical product set
 * - all location-specific mutable fields are emitted as inventory overrides
 * - non-master catalog IDs are diagnosed but their structure is ignored
 */
export function projectChannelCatalogs(
  masterLocationId: string,
  pushes: LocationCatalogPush[]
): ChannelCatalogProjection {
  const master = pushes.find((push) => push.locationId === masterLocationId);
  if (!master) throw new Error(`Master location ${masterLocationId} has no catalogue push.`);

  const products: Record<string, ChannelCatalogItem> = {};
  const inventoryOverrides: LocationInventoryOverride[] = [];
  const rogueCatalogs: RogueCatalogDiagnostic[] = [];

  for (const item of master.items || []) {
    const plu = cleanPlu(item?.plu);
    const gtin = normalizeGtin(item?.gtin);
    const identityKey = channelProductIdentity({ plu, gtin });
    if (!identityKey) continue;
    products[identityKey] = { ...item, plu, ...(gtin ? { gtin } : {}) };
    inventoryOverrides.push(overrideFrom(master, { ...item, plu, ...(gtin ? { gtin } : {}) }));
  }

  for (const push of pushes) {
    if (push.locationId === masterLocationId) continue;

    if (push.catalogId !== master.catalogId) {
      rogueCatalogs.push({
        locationId: push.locationId,
        channelLinkId: push.channelLinkId,
        catalogId: push.catalogId,
        masterCatalogId: master.catalogId,
        reason: 'CATALOG_ID_MISMATCH',
      });
    }

    for (const item of push.items || []) {
      const plu = cleanPlu(item?.plu);
      const gtin = normalizeGtin(item?.gtin);
      const identityKey = channelProductIdentity({ plu, gtin });
      if (!identityKey) continue;
      if (!products[identityKey]) {
        products[identityKey] = { ...item, plu, ...(gtin ? { gtin } : {}) };
      }
      inventoryOverrides.push(overrideFrom(push, { ...item, plu, ...(gtin ? { gtin } : {}) }));
    }
  }

  return {
    masterCatalogId: master.catalogId,
    masterLocationId,
    structure: master.structure,
    products,
    inventoryOverrides,
    rogueCatalogs,
  };
}
