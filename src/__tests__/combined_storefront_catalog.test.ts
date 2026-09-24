import { describe, expect, it } from 'vitest';
import { materializeStorefrontCatalog, materializeStorefrontProducts, projectHostedMenusToCombinedCatalog } from '../../server/deliverect/CombinedStorefrontCatalog';

describe('WP-06 combined storefront menu round-trip', () => {
  const menus = [
    {
      locationId: 'master', channelLinkId: 'ch-master', menuId: 'catalog-1',
      categories: [{ id: 'drinks', name: 'Drinks' }],
      products: [
        { plu: 'COLA', gtin: '5000000000001', name: 'Cola', priceMinor: 200, stock: true },
        { plu: 'WATER', gtin: '5000000000002', name: 'Water', priceMinor: 100, stock: true, type: 'merchandise' },
      ],
    },
    {
      locationId: 'store-2', channelLinkId: 'ch-2', menuId: 'catalog-1',
      categories: [{ id: 'rogue', name: 'Store-specific structure must not win' }],
      products: [
        { plu: 'LOCAL-COLA', gtin: '5000000000001', name: 'Cola', priceMinor: 225, stock: true },
        { plu: 'LOCAL-WATER', gtin: '5000000000002', name: 'Water', priceMinor: 100, stock: false },
      ],
    },
  ];

  it('turns pushed menu snapshots into one canonical catalogue plus sparse location deltas', () => {
    const projection = projectHostedMenusToCombinedCatalog('master', menus);
    expect(Object.keys(projection.products)).toHaveLength(2);
    expect(projection.structure).toEqual({ categories: menus[0].categories });
    expect(projection.inventoryOverrides).toHaveLength(2);
    expect(projection.products['gtin:5000000000002'].type).toBe('merchandise');
    expect(projection.inventoryOverrides).toEqual(expect.arrayContaining([
      expect.objectContaining({ locationId: 'store-2', identityKey: 'gtin:5000000000001', price: 225 }),
      expect.objectContaining({ locationId: 'store-2', identityKey: 'gtin:5000000000002', stock: false }),
    ]));
  });

  it('materializes the selected store without mutating canonical product truth', () => {
    const projection = projectHostedMenusToCombinedCatalog('master', menus);
    const master = materializeStorefrontProducts(projection, 'master');
    const local = materializeStorefrontProducts(projection, 'store-2');
    expect(master['gtin:5000000000001'].price).toBe(200);
    expect(local['gtin:5000000000001'].price).toBe(225);
    expect(master['gtin:5000000000002'].stock).toBe(true);
    expect(local['gtin:5000000000002'].stock).toBe(false);
    expect(projection.products['gtin:5000000000001'].price).toBe(200);
  });

  it('applies independent snooze and store-state overlays last without contaminating master truth', () => {
    const projection = projectHostedMenusToCombinedCatalog('master', menus);
    const local = materializeStorefrontCatalog(projection, 'store-2', {
      status: 'BUSY',
      preparationTimeDelay: 15,
      products: {
        'LOCAL-COLA': { availability: 'SNOOZED' },
      },
    });

    expect(local.products['gtin:5000000000001'].snoozed).toBe(true);
    expect(local.products['gtin:5000000000001'].status).toBe('SNOOZED');
    expect(local.store.busy).toBe(true);
    expect(local.store.orderable).toBe(true);
    expect(local.store.preparationTimeDelay).toBe(15);
    expect(projection.products['gtin:5000000000001'].snoozed).not.toBe(true);

    const closed = materializeStorefrontCatalog(projection, 'store-2', { status: 'CLOSED' });
    expect(closed.store.orderable).toBe(false);
  });

  it('does not create a menu-per-store frontend structure', () => {
    const projection = projectHostedMenusToCombinedCatalog('master', menus);
    expect(projection.structure).toEqual({ categories: menus[0].categories });
    expect(projection.rogueCatalogs).toHaveLength(0);
  });
});
