import { FirestorePlatformService, OrderProjection } from './firestoreService';

export interface SubstitutionEconomicsExportRow {
  tenantId: string;
  locationId: string;
  orderId: string;
  orderReference: string;
  plu: string;
  originalPlu: string;
  originalName: string;
  originalUnitPrice: number;
  substitutePlu: string;
  substituteName: string;
  replacementUnitPrice: number;
  decisionStatus: string;
  originalQuantity: number;
  replacementQuantity: number;
  currency: string;
  originalEffectiveLineTotal: number;
  replacementRetailLineTotal: number;
  replacementEffectiveLineTotal: number;
  customerChargeLineTotal: number;
  retailValueDelta: number;
  customerPriceDelta: number;
  priceProtectionAmount: number;
  originalPromotionProvenance: string;
  replacementPromotionProvenance: string;
}

const COLUMNS: Array<keyof SubstitutionEconomicsExportRow> = [
  'tenantId',
  'locationId',
  'orderId',
  'orderReference',
  'plu',
  'originalPlu',
  'originalName',
  'originalUnitPrice',
  'substitutePlu',
  'substituteName',
  'replacementUnitPrice',
  'decisionStatus',
  'originalQuantity',
  'replacementQuantity',
  'currency',
  'originalEffectiveLineTotal',
  'replacementRetailLineTotal',
  'replacementEffectiveLineTotal',
  'customerChargeLineTotal',
  'retailValueDelta',
  'customerPriceDelta',
  'priceProtectionAmount',
  'originalPromotionProvenance',
  'replacementPromotionProvenance',
];

function protectSpreadsheetText(value: string): string {
  return /^[=+@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  const safe = protectSpreadsheetText(value);
  return `"${safe.replace(/"/g, '""')}"`;
}

export class SubstitutionEconomicsExportService {
  static buildRows(
    orders: OrderProjection[],
    tenantId: string
  ): SubstitutionEconomicsExportRow[] {
    const cleanTenantId = String(tenantId || '').trim();
    if (!cleanTenantId) {
      throw new Error('tenantId is required for substitution economics export.');
    }

    const rows: SubstitutionEconomicsExportRow[] = [];
    for (const order of orders) {
      // Defence in depth: callers may never export another tenant's lines even
      // if an upstream query accidentally returns a mixed result.
      if (order.tenantId !== cleanTenantId) continue;

      for (const item of order.picking?.items || []) {
        const substitution = item.substitution;
        const economics = substitution?.economics;
        if (!substitution || !economics) continue;

        rows.push({
          tenantId: cleanTenantId,
          locationId: String(
            (order as any).locationId ||
            (order as any).deliverectLocationId ||
            order.channelLinkId ||
            ''
          ),
          orderId: order.orderId,
          orderReference: String(
            order.orderReference ||
            (order as any).channelOrderReference ||
            (order as any).channelOrderDisplayId ||
            order.orderId
          ),
          plu: item.plu,
          originalPlu: substitution.originalPlu,
          originalName: substitution.originalName || item.name || '',
          originalUnitPrice: substitution.originalPrice.amount,
          substitutePlu: substitution.substitutePlu,
          substituteName: substitution.substituteName || '',
          replacementUnitPrice: substitution.substitutePrice.amount,
          decisionStatus: substitution.decisionStatus || '',
          originalQuantity: economics.originalQuantity,
          replacementQuantity: economics.replacementQuantity,
          currency: economics.customerChargeLineTotal.currency,
          originalEffectiveLineTotal: economics.originalEffectiveLineTotal.amount,
          replacementRetailLineTotal: economics.replacementRetailLineTotal.amount,
          replacementEffectiveLineTotal: economics.replacementEffectiveLineTotal.amount,
          customerChargeLineTotal: economics.customerChargeLineTotal.amount,
          retailValueDelta: economics.retailValueDelta.amount,
          customerPriceDelta: economics.customerPriceDelta.amount,
          priceProtectionAmount: economics.priceProtectionAmount.amount,
          originalPromotionProvenance: (economics.originalPromotionProvenance || []).join('|'),
          replacementPromotionProvenance: (economics.replacementPromotionProvenance || []).join('|'),
        });
      }
    }
    return rows;
  }

  static toCsv(rows: SubstitutionEconomicsExportRow[]): string {
    const header = COLUMNS.join(',');
    const body = rows.map((row) =>
      COLUMNS.map((column) => csvCell(row[column])).join(',')
    );
    return [header, ...body].join('\n');
  }

  static async exportTenantCsv(tenantId: string, limit = 1000): Promise<string> {
    const cleanTenantId = String(tenantId || '').trim();
    if (!cleanTenantId) {
      throw new Error('tenantId is required for substitution economics export.');
    }
    const boundedLimit = Math.min(5000, Math.max(1, Math.trunc(limit || 1000)));
    const orders = await FirestorePlatformService.listOrderProjections(
      cleanTenantId,
      boundedLimit
    );
    return this.toCsv(this.buildRows(orders, cleanTenantId));
  }
}
