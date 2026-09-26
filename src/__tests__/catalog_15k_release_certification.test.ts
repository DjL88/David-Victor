import { describe, expect, it } from 'vitest';
import { projectChannelCatalogs } from '../../server/deliverect/ChannelCatalogProjection';

describe('Round 2 canonical catalogue 15k release guard', () => {
  it('projects the shipped 15,000-product ceiling without expanding per store', () => {
    const masterItems = Array.from({ length: 15_000 }, (_, index) => ({
      plu: `MASTER-${index}`,
      gtin: String(5000000000000 + index),
      name: `Product ${index}`,
      price: 100 + (index % 500),
      stock: true,
    }));
    const pushes = [
      { locationId: 'master', channelLinkId: 'master-ch', catalogId: 'catalog', items: masterItems },
      ...Array.from({ length: 799 }, (_, index) => ({
        locationId: `loc-${index}`,
        channelLinkId: `ch-${index}`,
        catalogId: 'catalog',
        items: [],
      })),
    ];

    const started = performance.now();
    const result = projectChannelCatalogs('master', pushes);
    const elapsedMs = performance.now() - started;

    expect(Object.keys(result.products)).toHaveLength(15_000);
    expect(result.inventoryOverrides).toHaveLength(0);
    expect(result.rogueCatalogs).toHaveLength(0);
    expect(elapsedMs).toBeLessThan(2_000);
  }, 10_000);
});
