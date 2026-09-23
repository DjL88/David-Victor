import { describe, expect, it } from 'vitest';
import { projectChannelCatalogs } from '../../server/deliverect/ChannelCatalogProjection';

describe('Channel catalogue projection', () => {
  it('keeps master structure, de-duplicates products by PLU and records location overrides', () => {
    const result = projectChannelCatalogs('loc-master', [
      {
        locationId: 'loc-master',
        channelLinkId: 'ch-master',
        catalogId: 'catalog-master',
        structure: { categories: ['Food', 'Drinks'] },
        items: [
          { plu: 'A', name: 'Apple', price: 100, stock: true },
          { plu: 'B', name: 'Water', price: 150, stock: true },
        ],
      },
      {
        locationId: 'loc-2',
        channelLinkId: 'ch-2',
        catalogId: 'catalog-master',
        structure: { categories: ['This structure must not replace master'] },
        items: [
          { plu: 'A', name: 'Apple local', price: 120, stock: false, snoozed: true },
          { plu: 'C', name: 'Banana', price: 90, stock: true },
        ],
      },
    ]);

    expect(result.masterCatalogId).toBe('catalog-master');
    expect(result.structure).toEqual({ categories: ['Food', 'Drinks'] });
    expect(Object.keys(result.products).sort()).toEqual(['A', 'B', 'C']);
    expect(result.products.A.name).toBe('Apple');
    expect(result.inventoryOverrides).toContainEqual(
      expect.objectContaining({
        locationId: 'loc-2',
        plu: 'A',
        price: 120,
        stock: false,
        snoozed: true,
      })
    );
  });

  it('flags a rogue location catalogue ID while ignoring its structure', () => {
    const result = projectChannelCatalogs('loc-master', [
      {
        locationId: 'loc-master',
        channelLinkId: 'ch-master',
        catalogId: 'catalog-master',
        structure: { categories: ['Canonical'] },
        items: [{ plu: 'A', name: 'Apple' }],
      },
      {
        locationId: 'loc-rogue',
        channelLinkId: 'ch-rogue',
        catalogId: 'catalog-other',
        structure: { categories: ['Rogue'] },
        items: [{ plu: 'A', price: 99 }],
      },
    ]);

    expect(result.structure).toEqual({ categories: ['Canonical'] });
    expect(result.rogueCatalogs).toEqual([
      {
        locationId: 'loc-rogue',
        channelLinkId: 'ch-rogue',
        catalogId: 'catalog-other',
        masterCatalogId: 'catalog-master',
        reason: 'CATALOG_ID_MISMATCH',
      },
    ]);
  });

  it('requires the configured master location to have a catalogue', () => {
    expect(() => projectChannelCatalogs('missing', [])).toThrow(/Master location missing/);
  });
});
