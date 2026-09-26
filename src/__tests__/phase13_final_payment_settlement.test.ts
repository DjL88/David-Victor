import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  PaymentService,
  setDPayAdapter,
  resetDPayAdapter,
} from '../../server/deliverect/PaymentService';
import { DemoPaymentAdapter } from '../../server/deliverect/DemoPaymentAdapter';
import { DeliverectDPayAdapter } from '../../server/deliverect/DeliverectDPayAdapter';
import { WebhookService } from '../../server/deliverect/WebhookService';
import { FirestorePlatformService, OrderProjection } from '../../server/firestoreService';
import { AsyncWorkerService } from '../../server/asyncWorkerService';

describe('Phase 13: Final Payment Settlement, Capture, Residual Hold & Reauthorisation (PAY-07, PAY-08, Section 20 & 58)', () => {
  const testTenant = 'brand-alpha';
  const testSecret = 'demo_deliverect_webhook_secret_key_123';
  let demoAdapter: DemoPaymentAdapter;

  beforeEach(() => {
    resetDPayAdapter();
    demoAdapter = new DemoPaymentAdapter();
    setDPayAdapter(demoAdapter);
    process.env.APP_MODE = 'demo';
  });

  const buildSignatureHeaders = (rawPayload: string, secret: string = testSecret) => {
    const signature = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
    return {
      'x-deliverect-signature': signature,
      'content-type': 'application/json',
    };
  };

  // ========================================================
  // 1. Authoritative Final Amount Calculation
  // ========================================================
  describe('Authoritative Final Amount Calculation', () => {
    it('derives exact minor units from picked items, substitutions, and removals', () => {
      const order: OrderProjection = {
        orderId: 'ord_calc_1',
        tenantId: testTenant,
        status: 'PICKING',
        itemsCount: 3,
        total: 3000, // £30.00
        authorizedMaximum: 3500, // £35.00
        fulfillmentType: 'delivery',
        paymentId: 'pay_calc_1',
        paymentState: 'AUTHORIZED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 3,
          itemsPicked: 2,
          hasChanges: true,
          items: [
            {
              id: 'item_1',
              plu: 'PLU_MILK',
              name: 'Milk',
              originalQuantity: 2,
              pickedQuantity: 2,
              originalPrice: { amount: 200, currency: 'GBP' },
              finalPrice: { amount: 200, currency: 'GBP' }, // 2 * 200 = 400
              state: 'PICKED',
            },
            {
              id: 'item_2',
              plu: 'PLU_STEAK',
              name: 'Sirloin Steak (Substituted)',
              originalQuantity: 1,
              pickedQuantity: 1,
              originalPrice: { amount: 1000, currency: 'GBP' },
              finalPrice: { amount: 1200, currency: 'GBP' }, // 1 * 1200 = 1200
              state: 'SUBSTITUTED',
              preferredSubstitutePlu: 'PLU_RIBEYE',
              preferredSubstituteName: 'Ribeye Steak',
            },
            {
              id: 'item_3',
              plu: 'PLU_APPLES',
              name: 'Organic Apples',
              originalQuantity: 1,
              pickedQuantity: 0,
              originalPrice: { amount: 300, currency: 'GBP' },
              finalPrice: { amount: 300, currency: 'GBP' },
              state: 'REMOVED', // Removed -> 0
            },
          ],
        },
      };

      const finalAmount = PaymentService.calculateAuthoritativeFinalAmount(order);
      // Substitution may never uplift above the protected original line total:
      // 400 (milk) + 1000 (protected steak line) + 0 (removed apples).
      expect(finalAmount).toBe(1400);
    });

    it('multiplies unit price by pickedQuantity and handles reduced quantities correctly', () => {
      const order: OrderProjection = {
        orderId: 'ord_calc_qty',
        tenantId: testTenant,
        status: 'PICKING',
        itemsCount: 2,
        total: 2500,
        authorizedMaximum: 3000,
        fulfillmentType: 'collection',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 2,
          itemsPicked: 2,
          hasChanges: true,
          items: [
            {
              id: 'it_multi',
              plu: 'PLU_WATER',
              name: 'Bottled Water',
              originalQuantity: 4,
              pickedQuantity: 3, // Reduced from 4 to 3
              originalPrice: { amount: 150, currency: 'GBP' },
              finalPrice: { amount: 150, currency: 'GBP' }, // 3 * 150 = 450
              state: 'PICKED',
            },
            {
              id: 'it_pack',
              plu: 'PLU_SODA',
              name: 'Soda Pack',
              originalQuantity: 2,
              pickedQuantity: 2, // 2 * 500 = 1000
              originalPrice: { amount: 500, currency: 'GBP' },
              finalPrice: { amount: 500, currency: 'GBP' },
              state: 'PICKED',
            },
          ],
        },
      };

      const finalAmount = PaymentService.calculateAuthoritativeFinalAmount(order);
      expect(finalAmount).toBe(1450); // 450 + 1000
    });

    it('returns 0 when all picking items are removed or out of stock, never falling back to order.total', () => {
      const order: OrderProjection = {
        orderId: 'ord_all_removed',
        tenantId: testTenant,
        status: 'PICKING',
        itemsCount: 2,
        total: 2000, // Original placed order was £20.00
        authorizedMaximum: 2200,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 2,
          itemsPicked: 2,
          hasChanges: true,
          items: [
            {
              id: 'it_rem_1',
              plu: 'PLU_ITEM1',
              name: 'Out of stock item 1',
              originalQuantity: 2,
              pickedQuantity: 0,
              originalPrice: { amount: 600, currency: 'GBP' },
              finalPrice: { amount: 600, currency: 'GBP' },
              state: 'REMOVED',
            },
            {
              id: 'it_rem_2',
              plu: 'PLU_ITEM2',
              name: 'Out of stock item 2',
              originalQuantity: 1,
              pickedQuantity: 0,
              originalPrice: { amount: 800, currency: 'GBP' },
              finalPrice: { amount: 800, currency: 'GBP' },
              state: 'REMOVED',
            },
          ],
        },
      };

      const finalAmount = PaymentService.calculateAuthoritativeFinalAmount(order);
      // Zero is a completely legitimate final amount when all items were unavailable
      expect(finalAmount).toBe(0);
    });

    it('falls back to order total when picking items array is absent', () => {
      const order: OrderProjection = {
        orderId: 'ord_calc_fallback',
        tenantId: testTenant,
        status: 'ACCEPTED',
        itemsCount: 1,
        total: 1550,
        authorizedMaximum: 2000,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const finalAmount = PaymentService.calculateAuthoritativeFinalAmount(order);
      expect(finalAmount).toBe(1550);
    });
  });

  // ========================================================
  // 2. PAY-07: Capture Lower than Auth and Residual Hold Release
  // ========================================================
  describe('PAY-07: Final Amount <= Authorized Ceiling (Capture & Residual Hold Release)', () => {
    it('captures the exact final amount and releases the remaining held authorization', async () => {
      const orderId = `ord_pay07_${Date.now()}`;
      const paymentId = `pay_dpay_${Date.now()}`;

      // 1. Setup payment record in DEMO adapter: £25.00 authorized
      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid_test_123',
        amount: 2500,
        authorizedAmount: 2500,
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'AUTHORIZED',
        status: 'authorized',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Setup order in Firestore: authorized ceiling 2500, but final picked amount is 1800
      await FirestorePlatformService.saveOrderProjection({
        orderId,
        orderReference: 'REF-PAY-07',
        channelLinkId: 'store-1',
        status: 'PICKING',
        paymentState: 'AUTHORIZED',
        paymentId,
        total: 2200,
        authorizedMaximum: 2500,
        itemsCount: 2,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 2,
          itemsPicked: 2,
          hasChanges: true,
          items: [
            {
              id: 'it1',
              plu: 'PLU1',
              name: 'Item 1',
              originalQuantity: 1,
              pickedQuantity: 1,
              originalPrice: { amount: 1000, currency: 'GBP' },
              finalPrice: { amount: 1000, currency: 'GBP' },
              state: 'PICKED',
            },
            {
              id: 'it2',
              plu: 'PLU2',
              name: 'Item 2 (Lower price replacement)',
              originalQuantity: 1,
              pickedQuantity: 1,
              originalPrice: { amount: 1200, currency: 'GBP' },
              finalPrice: { amount: 800, currency: 'GBP' },
              state: 'QUANTITY_AMENDED',
              amendment: {
                originalQuantity: 1,
                suppliedQuantity: 1,
                reason: 'Verified catch-weight / quantity price amendment',
              },
            },
          ],
        },
      } as any);

      // 3. Execute final settlement
      const settlement = await PaymentService.settleOrderPayment(orderId, testTenant);

      expect(settlement.status).toBe('SETTLED');
      expect(settlement.finalAmount).toBe(1800);
      expect(settlement.capturedAmount).toBe(1800);
      expect(settlement.residualHoldReleased).toBe(700); // 2500 - 1800 = 700 released!

      // 4. Verify payment state in DPay adapter
      const updatedPayment = await demoAdapter.getPayment(paymentId);
      expect(updatedPayment.status).toBe('captured');
      expect(updatedPayment.capturedAmount).toBe(1800);
      expect(updatedPayment.residualHoldAmount).toBe(700);

      // 5. Verify order projection updated in Firestore
      const updatedOrder = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updatedOrder?.paymentState).toBe('CAPTURED');
      expect(updatedOrder?.capturedAmount).toBe(1800);
      expect(updatedOrder?.residualHoldReleased).toBe(700);
    });

    it('PAY-07-ZERO: captures 0 and releases full authorization hold when all items are removed during picking', async () => {
      const orderId = `ord_pay07_zero_${Date.now()}`;
      const paymentId = `pay_dpay_zero_${Date.now()}`;

      // 1. Setup payment record: £20.00 authorized
      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid_test_zero',
        amount: 2000,
        authorizedAmount: 2000,
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'AUTHORIZED',
        status: 'authorized',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Setup order in Firestore: original order £20.00, but all items removed during picking
      await FirestorePlatformService.saveOrderProjection({
        id: orderId,
        orderReference: 'REF-PAY-07-ZERO',
        channelLinkId: 'store-1',
        status: 'PICKING',
        paymentState: 'AUTHORIZED',
        paymentId,
        total: 2000,
        authorizedMaximum: 2000,
        itemsCount: 2,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 2,
          itemsPicked: 2,
          hasChanges: true,
          items: [
            {
              id: 'it1',
              plu: 'PLU1',
              name: 'Out of stock milk',
              originalQuantity: 2,
              pickedQuantity: 0,
              originalPrice: { amount: 500, currency: 'GBP' },
              finalPrice: { amount: 500, currency: 'GBP' },
              state: 'REMOVED',
            },
            {
              id: 'it2',
              plu: 'PLU2',
              name: 'Out of stock bread',
              originalQuantity: 2,
              pickedQuantity: 0,
              originalPrice: { amount: 500, currency: 'GBP' },
              finalPrice: { amount: 500, currency: 'GBP' },
              state: 'REMOVED',
            },
          ],
        },
      } as any);

      // 3. Execute authoritative settlement
      const settlement = await PaymentService.settleOrderPayment(orderId, testTenant);

      // 4. Verify settlement result
      expect(settlement.status).toBe('SETTLED');
      expect(settlement.finalAmount).toBe(0);
      expect(settlement.capturedAmount).toBe(0);
      expect(settlement.residualHoldReleased).toBe(2000); // 100% of held authorization released

      // 5. Verify payment record in DPay
      const dpayRecord = (demoAdapter as any).payments.get(paymentId);
      expect(dpayRecord.capturedAmount).toBe(0);
      expect(dpayRecord.residualHoldAmount).toBe(2000);
      expect(dpayRecord.state).toBe('CAPTURED'); // Captured at 0, residual hold released

      // 6. Verify order projection in Firestore
      const updatedOrder = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updatedOrder?.capturedAmount).toBe(0);
      expect(updatedOrder?.residualHoldReleased).toBe(2000);
    });

    it('returns PAYMENT_ACTION_REQUIRED and 0 captured amount when an online order has no payment ID', async () => {
      const orderId = `ord_nopay_${Date.now()}`;

      await FirestorePlatformService.saveOrderProjection({
        id: orderId,
        orderReference: 'REF-NO-PAY',
        channelLinkId: 'store-1',
        status: 'PICKING',
        paymentState: 'AUTHORIZED',
        paymentId: undefined, // Missing payment ID!
        total: 1500,
        authorizedMaximum: 1500,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 1,
          itemsPicked: 1,
          hasChanges: false,
          items: [
            {
              id: 'it1',
              plu: 'PLU_COOKIE',
              name: 'Cookie',
              originalQuantity: 1,
              pickedQuantity: 1,
              originalPrice: { amount: 1500, currency: 'GBP' },
              finalPrice: { amount: 1500, currency: 'GBP' },
              state: 'PICKED',
            },
          ],
        },
      } as any);

      const settlement = await PaymentService.settleOrderPayment(orderId, testTenant);

      expect(settlement.status).toBe('PAYMENT_ACTION_REQUIRED');
      expect(settlement.capturedAmount).toBe(0);
      expect(settlement.paymentId).toBe('unattached');
    });
  });

  // ========================================================
  // 3. PAY-08: Final Amount Exceeds Authorized Ceiling
  // ========================================================
  describe('PAY-08: Final Amount > Authorized Ceiling', () => {
    it('flags PAYMENT_ACTION_REQUIRED and refuses capture when additional authorization is not permitted', async () => {
      const orderId = `ord_pay08_unauth_${Date.now()}`;
      const paymentId = `pay_dpay_${Date.now()}`;

      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid',
        amount: 2000,
        authorizedAmount: 2000, // £20.00 ceiling
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'AUTHORIZED',
        status: 'authorized',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      });

      // Order final total is 2400 (exceeds 2000 ceiling by 400 minor units)
      await FirestorePlatformService.saveOrderProjection({
        orderId,
        orderReference: 'REF-PAY-08',
        channelLinkId: 'store-1',
        status: 'PICKING',
        paymentState: 'AUTHORIZED',
        paymentId,
        total: 2000,
        authorizedMaximum: 2000,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 1,
          itemsPicked: 1,
          hasChanges: true,
          items: [
            {
              id: 'it1',
              plu: 'PLU_EXPENSIVE',
              name: 'Expensive Item',
              originalQuantity: 1,
              pickedQuantity: 1,
              originalPrice: { amount: 2000, currency: 'GBP' },
              finalPrice: { amount: 2400, currency: 'GBP' },
              state: 'QUANTITY_AMENDED',
              amendment: {
                originalQuantity: 1,
                suppliedQuantity: 1,
                reason: 'Verified catch-weight / quantity price amendment',
              },
            },
          ],
        },
      } as any);

      // Settle without reauthorisation permission
      const settlement = await PaymentService.settleOrderPayment(orderId, testTenant, {
        reauthorizeIfNeeded: false,
      });

      expect(settlement.status).toBe('PAYMENT_ACTION_REQUIRED');
      expect(settlement.finalAmount).toBe(2400);
      expect(settlement.authorizedAmount).toBe(2000);
      expect(settlement.capturedAmount).toBe(0);
      expect(settlement.errorMessage).toContain('exceeds customer-approved authorization ceiling');

      // Verify payment was NOT captured beyond authorization
      const payment = await demoAdapter.getPayment(paymentId);
      expect(payment.status).toBe('authorized');
      expect(payment.capturedAmount).toBe(0);
    });

    it('performs verified reauthorization and captures full amount when reauthorization is explicitly permitted', async () => {
      const orderId = `ord_pay08_reauth_${Date.now()}`;
      const paymentId = `pay_dpay_${Date.now()}`;

      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid',
        amount: 2000,
        authorizedAmount: 2000,
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'AUTHORIZED',
        status: 'authorized',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      });

      await FirestorePlatformService.saveOrderProjection({
        orderId,
        orderReference: 'REF-PAY-08-REAUTH',
        channelLinkId: 'store-1',
        status: 'PICKING',
        paymentState: 'AUTHORIZED',
        paymentId,
        total: 2000,
        authorizedMaximum: 2400,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'COMPLETED',
          totalItems: 1,
          itemsPicked: 1,
          hasChanges: true,
          items: [
            {
              id: 'it1',
              plu: 'PLU_EXPENSIVE',
              name: 'Expensive Item',
              originalQuantity: 1,
              pickedQuantity: 1,
              originalPrice: { amount: 2000, currency: 'GBP' },
              finalPrice: { amount: 2350, currency: 'GBP' },
              state: 'QUANTITY_AMENDED',
              amendment: {
                originalQuantity: 1,
                suppliedQuantity: 1,
                reason: 'Verified catch-weight / quantity price amendment',
              },
            },
          ],
        },
      } as any);

      await FirestorePlatformService.savePaymentProjection({
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        status: 'authorized',
        amount: { amount: 2000, currency: 'GBP' },
        authorizedAmount: { amount: 2000, currency: 'GBP' },
        customerApprovedMaxAmount: { amount: 2400, currency: 'GBP' },
        capturedAmount: { amount: 0, currency: 'GBP' },
        captureMode: 'manual',
        currency: 'GBP',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Settle with reauthorizeIfNeeded = true
      const settlement = await PaymentService.settleOrderPayment(orderId, testTenant, {
        reauthorizeIfNeeded: true,
      });

      expect(settlement.status).toBe('SETTLED');
      expect(settlement.finalAmount).toBe(2350);
      expect(settlement.authorizedAmount).toBe(2350); // Uplifted
      expect(settlement.capturedAmount).toBe(2350);
      expect(settlement.residualHoldReleased).toBe(0);

      const payment = await demoAdapter.getPayment(paymentId);
      expect(payment.status).toBe('captured');
      expect(payment.authorizedAmount).toBe(2350);
      expect(payment.capturedAmount).toBe(2350);
    });
  });

  // ========================================================
  // 4. Order Cancellation & Reversal Workflows (Refund / Void)
  // ========================================================
  describe('Order Cancellation & Payment Reversal Workflow', () => {
    it('voids authorization and releases hold if cancelled while in AUTHORIZED state', async () => {
      const orderId = `ord_cancel_auth_${Date.now()}`;
      const paymentId = `pay_cancel_auth_${Date.now()}`;

      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid',
        amount: 3000,
        authorizedAmount: 3000,
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'AUTHORIZED',
        status: 'authorized',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      });

      await FirestorePlatformService.saveOrderProjection({
        orderId,
        orderReference: 'REF-CANCEL-AUTH',
        channelLinkId: 'store-1',
        status: 'STORE_ACCEPTED',
        paymentState: 'AUTHORIZED',
        paymentId,
        total: 3000,
        authorizedMaximum: 3000,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      const result = await PaymentService.handleOrderCancellation(orderId, testTenant, 'Customer requested cancellation');

      expect(result.status).toBe('VOIDED');
      expect(result.residualHoldReleased).toBe(3000);

      const order = await FirestorePlatformService.getOrderProjection(orderId);
      expect(order?.paymentState).toBe('VOIDED');
    });

    it('issues full refund if cancelled after payment was already CAPTURED', async () => {
      const orderId = `ord_cancel_cap_${Date.now()}`;
      const paymentId = `pay_cancel_cap_${Date.now()}`;

      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid',
        amount: 2500,
        authorizedAmount: 2500,
        capturedAmount: 2500,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'CAPTURED',
        status: 'captured',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      });

      await FirestorePlatformService.saveOrderProjection({
        orderId,
        orderReference: 'REF-CANCEL-CAP',
        channelLinkId: 'store-1',
        status: 'READY',
        paymentState: 'CAPTURED',
        paymentId,
        total: 2500,
        finalAmount: 2500,
        capturedAmount: 2500,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      const result = await PaymentService.handleOrderCancellation(orderId, testTenant, 'Store out of stock on all items');

      expect(result.status).toBe('REFUNDED');
      expect(result.capturedAmount).toBe(2500);

      const payment = await demoAdapter.getPayment(paymentId);
      expect(payment.status).toBe('refunded');

      const order = await FirestorePlatformService.getOrderProjection(orderId);
      expect(order?.paymentState).toBe('REFUNDED');
    });
  });

  // ========================================================
  // 5. Inbound Webhook Lifecycle Triggers Settlement
  // ========================================================
  describe('Inbound Webhook Lifecycle -> Settlement Integration', () => {
    it('automatically settles payment when receiving PICKING_COMPLETE webhook', async () => {
      const orderId = `ord_wh_settle_${Date.now()}`;
      const paymentId = `pay_wh_${Date.now()}`;

      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid',
        amount: 2000,
        authorizedAmount: 2000,
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'AUTHORIZED',
        status: 'authorized',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      });

      await FirestorePlatformService.saveOrderProjection({
        orderId,
        tenantId: testTenant,
        orderReference: 'REF-WH-SETTLE',
        channelLinkId: 'store-1',
        status: 'PICKING',
        paymentState: 'AUTHORIZED',
        paymentId,
        total: 2000,
        authorizedMaximum: 2000,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        picking: {
          status: 'IN_PROGRESS',
          totalItems: 1,
          itemsPicked: 1,
          hasChanges: false,
          items: [
            {
              id: 'item_1',
              plu: 'PLU_BREAD',
              name: 'Bread',
              originalQuantity: 1,
              pickedQuantity: 1,
              originalPrice: { amount: 1500, currency: 'GBP' },
              finalPrice: { amount: 1500, currency: 'GBP' },
              state: 'PICKED',
            },
          ],
        },
      } as any);

      // Inbound Quest Webhook: PICKING_COMPLETE
      const webhookPayload = JSON.stringify({
        event: 'order.status.updated',
        orderId,
        status: 'PICKING_COMPLETE',
        channelLinkId: 'store-1',
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(webhookPayload),
        webhookPayload,
        buildSignatureHeaders(webhookPayload),
        testTenant
      );

      expect(res.success).toBe(true);
      expect(res.newState).toBe('PICKED');

      // Await background async worker to execute payment settlement
      await AsyncWorkerService.waitForIdle();

      // Verify payment was settled and residual hold released
      const order = await FirestorePlatformService.getOrderProjection(orderId);
      expect(order?.paymentState).toBe('CAPTURED');
      expect(order?.capturedAmount).toBe(1500);
      expect(order?.residualHoldReleased).toBe(500); // 2000 - 1500

      const payment = await demoAdapter.getPayment(paymentId);
      expect(payment.status).toBe('captured');
      expect(payment.capturedAmount).toBe(1500);
    });

    it('automatically triggers cancellation reversal when receiving ORDER_CANCELLED webhook', async () => {
      const orderId = `ord_wh_cancel_${Date.now()}`;
      const paymentId = `pay_wh_cancel_${Date.now()}`;

      (demoAdapter as any).payments.set(paymentId, {
        paymentId,
        tenantId: testTenant,
        channelLinkId: 'store-1',
        paymentMethodToken: 'bt_tok_valid',
        amount: 1800,
        authorizedAmount: 1800,
        capturedAmount: 0,
        residualHoldAmount: 0,
        currency: 'GBP',
        state: 'AUTHORIZED',
        status: 'authorized',
        captureMode: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: [],
      });

      await FirestorePlatformService.saveOrderProjection({
        orderId,
        tenantId: testTenant,
        orderReference: 'REF-WH-CANCEL',
        channelLinkId: 'store-1',
        status: 'ACCEPTED',
        paymentState: 'AUTHORIZED',
        paymentId,
        total: 1800,
        authorizedMaximum: 1800,
        itemsCount: 1,
        fulfillmentType: 'delivery',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);

      const webhookPayload = JSON.stringify({
        event: 'order.status.updated',
        orderId,
        status: 'ORDER_CANCELLED',
        channelLinkId: 'store-1',
        failureReason: 'Store kitchen issue',
        timestamp: new Date().toISOString(),
      });

      const res = await WebhookService.processWebhook(
        JSON.parse(webhookPayload),
        webhookPayload,
        buildSignatureHeaders(webhookPayload),
        testTenant
      );

      expect(res.success).toBe(true);
      expect(res.newState).toBe('ORDER_CANCELLED');

      // Await background async worker to execute cancellation reversal
      await AsyncWorkerService.waitForIdle();

      const order = await FirestorePlatformService.getOrderProjection(orderId);
      expect(order?.paymentState).toBe('VOIDED');
    });
  });

  // ========================================================
  // 6. Staging / Production Deliverect DPay Adapter Safety Guard
  // ========================================================
  describe('Deliverect DPay Adapter Staging Verification Guard', () => {
    it('guards final capture and ambiguous re-authorisation while verified Pay endpoints remain enabled', async () => {
      const stagingAdapter = new DeliverectDPayAdapter();

      await expect(
        stagingAdapter.capture('pay_123', 1500)
      ).rejects.toThrow(/manual capture/i);

      await expect(
        stagingAdapter.reauthorize('pay_123', 200)
      ).rejects.toThrow(/amount semantics/i);
    });
  });
});
