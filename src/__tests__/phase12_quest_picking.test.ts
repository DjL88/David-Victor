import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { WebhookService, ORDER_STATE_RANKING } from '../../server/deliverect/WebhookService';
import { SubstitutionCallbackService } from '../../server/deliverect/SubstitutionCallbackService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { MockDeliverectAdapter } from '../../server/deliverect/MockDeliverectAdapter';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { PaymentService } from '../../server/deliverect/PaymentService';
import { AsyncWorkerService } from '../../server/asyncWorkerService';
import { DispatchOrchestrationService } from '../../server/deliverect/DispatchOrchestrationService';

describe('Phase 12: Quest / Picking Lifecycle, Substitutions & Callbacks (QST-01 to QST-05, WH-04)', () => {
  const testTenant = 'brand-alpha';
  const testSecret = 'demo_deliverect_webhook_secret_key_123';
  let adapter: MockDeliverectAdapter;

  beforeEach(() => {
    process.env.APP_MODE = 'demo';
    setServerRuntimeMode('demo');
    adapter = new MockDeliverectAdapter();
  });

  // Helper to build Deliverect signed HMAC headers
  const buildSignatureHeaders = (rawPayload: string, secret: string = testSecret) => {
    const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
    return {
      'x-deliverect-signature': signature,
      'content-type': 'application/json',
    };
  };

  // ========================================================
  // QST-01: Picking Status Webhook Lifecycle
  // ========================================================
  describe('QST-01: Picking Status Updates', () => {
    it('handles PICKING_STARTED and moves order state and picking status to PICKING', async () => {
      const orderId = `quest_ord_${Date.now()}_01`;
      const initialOrder = {
        orderId,
        orderReference: 'REF-QST-01',
        channelLinkId: 'store-1',
        status: 'STORE_ACCEPTED',
        paymentState: 'AUTHORIZED',
        total: 2500,
        authorizedMaximum: 3000,
        finalAmount: 2500,
        itemsCount: 2,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'NOT_STARTED' as const,
          totalItems: 2,
          itemsPicked: 0,
          hasChanges: false,
          items: [
            {
              id: 'item-1',
              plu: 'PLU-MILK',
              name: 'Organic Whole Milk',
              orderedQuantity: 1,
              pickedQuantity: 0,
              originalPrice: 150,
              finalPrice: 150,
              state: 'PENDING' as const,
            },
            {
              id: 'item-2',
              plu: 'PLU-BREAD',
              name: 'Sourdough Loaf',
              orderedQuantity: 1,
              pickedQuantity: 0,
              originalPrice: 200,
              finalPrice: 200,
              state: 'PENDING' as const,
            },
          ],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      const pickingStartedPayload = JSON.stringify({
        event: 'PICKING_STARTED',
        orderId,
        channelLinkId: 'store-1',
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(pickingStartedPayload),
        pickingStartedPayload,
        buildSignatureHeaders(pickingStartedPayload),
        testTenant
      );

      expect(res.success).toBe(true);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('PICKING');
      expect(updated?.picking?.status).toBe('IN_PROGRESS');
    });

    it('handles PICKING_COMPLETE for Collection without Dispatch or payment capture settlement', async () => {
      const orderId = `quest_ord_${Date.now()}_02`;
      const settlementSpy = vi.spyOn(AsyncWorkerService, 'enqueuePaymentSettlement');
      const dispatchSpy = vi.spyOn(DispatchOrchestrationService, 'handlePickingCompleted');
      const initialOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 1500,
        authorizedMaximum: 2000,
        finalAmount: 1500,
        itemsCount: 1,
        fulfillmentType: 'collection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS' as const,
          totalItems: 1,
          itemsPicked: 1,
          hasChanges: false,
          items: [],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      const completePayload = JSON.stringify({
        event: 'PICKING_COMPLETE',
        orderId,
        channelLinkId: 'store-1',
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(completePayload),
        completePayload,
        buildSignatureHeaders(completePayload),
        testTenant
      );

      expect(res.success).toBe(true);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updated?.status).toBe('PICKED');
      expect(updated?.picking?.status).toBe('COMPLETED');
      expect(updated?.fulfillmentType).toBe('pickup');
      expect(updated?.paymentState).toBe('NO_CAPTURE_REQUIRED');
      expect(updated?.dispatch).toBeUndefined();
      expect(settlementSpy).not.toHaveBeenCalled();
      expect(dispatchSpy).not.toHaveBeenCalled();

      settlementSpy.mockRestore();
      dispatchSpy.mockRestore();
    });
  });

  // ========================================================
  // QST-02: Item Removal During Picking
  // ========================================================
  describe('QST-02: Item Removal (ITEM_REMOVED)', () => {
    it('marks item as REMOVED and adjusts final order total', async () => {
      const orderId = `quest_ord_${Date.now()}_03`;
      const initialOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 1000,
        authorizedMaximum: 1200,
        finalAmount: 1000,
        itemsCount: 2,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS' as const,
          totalItems: 2,
          itemsPicked: 0,
          hasChanges: false,
          items: [
            {
              id: 'line-1',
              plu: 'PLU-EGGS',
              name: 'Free Range Eggs 6pk',
              orderedQuantity: 1,
              pickedQuantity: 1,
              originalPrice: 250,
              finalPrice: 250,
              state: 'PICKED' as const,
            },
            {
              id: 'line-2',
              plu: 'PLU-BERRIES',
              name: 'Fresh Blueberries 150g',
              orderedQuantity: 1,
              pickedQuantity: 0,
              originalPrice: 200,
              finalPrice: 200,
              state: 'PENDING' as const,
            },
          ],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      const removePayload = JSON.stringify({
        event: 'ITEM_REMOVED',
        orderId,
        plu: 'PLU-BERRIES',
        reason: 'Out of stock in aisle 3',
        newFinalAmount: 800,
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(removePayload),
        removePayload,
        buildSignatureHeaders(removePayload),
        testTenant
      );

      expect(res.success).toBe(true);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updated?.picking?.hasChanges).toBe(true);
      expect(updated?.status).toBe('PICKING_WITH_CHANGES');
      expect(updated?.finalAmount).toBe(250); // derived from supplied picking state; upstream total is informational only

      const removedItem = updated?.picking?.items?.find((i: any) => i.plu === 'PLU-BERRIES');
      expect(removedItem?.state).toBe('REMOVED');
      expect(removedItem?.pickedQuantity).toBe(0);
      expect((removedItem?.finalPrice as any)?.amount ?? removedItem?.finalPrice).toBe(0);
    });
  });

  // ========================================================
  // QST-03: Quantity Amendments (Catch-weight / Partial Stock)
  // ========================================================
  describe('QST-03: Quantity Amendment (ITEM_QUANTITY_AMENDED)', () => {
    it('preserves unit price when Quest reduces quantity without sending a replacement price', async () => {
      const orderId = `quest_ord_${Date.now()}_04_unit_price`;
      const initialOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 900,
        authorizedMaximum: 900,
        finalAmount: 900,
        itemsCount: 1,
        fulfillmentType: 'pickup',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS' as const,
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [
            {
              id: 'line-unit-price',
              plu: 'PLU-UNIT-PRICE',
              name: 'Three Pack Item',
              orderedQuantity: 3,
              originalQuantity: 3,
              pickedQuantity: 0,
              originalPrice: { amount: 300, currency: 'GBP' },
              finalPrice: { amount: 300, currency: 'GBP' },
              state: 'PENDING' as const,
            },
          ],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      const amendPayload = JSON.stringify({
        event: 'ITEM_QUANTITY_AMENDED',
        orderId,
        plu: 'PLU-UNIT-PRICE',
        amendedQuantity: 2,
        reason: 'Only two available',
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(amendPayload),
        amendPayload,
        buildSignatureHeaders(amendPayload),
        testTenant
      );

      expect(res.success).toBe(true);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      const amended = updated?.picking?.items?.find((i: any) => i.plu === 'PLU-UNIT-PRICE');

      expect(amended?.pickedQuantity).toBe(2);
      expect((amended?.finalPrice as any)?.amount).toBe(300);
      expect(PaymentService.calculateAuthoritativeFinalAmount(updated as any)).toBe(600);
    });

    it('updates item quantity and line price', async () => {
      const orderId = `quest_ord_${Date.now()}_04`;
      const initialOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 1500,
        authorizedMaximum: 1800,
        finalAmount: 1500,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS' as const,
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [
            {
              id: 'line-banana',
              plu: 'PLU-BANANAS',
              name: 'Fairtrade Bananas 1kg',
              orderedQuantity: 3,
              pickedQuantity: 0,
              originalPrice: 300,
              finalPrice: 300,
              state: 'PENDING' as const,
            },
          ],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      const amendPayload = JSON.stringify({
        event: 'ITEM_QUANTITY_AMENDED',
        orderId,
        plu: 'PLU-BANANAS',
        orderedQuantity: 3,
        amendedQuantity: 2,
        amendedPrice: 200,
        reason: 'Only 2 bunches available on shelf',
        newFinalAmount: 1400,
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(amendPayload),
        amendPayload,
        buildSignatureHeaders(amendPayload),
        testTenant
      );

      expect(res.success).toBe(true);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updated?.picking?.hasChanges).toBe(true);
      expect(updated?.status).toBe('PICKING_WITH_CHANGES');
      expect(updated?.finalAmount).toBe(400); // 2 supplied x £2.00 unit price; do not trust upstream aggregate total

      const amended = updated?.picking?.items?.find((i: any) => i.plu === 'PLU-BANANAS');
      expect(amended?.state).toBe('QUANTITY_AMENDED');
      expect(amended?.pickedQuantity).toBe(2);
      expect((amended?.finalPrice as any)?.amount).toBe(200);
      expect((amended?.finalPrice as any)?.currency).toBe('GBP');
      expect(amended?.amendment?.reason).toContain('Only 2 bunches available');
    });
  });

  // ========================================================
  // QST-04: Substitutions & Callback Service
  // ========================================================
  describe('QST-04: Item Substitution & Substitute Callback Service', () => {
    it('processes ITEM_SUBSTITUTED webhook and enforces best-match price guarantee', async () => {
      const orderId = `quest_ord_${Date.now()}_05`;
      const initialOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 1000,
        authorizedMaximum: 1500,
        finalAmount: 1000,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS' as const,
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [
            {
              id: 'line-coke',
              plu: 'PLU-COKE-330',
              name: 'Coca-Cola Original 330ml Can',
              orderedQuantity: 1,
              pickedQuantity: 0,
              originalPrice: 120, // 120p
              finalPrice: 120,
              state: 'PENDING' as const,
              substitutionPreference: 'BEST_MATCH' as const,
            },
          ],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      // Picker substitutes with 500ml Bottle (shelf price 180p), but under Best-Match guarantee customer pays 120p
      const subPayload = JSON.stringify({
        event: 'ITEM_SUBSTITUTED',
        orderId,
        originalPlu: 'PLU-COKE-330',
        substitutePlu: 'PLU-COKE-500',
        substituteName: 'Coca-Cola 500ml Bottle',
        substitutePrice: 180,
        chargedPrice: 120, // Guaranteed lower of original or substitute
        reason: 'Out of cans; upgraded to bottle',
        newFinalAmount: 1000,
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(subPayload),
        subPayload,
        buildSignatureHeaders(subPayload),
        testTenant
      );

      expect(res.success).toBe(true);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updated?.picking?.hasChanges).toBe(true);

      const substituted = updated?.picking?.items?.find((i: any) => i.plu === 'PLU-COKE-330');
      expect(substituted?.state).toBe('SUBSTITUTED');
      expect((substituted?.finalPrice as any)?.amount ?? substituted?.finalPrice).toBe(120);
      expect(substituted?.substitution?.substituteName).toBe('Coca-Cola 500ml Bottle');
      expect((substituted?.substitution?.substitutePrice as any)?.amount ?? substituted?.substitution?.substitutePrice).toBe(180);
    });

    it('prices 1x original -> 2x replacement once at the protected ORIGINAL LINE TOTAL and is idempotent', async () => {
      const orderId = `quest_ord_${Date.now()}_line_total`;
      await FirestorePlatformService.saveOrderProjection({
        orderId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 200,
        authorizedMaximum: 200,
        itemsCount: 1,
        fulfillmentType: 'pickup',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS',
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [{
            id: 'line-water-1l',
            plu: 'WATER-1L',
            name: 'Water 1L',
            originalQuantity: 1,
            pickedQuantity: 0,
            originalPrice: { amount: 200, currency: 'GBP' },
            finalPrice: { amount: 200, currency: 'GBP' },
            state: 'PENDING',
            substitutionPreference: 'BEST_MATCH',
            substituteCandidates: [{
              plu: 'WATER-500',
              name: 'Water 500ml',
              quantity: 2,
              price: { amount: 130, currency: 'GBP' },
              priority: 1,
            }],
          }],
        },
      } as any, testTenant);

      const payload = {
        event: 'ITEM_SUBSTITUTED',
        orderId,
        originalPlu: 'WATER-1L',
        substitutePlu: 'WATER-500',
        substituteName: 'Water 500ml',
        substitutePrice: 130,
        reason: '1L unavailable',
      };
      const raw = JSON.stringify(payload);
      const first = await WebhookService.processWebhook(
        payload,
        raw,
        buildSignatureHeaders(raw),
        testTenant
      );
      expect(first.status).toBe('PROCESSED');

      let updated = await FirestorePlatformService.getOrderProjection(orderId);
      let line = updated?.picking?.items?.find((item: any) => item.plu === 'WATER-1L');
      expect(line?.pickedQuantity).toBe(2);
      expect(line?.substitution?.replacementQuantity).toBe(2);
      expect(line?.substitution?.decisionStatus).toBeUndefined();
      expect(line?.substitution?.economics?.originalEffectiveLineTotal.amount).toBe(200);
      expect(line?.substitution?.economics?.replacementRetailLineTotal.amount).toBe(260);
      expect(line?.substitution?.economics?.customerChargeLineTotal.amount).toBe(200);
      expect(line?.substitution?.economics?.retailValueDelta.amount).toBe(60);
      expect(line?.substitution?.economics?.customerPriceDelta.amount).toBe(0);
      expect(PaymentService.calculateAuthoritativeFinalAmount(updated as any)).toBe(200);

      // Exact retry is journal-deduplicated and cannot apply another line charge.
      const retry = await WebhookService.processWebhook(
        payload,
        raw,
        buildSignatureHeaders(raw),
        testTenant
      );
      expect(retry.status).toBe('DEDUPLICATED');
      updated = await FirestorePlatformService.getOrderProjection(orderId);
      expect(PaymentService.calculateAuthoritativeFinalAmount(updated as any)).toBe(200);
    });

    it('preserves original promo allocation and refuses to stack replacement promo provenance', async () => {
      const orderId = `quest_ord_${Date.now()}_promo_provenance`;
      await FirestorePlatformService.saveOrderProjection({
        orderId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 150,
        authorizedMaximum: 150,
        itemsCount: 1,
        fulfillmentType: 'pickup',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS',
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [{
            id: 'line-promo',
            plu: 'ORIGINAL-PROMO',
            name: 'Original Promo Item',
            originalQuantity: 1,
            pickedQuantity: 0,
            originalPrice: { amount: 200, currency: 'GBP' },
            finalPrice: { amount: 200, currency: 'GBP' },
            state: 'PENDING',
            bundlePricing: {
              protectedUnitPrices: [{ amount: 150, currency: 'GBP' }],
              bundleInstanceIds: ['bundle-original-1'],
            },
            substituteCandidates: [{
              plu: 'REPLACEMENT-PROMO',
              quantity: 2,
              price: { amount: 130, currency: 'GBP' },
              effectivePrice: { amount: 100, currency: 'GBP' },
              promotionProvenance: ['replacement-promo-should-not-stack'],
            }],
          }],
        },
      } as any, testTenant);

      const payload = {
        event: 'ITEM_SUBSTITUTED',
        orderId,
        originalPlu: 'ORIGINAL-PROMO',
        substitutePlu: 'REPLACEMENT-PROMO',
        substitutePrice: 130,
      };
      const raw = JSON.stringify(payload);
      await WebhookService.processWebhook(payload, raw, buildSignatureHeaders(raw), testTenant);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      const line = updated?.picking?.items?.find((item: any) => item.plu === 'ORIGINAL-PROMO');
      const economics = line?.substitution?.economics;
      expect(economics?.originalEffectiveLineTotal.amount).toBe(150);
      expect(economics?.replacementRetailLineTotal.amount).toBe(260);
      expect(economics?.replacementEffectiveLineTotal.amount).toBe(260);
      expect(economics?.customerChargeLineTotal.amount).toBe(150);
      expect(economics?.originalPromotionProvenance).toEqual(['bundle-original-1']);
      expect(economics?.replacementPromotionProvenance).toEqual([]);
      expect(PaymentService.calculateAuthoritativeFinalAmount(updated as any)).toBe(150);
    });

    it('uses a persisted replacement promotion only when the original line was not promotional', async () => {
      const orderId = `quest_ord_${Date.now()}_replacement_promo`;
      await FirestorePlatformService.saveOrderProjection({
        orderId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 300,
        authorizedMaximum: 300,
        itemsCount: 1,
        fulfillmentType: 'pickup',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS',
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [{
            id: 'line-original-standard',
            plu: 'ORIGINAL-STANDARD',
            name: 'Original Standard Item',
            originalQuantity: 1,
            pickedQuantity: 0,
            originalPrice: { amount: 300, currency: 'GBP' },
            finalPrice: { amount: 300, currency: 'GBP' },
            state: 'PENDING',
            substituteCandidates: [{
              plu: 'REPLACEMENT-PROMO-ELIGIBLE',
              quantity: 2,
              price: { amount: 130, currency: 'GBP' },
              effectivePrice: { amount: 100, currency: 'GBP' },
              promotionProvenance: ['promo:replacement-2-for-200'],
            }],
          }],
        },
      } as any, testTenant);

      const payload = {
        event: 'ITEM_SUBSTITUTED',
        orderId,
        originalPlu: 'ORIGINAL-STANDARD',
        substitutePlu: 'REPLACEMENT-PROMO-ELIGIBLE',
        substitutePrice: 130,
      };
      const raw = JSON.stringify(payload);
      await WebhookService.processWebhook(payload, raw, buildSignatureHeaders(raw), testTenant);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      const line = updated?.picking?.items?.find((item: any) => item.plu === 'ORIGINAL-STANDARD');
      const economics = line?.substitution?.economics;
      expect(economics?.replacementQuantity).toBe(2);
      expect(economics?.replacementRetailLineTotal.amount).toBe(260);
      expect(economics?.replacementEffectiveLineTotal.amount).toBe(200);
      expect(economics?.customerChargeLineTotal.amount).toBe(200);
      expect(economics?.retailValueDelta.amount).toBe(-40);
      expect(economics?.customerPriceDelta.amount).toBe(-100);
      expect(economics?.originalPromotionProvenance).toEqual([]);
      expect(economics?.replacementPromotionProvenance).toEqual(['promo:replacement-2-for-200']);
      expect(PaymentService.calculateAuthoritativeFinalAmount(updated as any)).toBe(200);
    });

    it('resolves substitution preference & candidates via SubstitutionCallbackService', async () => {
      const orderId = `quest_ord_${Date.now()}_06`;
      const testOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 500,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS' as const,
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [
            {
              id: 'line-coffee',
              plu: 'PLU-COFFEE-ESPRESSO',
              name: 'Artisan Espresso Beans 250g',
              orderedQuantity: 1,
              pickedQuantity: 0,
              originalPrice: 650,
              finalPrice: 650,
              state: 'PENDING' as const,
              substitutionPreference: 'CUSTOMER_SELECTED' as const,
              preferredSubstitutePlu: 'PLU-COFFEE-COLOMBIA',
              preferredSubstituteName: 'Single Origin Colombia 250g',
              preferredSubstitutePrice: 700,
              substituteCandidates: [
                {
                  plu: 'PLU-COFFEE-DARK',
                  name: 'Dark Roast Ground 250g',
                  price: 650,
                },
                {
                  plu: 'PLU-COFFEE-COLOMBIA',
                  name: 'Single Origin Colombia 250g',
                  price: 700,
                },
              ],
            },
          ],
        },
      };

      await FirestorePlatformService.saveOrderProjection(testOrder as any, testTenant);

      const callbackResult = await SubstitutionCallbackService.getSubstitutionForPlu(
        orderId,
        'PLU-COFFEE-ESPRESSO',
        testTenant
      );

      expect(callbackResult).not.toBeNull();
      expect(callbackResult?.orderId).toBe(orderId);
      expect(callbackResult?.plu).toBe('PLU-COFFEE-ESPRESSO');
      expect(callbackResult?.substitutionPolicy).toBe('CUSTOMER_SELECTED');
      expect(callbackResult?.candidates).toHaveLength(1);
      expect(callbackResult?.candidates[0]).toMatchObject({
        plu: 'PLU-COFFEE-COLOMBIA',
        name: 'Single Origin Colombia 250g',
        approvedPrice: { amount: 700, currency: 'GBP' },
      });
    });
  });

  // ========================================================
  // QST-05: Policy Enforcement: CANCEL_ORDER_IF_UNAVAILABLE
  // ========================================================
  describe('QST-05: Substitution Policy Enforcement', () => {
    it('cancels entire order when customer preference is CANCEL_ORDER_IF_UNAVAILABLE and item is missing', async () => {
      const orderId = `quest_ord_${Date.now()}_07`;
      const initialOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKING',
        total: 2000,
        authorizedMaximum: 2500,
        finalAmount: 2000,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS' as const,
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [
            {
              id: 'line-allergen',
              plu: 'PLU-GLUTENFREE-BREAD',
              name: 'Gluten Free Artisan Bread',
              orderedQuantity: 1,
              pickedQuantity: 0,
              originalPrice: 350,
              finalPrice: 350,
              state: 'PENDING' as const,
              substitutionPreference: 'CANCEL_ORDER_IF_UNAVAILABLE' as const,
            },
          ],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      const cancelPayload = JSON.stringify({
        event: 'ORDER_CANCELLED',
        orderId,
        reason: 'Essential item PLU-GLUTENFREE-BREAD unavailable; order cancelled per customer policy',
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(cancelPayload),
        cancelPayload,
        buildSignatureHeaders(cancelPayload),
        testTenant
      );

      expect(res.success).toBe(true);

      const updated = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updated?.status).toBe('ORDER_CANCELLED');
    });
  });

  // ========================================================
  // WH-04: GET Substitute Callback Signature Verification
  // ========================================================
  describe('WH-04: GET Substitute Callback Signature Verification', () => {
    it('validates a correct HMAC signature on GET callback request', () => {
      const path = '/api/v1/orders/ord-123/substitute/PLU-001';
      const query = { timestamp: '1720000000', tenantId: testTenant };
      const dataToSign = `${path}?tenantId=${testTenant}&timestamp=1720000000`;
      const signature = crypto.createHmac('sha256', testSecret).update(dataToSign).digest('hex');

      const headers = {
        'x-deliverect-signature': signature,
      };

      const isValid = SubstitutionCallbackService.verifyGetSignature(
        path,
        query,
        headers,
        testTenant,
        testSecret
      );

      expect(isValid).toBe(true);
    });

    it('validates an empty-body HMAC signature on GET callback request per Deliverect spec', () => {
      const path = '/api/v1/orders/ord-123/substitute/PLU-001';
      const query = { timestamp: '1720000000', tenantId: testTenant };
      const emptySignature = crypto.createHmac('sha256', testSecret).update('').digest('hex');

      const headers = {
        'x-deliverect-signature': emptySignature,
      };

      const isValid = SubstitutionCallbackService.verifyGetSignature(
        path,
        query,
        headers,
        testTenant,
        testSecret
      );

      expect(isValid).toBe(true);
    });

    it('rejects an altered or forged HMAC signature on GET callback request', () => {
      const path = '/api/v1/orders/ord-123/substitute/PLU-001';
      const query = { timestamp: '1720000000' };
      const headers = {
        'x-deliverect-signature': 'forged_fake_signature_hex_000',
      };

      const isValid = SubstitutionCallbackService.verifyGetSignature(
        path,
        query,
        headers,
        testTenant,
        testSecret
      );

      expect(isValid).toBe(false);
    });

    it('rejects unsigned GET callback requests in staging/production mode', () => {
      setServerRuntimeMode('staging');

      try {
        const path = '/api/v1/orders/ord-123/substitute/PLU-001';
        const query = { timestamp: '1720000000', tenantId: testTenant };
        const headers = {};

        const isValid = SubstitutionCallbackService.verifyGetSignature(
          path,
          query,
          headers,
          testTenant,
          testSecret
        );

        expect(isValid).toBe(false);
      } finally {
        setServerRuntimeMode('demo');
      }
    });
  });

  // ========================================================
  // Monotonic Quest Ordering Safeguards
  // ========================================================
  describe('Monotonic Quest Ordering Progression', () => {
    it('ignores stale earlier events (e.g. ORDER_ACCEPTED) after order is already PICKED', async () => {
      const orderId = `quest_ord_${Date.now()}_08`;
      const initialOrder = {
        orderId,
        channelLinkId: 'store-1',
        status: 'PICKED',
        total: 1000,
        authorizedMaximum: 1200,
        finalAmount: 1000,
        itemsCount: 1,
        fulfillmentType: 'collection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED' as const,
          totalItems: 1,
          itemsPicked: 1,
          hasChanges: false,
          items: [],
        },
      };

      await FirestorePlatformService.saveOrderProjection(initialOrder as any, testTenant);

      // Stale event arrived late from upstream
      const stalePayload = JSON.stringify({
        event: 'ORDER_ACCEPTED',
        orderId,
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(stalePayload),
        stalePayload,
        buildSignatureHeaders(stalePayload),
        testTenant
      );

      expect(res.success).toBe(true);

      // Ensure state did NOT regress from PICKED back to STORE_ACCEPTED
      const current = await FirestorePlatformService.getOrderProjection(orderId);
      expect(current?.status).toBe('PICKED');
      expect(ORDER_STATE_RANKING['PICKED']).toBeGreaterThan(ORDER_STATE_RANKING['STORE_ACCEPTED']);
    });
  });
});
