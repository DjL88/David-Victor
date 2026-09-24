import {
  projectChannelCatalogs,
  type ChannelCatalogItem,
  type ChannelCatalogProjection,
  type LocationCatalogPush,
} from './ChannelCatalogProjection';

export interface HostedChannelMenuSnapshot {
  locationId: string;
  channelLinkId: string;
  menuId: string;
  catalogId?: string;
  categories?: unknown[];
  products?: Array<{
    plu: string;
    gtin?: string | string[];
    name?: string;
    imageUrl?: string;
    priceMinor?: number;
    status?: string;
    stock?: number | boolean;
    snoozed?: boolean;
  }>;
}

/**
 * Converts durable hosted Channel Menu snapshots into the single combined
 * storefront catalogue model. Deliverect menus are ingestion inputs; they do
 * not become independent shop-menu frontends.
 */
export function projectHostedMenusToCombinedCatalog(
  masterLocationId: string,
  menus: HostedChannelMenuSnapshot[]
): ChannelCatalogProjection {
  const pushes: LocationCatalogPush[] = menus.map((menu) => ({
    locationId: menu.locationId,
    channelLinkId: menu.channelLinkId,
    catalogId: String(menu.catalogId || menu.menuId),
    structure: { categories: menu.categories || [] },
    items: (menu.products || []).map((product): ChannelCatalogItem => ({
      plu: product.plu,
      ...(product.gtin ? { gtin: product.gtin } : {}),
      ...(product.name !== undefined ? { name: product.name } : {}),
      ...(product.imageUrl !== undefined ? { imageUrl: product.imageUrl } : {}),
      ...(product.priceMinor !== undefined ? { price: product.priceMinor } : {}),
      ...(product.status !== undefined ? { status: product.status } : {}),
      ...(product.stock !== undefined ? { stock: product.stock } : {}),
      ...(product.snoozed !== undefined ? { snoozed: product.snoozed } : {}),
    })),
  }));
  return projectChannelCatalogs(masterLocationId, pushes);
}

export function materializeStorefrontProducts(
  projection: ChannelCatalogProjection,
  locationId: string
): Record<string, ChannelCatalogItem> {
  const result: Record<string, ChannelCatalogItem> = {};
  const local = projection.inventoryOverrides.filter((o) => o.locationId === locationId);
  const byIdentity = new Map(local.map((o) => [o.identityKey, o]));

  for (const [identity, canonical] of Object.entries(projection.products)) {
    const override = byIdentity.get(identity);
    result[identity] = override
      ? {
          ...canonical,
          ...(override.name !== undefined ? { name: override.name } : {}),
          ...(override.imageUrl !== undefined ? { imageUrl: override.imageUrl } : {}),
          ...(override.price !== undefined ? { price: override.price } : {}),
          ...(override.status !== undefined ? { status: override.status } : {}),
          ...(override.stock !== undefined ? { stock: override.stock } : {}),
          ...(override.snoozed !== undefined ? { snoozed: override.snoozed } : {}),
        }
      : { ...canonical };
  }
  return result;
}
