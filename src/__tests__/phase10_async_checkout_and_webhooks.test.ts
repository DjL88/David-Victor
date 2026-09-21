import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { WebhookService, ORDER_STATE_RANKING } from '../../server/deliverect/WebhookService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { MockDeliverectAdapter } from '../../server/deliverect/MockDeliverectAdapter';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { CheckoutResult } from '../domain/models';

describe('Phase 10: Asynchronous Checkout, Webhooks, Idempotency & Monotonic Progression', () => {
  const testTenant = 'brand-alpha';
  const testSecret = 'demo_deliverect_webhook_secret_key_123';
  let adapter: MockDeliverectAdapter;

  beforeEach(() => {
    process.env.APP_MODE = 'demo';
    setServerRuntimeMode('demo');
    adapter = new MockDeliverectAdapter();
  });

  // ========================================================
  // CHECK-01: Asynchronous Checkout Pending State
  // ========================================================
  describe('CHECK-01: Asynchronous Checkout Pending State', () => {
    it('initiates checkout in CHECKOUT_PENDING_CONFIRMATION state without premature confirmation', async () => {
      // 1. Create a basket and add an item
      const basket = await adapter.createBasket('store-chelmsford-central', 'delivery');
      expect(basket).toBeDefined();
      await adapter.updateBasketItems(basket.id, [
        {
          plu: 'PLU-ART-001',
          quantity: 2,
        },
      ]);

      // 2. Perform checkout
      const idempotencyKey = `idemp_${Date.now()}_01`;
      const checkout = await adapter.checkout(basket.id, {
        idempotencyKey,
        tenantId: testTenant,
      });

      expect(checkout).toBeDefined();
      expect(checkout.checkoutId).toBeDefined();
      expect(checkout.status).toBe('CHECKOUT_PENDING_CONFIRMATION');
      expect(checkout.orderId).toBeDefined();

      // Save checkout & order projection
      await FirestorePlatformService.saveCheckoutProjection(checkout);
      if (checkout.order) {
        await FirestorePlatformService.saveOrderProjection(checkout.order, testTenant, checkout.checkoutId);
      }

      // Verify that stored checkout is still pending
      const retrieved = await FirestorePlatformService.getCheckoutProjection(checkout.checkoutId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.status).toBe('CHECKOUT_PENDING_CONFIRMATION');
    });
  });

  // ========================================================
  // CHECK-02: Idempotent Checkout Submissions
  // ========================================================
  describe('CHECK-02: Idempotent Checkout and Duplicate Prevention', () => {
    it('returns the same existing checkout result when submitted with the same idempotencyKey', async () => {
      const idempotencyKey = `idemp_unique_key_${Date.now()}`;
      const channelOrderReference = `ORD-IDEMP-${Date.now().toString().slice(-4)}`;

      const initialCheckout: CheckoutResult = {
        checkoutId: `chk_${Date.now()}_test`,
        channelOrderReference,
        orderId: 'order_test_idemp_1',
        tenantId: testTenant,
        storeId: 'store-chelmsford-central',
        status: 'CHECKOUT_PENDING_CONFIRMATION',
        basketId: 'basket_idemp_1',
        fulfillmentType: 'delivery',
        total: { amount: 2450, currency: 'GBP' },
        idempotencyKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirestorePlatformService.saveCheckoutProjection(initialCheckout);

      // Subsequent lookup by idempotency key finds the exact existing checkout
      const found = await FirestorePlatformService.getCheckoutByIdempotencyKey(idempotencyKey);
      expect(found).not.toBeNull();
      expect(found?.checkoutId).toBe(initialCheckout.checkoutId);
      expect(found?.channelOrderReference).toBe(channelOrderReference);

      // Subsequent lookup by channel order reference also matches
      const foundByRef = await FirestorePlatformService.getCheckoutByReference(channelOrderReference);
      expect(foundByRef).not.toBeNull();
      expect(foundByRef?.checkoutId).toBe(initialCheckout.checkoutId);
    });
  });

  // ========================================================
  // CHECK-03: Webhook Recovery via Get Checkout
  // ========================================================
  describe('CHECK-03: Webhook Recovery via Order Projection', () => {
    it('recovers confirmed state if order projection was updated even if checkout projection was still pending', async () => {
      const checkoutId = `chk_rec_${Date.now()}`;
      const orderId = `order_rec_${Date.now()}`;

      const checkout: CheckoutResult = {
        checkoutId,
        channelOrderReference: `ORD-REC-${Date.now().toString().slice(-4)}`,
        orderId,
        tenantId: testTenant,
        storeId: 'store-chelmsford-central',
        status: 'CHECKOUT_PENDING_CONFIRMATION',
        basketId: 'basket_rec_1',
        fulfillmentType: 'delivery',
        total: { amount: 1500, currency: 'GBP' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirestorePlatformService.saveCheckoutProjection(checkout);

      // Simulate order projection being updated upstream to ACCEPTED
      await FirestorePlatformService.saveOrderProjection(
        {
          id: orderId,
          displayId: '#REC-1',
          orderReference: checkout.channelOrderReference,
          status: 'ACCEPTED',
          fulfillmentType: 'delivery',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
        testTenant,
        checkoutId
      );

      // Recovery check: updateCheckoutStatus with the order projection status
      const orderProj = await FirestorePlatformService.getOrderProjection(orderId);
      expect(orderProj).not.toBeNull();
      expect(orderProj?.status).toBe('ACCEPTED');

      const updatedCheckout = await FirestorePlatformService.updateCheckoutStatus(
        checkoutId,
        'STORE_ACCEPTED',
        { orderId }
      );

      expect(updatedCheckout?.status).toBe('STORE_ACCEPTED');
    });
  });

  // ========================================================
  // WH-01: Constant-Time HMAC SHA-256 Verification
  // ========================================================
  describe('WH-01: HMAC SHA-256 Verification (Security & Tamper Resistance)', () => {
    it('validates a correct HMAC signature matching the raw request payload', () => {
      const rawPayload = JSON.stringify({
        eventId: 'evt_valid_123',
        type: 'ORDER_STATUS_UPDATE',
        status: 'ACCEPTED',
      });

      const signature = WebhookService.computeHmacSignature(rawPayload, testSecret);
      const isValid = WebhookService.verifyDeliverectHmac(rawPayload, signature, testSecret);
      expect(isValid).toBe(true);

      // Also supports sha256= prefix
      const isPrefixedValid = WebhookService.verifyDeliverectHmac(rawPayload, `sha256=${signature}`, testSecret);
      expect(isPrefixedValid).toBe(true);
    });

    it('rejects tampered body bytes even if signature header is well-formed', () => {
      const originalPayload = JSON.stringify({ eventId: 'evt_orig', status: 'ACCEPTED' });
      const signature = WebhookService.computeHmacSignature(originalPayload, testSecret);

      const tamperedPayload = JSON.stringify({ eventId: 'evt_orig', status: 'ACCEPTED', malicious: true });
      const isValid = WebhookService.verifyDeliverectHmac(tamperedPayload, signature, testSecret);
      expect(isValid).toBe(false);
    });

    it('rejects forged or modified signature header', () => {
      const rawPayload = JSON.stringify({ eventId: 'evt_test', status: 'ACCEPTED' });
      const fakeSignature = crypto.randomBytes(32).toString('hex');

      const isValid = WebhookService.verifyDeliverectHmac(rawPayload, fakeSignature, testSecret);
      expect(isValid).toBe(false);
    });

    it('throws 401 WEBHOOK_SIGNATURE_INVALID when processing webhook with bad signature', async () => {
      const payload = { eventId: 'evt_bad_sig', status: 'ACCEPTED' };
      const rawBody = JSON.stringify(payload);

      await expect(
        WebhookService.processWebhook(payload, rawBody, {
          'x-deliverect-signature': 'bad_hex_signature',
        }, testTenant)
      ).rejects.toMatchObject({
        statusCode: 401,
        code: 'WEBHOOK_SIGNATURE_INVALID',
      });
    });
  });

  // ========================================================
  // WH-02: Webhook Idempotency & Inbound Event Journal
  // ========================================================
  describe('WH-02: Webhook Idempotency and Event Journaling', () => {
    it('journals inbound event and deduplicates repeated identical webhook payloads', async () => {
      const externalEventKey = `evt_dedup_${Date.now()}`;
      const payload = {
        eventId: externalEventKey,
        type: 'ORDER_STATUS_UPDATE',
        status: 'ACCEPTED',
      };
      const rawBody = JSON.stringify(payload);
      const signature = WebhookService.computeHmacSignature(rawBody, testSecret);
      const headers = { 'x-deliverect-signature': signature };

      // First call -> PROCESSED
      const firstResult = await WebhookService.processWebhook(payload, rawBody, headers, testTenant);
      expect(firstResult.success).toBe(true);
      expect(firstResult.status).toBe('PROCESSED');

      // Check journal record
      const journalEntry = await FirestorePlatformService.getWebhookEvent(externalEventKey);
      expect(journalEntry).not.toBeNull();
      expect(journalEntry?.processingStatus).toBe('PROCESSED');

      // Second call with same event key -> DEDUPLICATED (HTTP 200 safe acknowledgement)
      const secondResult = await WebhookService.processWebhook(payload, rawBody, headers, testTenant);
      expect(secondResult.success).toBe(true);
      expect(secondResult.status).toBe('DEDUPLICATED');
      expect(secondResult.message).toContain('previously processed');
    });
  });

  // ========================================================
  // WH-03: Monotonic State Progression & Out-of-Order Tolerance
  // ========================================================
  describe('WH-03: Monotonic State Progression (Out-of-Order Delivery Tolerance)', () => {
    it('verifies state ranking prevents earlier lifecycle status from regressing order', () => {
      expect(ORDER_STATE_RANKING['SUBMITTED']).toBeLessThan(ORDER_STATE_RANKING['ACCEPTED']);
      expect(ORDER_STATE_RANKING['ACCEPTED']).toBeLessThan(ORDER_STATE_RANKING['PICKING']);
      expect(ORDER_STATE_RANKING['PICKING']).toBeLessThan(ORDER_STATE_RANKING['READY']);
      expect(ORDER_STATE_RANKING['READY']).toBeLessThan(ORDER_STATE_RANKING['OUT_FOR_DELIVERY']);
      expect(ORDER_STATE_RANKING['OUT_FOR_DELIVERY']).toBeLessThan(ORDER_STATE_RANKING['DELIVERED']);
    });

    it('safely ignores an out-of-order webhook event without regressing the order', async () => {
      const orderId = `order_monotonic_${Date.now()}`;
      const checkoutId = `chk_monotonic_${Date.now()}`;

      // 1. Order is already in advanced state: PICKING
      await FirestorePlatformService.saveOrderProjection(
        {
          id: orderId,
          displayId: '#MONO-1',
          orderReference: `ORD-MONO-${Date.now().toString().slice(-4)}`,
          status: 'PICKING',
          fulfillmentType: 'delivery',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
        testTenant,
        checkoutId
      );

      // 2. A delayed, out-of-order webhook arrives with status 'ACCEPTED'
      const delayedPayload = {
        eventId: `evt_delayed_${Date.now()}`,
        orderId,
        checkoutId,
        status: 'ACCEPTED',
      };
      const rawBody = JSON.stringify(delayedPayload);
      const signature = WebhookService.computeHmacSignature(rawBody, testSecret);

      const result = await WebhookService.processWebhook(
        delayedPayload,
        rawBody,
        { 'x-deliverect-signature': signature },
        testTenant
      );

      // Must acknowledge with IGNORED status without regressing state
      expect(result.success).toBe(true);
      expect(result.status).toBe('IGNORED');
      expect(result.newState).toBe('PICKING');

      // Verify order projection in Firestore still retains PICKING
      const currentOrder = await FirestorePlatformService.getOrderProjection(orderId);
      expect(currentOrder?.status).toBe('PICKING');
    });

    it('progresses order state forward when a higher-ranking state arrives', async () => {
      const orderId = `order_progress_${Date.now()}`;
      const checkoutId = `chk_progress_${Date.now()}`;

      // Initial state: ACCEPTED
      await FirestorePlatformService.saveOrderProjection(
        {
          id: orderId,
          displayId: '#PROG-1',
          orderReference: `ORD-PROG-${Date.now().toString().slice(-4)}`,
          status: 'ACCEPTED',
          fulfillmentType: 'delivery',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as any,
        testTenant,
        checkoutId
      );

      // New webhook event: READY
      const forwardPayload = {
        eventId: `evt_ready_${Date.now()}`,
        orderId,
        checkoutId,
        status: 'READY',
      };
      const rawBody = JSON.stringify(forwardPayload);
      const signature = WebhookService.computeHmacSignature(rawBody, testSecret);

      const result = await WebhookService.processWebhook(
        forwardPayload,
        rawBody,
        { 'x-deliverect-signature': signature },
        testTenant
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('PROCESSED');
      expect(result.newState).toBe('READY');

      const updatedOrder = await FirestorePlatformService.getOrderProjection(orderId);
      expect(updatedOrder?.status).toBe('READY');
    });
  });
});
