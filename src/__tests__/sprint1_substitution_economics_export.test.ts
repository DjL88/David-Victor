import { describe, expect, it } from 'vitest';
import { SubstitutionEconomicsExportService } from '../../server/substitutionEconomicsExportService';

describe('Sprint 1 substitution economics export', () => {
  const order = {
    orderId: 'ord-export-1',
    orderReference: 'REF-EXPORT-1',
    tenantId: 'tenant-a',
    channelLinkId: 'location-a',
    status: 'PICKING_WITH_CHANGES',
    total: 300,
    itemsCount: 1,
    fulfillmentType: 'pickup',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    picking: {
      status: 'IN_PROGRESS',
      totalItems: 1,
      itemsPicked: 1,
      hasChanges: true,
      items: [{
        id: 'line-1',
        plu: 'ORIGINAL',
        name: 'Original',
        originalQuantity: 1,
        pickedQuantity: 2,
        originalPrice: { amount: 300, currency: 'GBP' },
        finalPrice: { amount: 100, currency: 'GBP' },
        state: 'SUBSTITUTED',
        substitution: {
          type: 'BEST_MATCH',
          originalPlu: 'ORIGINAL',
          originalName: 'Original',
          originalPrice: { amount: 300, currency: 'GBP' },
          substitutePlu: 'REPLACEMENT',
          substituteName: 'Replacement',
          substitutePrice: { amount: 130, currency: 'GBP' },
          replacementQuantity: 2,
          chargedPrice: { amount: 100, currency: 'GBP' },
          economics: {
            originalQuantity: 1,
            replacementQuantity: 2,
            originalEffectiveLineTotal: { amount: 300, currency: 'GBP' },
            replacementRetailLineTotal: { amount: 260, currency: 'GBP' },
            replacementEffectiveLineTotal: { amount: 200, currency: 'GBP' },
            customerChargeLineTotal: { amount: 200, currency: 'GBP' },
            retailValueDelta: { amount: -40, currency: 'GBP' },
            customerPriceDelta: { amount: -100, currency: 'GBP' },
            priceProtectionAmount: { amount: 0, currency: 'GBP' },
            originalPromotionProvenance: [],
            replacementPromotionProvenance: ['promo:replacement-2-for-200'],
          },
        },
      }],
    },
  } as any;

  it('preserves signed retail/customer deltas and provenance in CSV', () => {
    const rows = SubstitutionEconomicsExportService.buildRows([order], 'tenant-a');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: 'tenant-a',
      locationId: 'location-a',
      orderReference: 'REF-EXPORT-1',
      originalName: 'Original',
      originalUnitPrice: 300,
      substituteName: 'Replacement',
      replacementUnitPrice: 130,
      originalQuantity: 1,
      replacementQuantity: 2,
      retailValueDelta: -40,
      customerPriceDelta: -100,
      originalEffectiveLineTotal: 300,
      customerChargeLineTotal: 200,
      replacementPromotionProvenance: 'promo:replacement-2-for-200',
    });

    const csv = SubstitutionEconomicsExportService.toCsv(rows);
    expect(csv).toContain('orderReference');
    expect(csv).toContain('locationId');
    expect(csv).toContain('originalUnitPrice');
    expect(csv).toContain('replacementUnitPrice');
    expect(csv).toContain('retailValueDelta');
    expect(csv).toContain('customerPriceDelta');
    expect(csv).toContain(',-40,-100,');
    expect(csv).toContain('promo:replacement-2-for-200');
  });

  it('defensively excludes orders belonging to another tenant', () => {
    const rows = SubstitutionEconomicsExportService.buildRows(
      [order, { ...order, orderId: 'ord-export-b', tenantId: 'tenant-b' }],
      'tenant-a'
    );
    expect(rows.map((row) => row.orderId)).toEqual(['ord-export-1']);
  });
});
