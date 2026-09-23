/**
 * Channel catalogue projection rules.
 *
 * A tenant has one authoritative/master catalogue structure. Location menu pushes
 * may contribute PLUs and per-location inventory overrides, but cannot silently
 * replace the master category/menu structure.
 */
export interface ChannelCatalogItem {
  plu: string;
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

function overrideFrom(
  push: LocationCatalogPush,
  item: ChannelCatalogItem
): LocationInventoryOverride {
  return {
    locationId: push.locationId,
    channelLinkId: push.channelLinkId,
    catalogId: push.catalogId,
    plu: cleanPlu(item.plu),
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
 * - PLU is the canonical product identity
 * - master-location duplicate PLUs are de-duplicated deterministically (last value wins)
 * - other locations may add previously unseen PLUs to the canonical product set
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
    if (!plu) continue;
    products[plu] = { ...item, plu };
    inventoryOverrides.push(overrideFrom(master, { ...item, plu }));
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
      if (!plu) continue;
      if (!products[plu]) products[plu] = { ...item, plu };
      inventoryOverrides.push(overrideFrom(push, { ...item, plu }));
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
