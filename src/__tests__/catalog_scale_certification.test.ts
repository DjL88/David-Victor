import { describe, expect, it } from 'vitest';
import { projectChannelCatalogs } from '../../server/deliverect/ChannelCatalogProjection';

describe('WP-13/14 canonical catalogue scale certification', () => {
  it('projects 10,000 canonical products across 800 stores without 8,000,000 product copies', () => {
    const productCount = 10_000;
    const storeCount = 800;
    const masterItems = Array.from({ length: productCount }, (_, i) => ({
      plu: `MASTER-${i}`,
      gtin: String(5000000000000 + i),
      name: `Product ${i}`,
      price: 100 + (i % 500),
      stock: true,
    }));

    // Only ten stores have a real local difference, and only one product each.
    // Every other location is represented by the same canonical catalogue truth.
    const pushes = [
      { locationId: 'loc-0', channelLinkId: 'ch-0', catalogId: 'catalog-master', items: masterItems },
      ...Array.from({ length: storeCount - 1 }, (_, storeIndex) => {
        const changedIndex = storeIndex < 10 ? storeIndex : -1;
        return {
          locationId: `loc-${storeIndex + 1}`,
          channelLinkId: `ch-${storeIndex + 1}`,
          catalogId: 'catalog-master',
          items: changedIndex >= 0
            ? [{ ...masterItems[changedIndex], plu: `LOCAL-${storeIndex}`, price: masterItems[changedIndex].price + 25 }]
            : [],
        };
      }),
    ];

    const started = performance.now();
    const result = projectChannelCatalogs('loc-0', pushes);
    const elapsedMs = performance.now() - started;

    expect(Object.keys(result.products)).toHaveLength(productCount);
    expect(result.inventoryOverrides).toHaveLength(10);
    expect(result.inventoryOverrides.every((override) => override.price !== undefined)).toBe(true);
    expect(result.inventoryOverrides.every((override) => override.name === undefined)).toBe(true);
    expect(result.inventoryOverrides.every((override) => override.stock === undefined)).toBe(true);
    expect(result.rogueCatalogs).toHaveLength(0);

    // Deterministic in-process guardrail, deliberately generous for shared CI.
    // This catches accidental O(products × stores) expansion without pretending
    // to be the deployed p95 latency certification.
    expect(elapsedMs).toBeLessThan(2_000);
  }, 10_000);

  it('collapses an override when local truth returns to canonical truth', () => {
    const master = {
      locationId: 'master', channelLinkId: 'master-ch', catalogId: 'catalog',
      items: [{ plu: 'A', gtin: '5000000000001', name: 'Cola', price: 200, stock: true }],
    };
    const changed = projectChannelCatalogs('master', [
      master,
      { locationId: 'local', channelLinkId: 'local-ch', catalogId: 'catalog',
        items: [{ plu: 'LOCAL-A', gtin: '5000000000001', name: 'Cola', price: 225, stock: true }] },
    ]);
    expect(changed.inventoryOverrides).toHaveLength(1);
    expect(changed.inventoryOverrides[0]).toMatchObject({ locationId: 'local', price: 225 });

    const reverted = projectChannelCatalogs('master', [
      master,
      { locationId: 'local', channelLinkId: 'local-ch', catalogId: 'catalog',
        items: [{ plu: 'LOCAL-A', gtin: '5000000000001', name: 'Cola', price: 200, stock: true }] },
    ]);
    expect(reverted.inventoryOverrides).toHaveLength(0);
  });

  it('keeps rogue catalogue structure out of the combined storefront projection at scale', () => {
    const result = projectChannelCatalogs('master', [
      {
        locationId: 'master', channelLinkId: 'master-ch', catalogId: 'canonical',
        structure: { categories: ['Combined storefront'] },
        items: [{ plu: 'A', gtin: '5000000000001', name: 'Apple', price: 100 }],
      },
      ...Array.from({ length: 799 }, (_, i) => ({
        locationId: `loc-${i}`, channelLinkId: `ch-${i}`,
        catalogId: i === 798 ? 'rogue-menu' : 'canonical',
        structure: { categories: [`Store menu ${i}`] },
        items: [],
      })),
    ]);
    expect(result.structure).toEqual({ categories: ['Combined storefront'] });
    expect(result.rogueCatalogs).toHaveLength(1);
    expect(result.rogueCatalogs[0]).toMatchObject({ catalogId: 'rogue-menu', reason: 'CATALOG_ID_MISMATCH' });
  });
});
