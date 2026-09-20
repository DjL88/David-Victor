import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { AnalyticsService } from '../../server/analyticsService';
import { NotificationService } from '../../server/notificationService';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { v1Router } from '../../server/api/v1Router';
import express from 'express';
import http from 'http';

describe('Phase 14: Analytics & Notifications Engine', () => {
  const tenantId = 'tenant_phase14_test';

  beforeAll(() => {
    setServerRuntimeMode('demo');
  });

  beforeEach(() => {
    // Reset in-memory Firestore stores
    (FirestorePlatformService as any).inMemoryAnalyticsEvents = [];
    (FirestorePlatformService as any).inMemorySubscriptions = [];
    (FirestorePlatformService as any).inMemoryNotifications = [];
    (FirestorePlatformService as any).inMemoryOrders = new Map();
  });

  describe('1. Analytics PII & Security Sanitization (Section 38 & 39)', () => {
    it('scrubs sensitive PII, cardholder tokens, and coordinates from analytics events', () => {
      const rawEvent = {
        type: 'CHECKOUT_STARTED' as const,
        sessionId: 'ses_12345',
        coarseRegion: 'SW1A 1AA', // Full UK postcode
        properties: {
          email: 'customer@example.com',
          phone: '+447700900077',
          streetAddress: '10 Downing Street',
          creditCardPan: '4111222233334444',
          cvc: '123',
          card_token: 'tok_live_secret_999',
          latitude: 51.5034,
          longitude: -0.1276,
          totalAmount: 4500, // Safe financial minor units
          itemCount: 3, // Safe operational metric
          fulfillmentType: 'DELIVERY', // Safe category
        },
      };

      const sanitized = AnalyticsService.sanitizeEvent(tenantId, rawEvent);

      // Verify full postcode is coarsened to outcode
      expect(sanitized.coarseRegion).toBe('SW1A');

      // Verify sensitive PII is stripped
      expect(sanitized.properties?.email).toBeUndefined();
      expect(sanitized.properties?.phone).toBeUndefined();
      expect(sanitized.properties?.streetAddress).toBeUndefined();
      expect(sanitized.properties?.creditCardPan).toBeUndefined();
      expect(sanitized.properties?.cvc).toBeUndefined();
      expect(sanitized.properties?.card_token).toBeUndefined();
      expect(sanitized.properties?.latitude).toBeUndefined();
      expect(sanitized.properties?.longitude).toBeUndefined();

      // Verify safe operational properties are preserved
      expect(sanitized.properties?.totalAmount).toBe(4500);
      expect(sanitized.properties?.itemCount).toBe(3);
      expect(sanitized.properties?.fulfillmentType).toBe('DELIVERY');
    });

    it('scrubs raw email and phone strings even if assigned to non-standard property keys', () => {
      const rawEvent = {
        type: 'LOCATION_RESOLVED' as const,
        properties: {
          user_identifier_string: 'secret.user@gmail.com',
          emergency_contact: '+44 7911 123456',
          regionLabel: 'London Westminster',
        },
      };

      const sanitized = AnalyticsService.sanitizeEvent(tenantId, rawEvent);

      expect(sanitized.properties?.user_identifier_string).toBeUndefined();
      expect(sanitized.properties?.emergency_contact).toBeUndefined();
      expect(sanitized.properties?.regionLabel).toBe('London Westminster');
    });
  });

  describe('2. Genuine Analytics Insights Calculation (Section 38)', () => {
    it('returns genuine empty state (totalSessions: 0, totalOrders: 0) without fabricating metrics', async () => {
      const insights = await AnalyticsService.getInsights(tenantId, '30d');

      expect(insights.totalSessions).toBe(0);
      expect(insights.totalOrders).toBe(0);
      expect(insights.totalGrossMerchandiseValue).toBe(0);
      expect(insights.overallConversionRate).toBe(0);
      expect(insights.funnel).toEqual([]);
      expect(insights.products).toEqual([]);
      expect(insights.searches).toEqual([]);
      expect(insights.regions).toEqual([]);
    });

    it('accurately aggregates funnel progression, product metrics, and searches from real events', async () => {
      // Seed 2 sessions
      // Session 1: Lands -> Views Product A -> Adds to Basket -> Starts Checkout -> Submits Order (£35.00)
      await AnalyticsService.trackEvent(tenantId, {
        type: 'SESSION_STARTED',
        sessionId: 'ses_1',
        coarseRegion: 'CM1',
      });
      await AnalyticsService.trackEvent(tenantId, {
        type: 'PRODUCT_VIEW',
        sessionId: 'ses_1',
        productPlu: 'PLU_MILK',
        coarseRegion: 'CM1',
      });
      await AnalyticsService.trackEvent(tenantId, {
        type: 'ADD_TO_BASKET',
        sessionId: 'ses_1',
        productPlu: 'PLU_MILK',
        coarseRegion: 'CM1',
      });
      await AnalyticsService.trackEvent(tenantId, {
        type: 'CHECKOUT_STARTED',
        sessionId: 'ses_1',
        coarseRegion: 'CM1',
      });
      await AnalyticsService.trackEvent(tenantId, {
        type: 'ORDER_SUBMITTED',
        sessionId: 'ses_1',
        coarseRegion: 'CM1',
        properties: { totalAmount: 3500 },
      });

      // Session 2: Lands -> Searches "bread" -> Views Product B -> Drops off
      await AnalyticsService.trackEvent(tenantId, {
        type: 'SESSION_STARTED',
        sessionId: 'ses_2',
        coarseRegion: 'E1',
      });
      await AnalyticsService.trackEvent(tenantId, {
        type: 'SEARCH',
        sessionId: 'ses_2',
        searchTerm: 'bread',
        coarseRegion: 'E1',
      });
      await AnalyticsService.trackEvent(tenantId, {
        type: 'PRODUCT_VIEW',
        sessionId: 'ses_2',
        productPlu: 'PLU_BREAD',
        coarseRegion: 'E1',
      });

      const insights = await AnalyticsService.getInsights(tenantId, '30d');

      // Total sessions & orders
      expect(insights.totalSessions).toBe(2);
      expect(insights.totalOrders).toBe(1);
      expect(insights.totalGrossMerchandiseValue).toBe(3500);
      expect(insights.averageOrderValue).toBe(3500);

      // Funnel analysis
      expect(insights.funnel.length).toBe(7);
      const landingStage = insights.funnel.find((s) => s.stage === 'brand_store_landing');
      const productStage = insights.funnel.find((s) => s.stage === 'product_view');
      const basketStage = insights.funnel.find((s) => s.stage === 'add_to_basket');
      const submittedStage = insights.funnel.find((s) => s.stage === 'order_submitted');

      expect(landingStage?.visitors).toBe(2);
      expect(productStage?.visitors).toBe(2);
      expect(basketStage?.visitors).toBe(1);
      expect(submittedStage?.visitors).toBe(1);

      // Product performance
      expect(insights.products.length).toBe(2);
      const milkProd = insights.products.find((p) => p.plu === 'PLU_MILK');
      expect(milkProd?.productViews).toBe(1);
      expect(milkProd?.addToBasketCount).toBe(1);

      // Searches
      expect(insights.searches.length).toBe(1);
      expect(insights.searches[0].query).toBe('bread');
      expect(insights.searches[0].frequency).toBe(1);

      // Regional metrics
      expect(insights.regions.length).toBe(2);
      const cm1Region = insights.regions.find((r) => r.postcodeDistrict === 'CM1');
      expect(cm1Region?.ordersCount).toBe(1);
      expect(cm1Region?.revenue).toBe(3500);
    });
  });

  describe('3. Transactional Notifications Engine (Section 58)', () => {
    it('registers Web Push subscription and retrieves customer notifications', async () => {
      const subscription = await NotificationService.subscribe(tenantId, {
        customerUid: 'cust_alice_123',
        endpoint: 'https://fcm.googleapis.com/fcm/send/fake_token_456',
        keys: { p256dh: 'p256_key', auth: 'auth_secret' },
        channel: 'WEB_PUSH',
      });

      expect(subscription.subscriptionId).toBeDefined();
      expect(subscription.customerUid).toBe('cust_alice_123');
      expect(subscription.endpoint).toContain('fake_token_456');

      // Trigger a transactional notification
      const notif = await NotificationService.sendNotification(tenantId, {
        type: 'ORDER_CONFIRMED',
        title: 'Order Confirmed',
        body: 'Your grocery order #1001 is on its way.',
        recipientUid: 'cust_alice_123',
        orderId: 'ord_1001',
      });

      expect(notif.notificationId).toBeDefined();
      expect(notif.read).toBe(false);

      // Fetch inbox
      const inbox = await NotificationService.getCustomerNotifications(tenantId, 'cust_alice_123');
      expect(inbox.length).toBe(1);
      expect(inbox[0].orderId).toBe('ord_1001');

      // Mark as read
      const markSuccess = await NotificationService.markAsRead(notif.notificationId);
      expect(markSuccess).toBe(true);

      const updatedInbox = await NotificationService.getCustomerNotifications(tenantId, 'cust_alice_123');
      expect(updatedInbox[0].read).toBe(true);
    });

    it('generates accurate transactional notifications across full order lifecycle', async () => {
      const mockOrder: any = {
        orderId: 'ord_cycle_999',
        orderReference: 'REF999',
        tenantId,
        channelLinkId: 'store_alpha',
        customerUid: 'cust_bob',
        fulfillmentType: 'delivery',
        total: 2850,
        itemsCount: 4,
        estimatedDeliveryTime: '18:30',
      };

      // 1. Confirmed
      const n1 = await NotificationService.notifyOrderConfirmed(mockOrder);
      expect(n1.type).toBe('ORDER_CONFIRMED');
      expect(n1.body).toContain('REF999');

      // 2. Picking started
      const n2 = await NotificationService.notifyPickingStarted(mockOrder);
      expect(n2.type).toBe('PICKING_STARTED');

      // 3. Items amended
      const n3 = await NotificationService.notifyItemsAmended(mockOrder, { substitutedCount: 1, removedCount: 1 });
      expect(n3.type).toBe('ITEMS_AMENDED');
      expect(n3.body).toContain('1 item(s) substituted and 1 item(s) out of stock and removed');

      // 4. Picking complete
      const n4 = await NotificationService.notifyPickingComplete(mockOrder);
      expect(n4.type).toBe('PICKING_COMPLETE');

      // 5. Out for delivery
      const n5 = await NotificationService.notifyOutForDelivery(mockOrder);
      expect(n5.type).toBe('OUT_FOR_DELIVERY');

      // 6. Delivered
      const n6 = await NotificationService.notifyOrderCompleted(mockOrder);
      expect(n6.type).toBe('ORDER_DELIVERED');

      // 7. Cancelled
      const n7 = await NotificationService.notifyOrderCancelled(mockOrder, 'Out of stock at store');
      expect(n7.type).toBe('ORDER_CANCELLED');
      expect(n7.body).toContain('Out of stock at store');

      const allCustomerNotifs = await NotificationService.getCustomerNotifications(tenantId, 'cust_bob');
      expect(allCustomerNotifs.length).toBe(7);
    });
  });

  describe('4. BFF Public API Contract Integration (/api/v1/analytics & /api/v1/notifications)', () => {
    let server: http.Server;
    let baseUrl: string;

    beforeAll(async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/v1', v1Router);

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
          const addr = server.address() as any;
          baseUrl = `http://localhost:${addr.port}/api/v1`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('POST /api/v1/analytics/events records sanitized event and prevents PII leakage', async () => {
      const res = await fetch(`${baseUrl}/analytics/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          type: 'PRODUCT_VIEW',
          sessionId: 'ses_api_test',
          productPlu: 'PLU_COLA',
          properties: {
            email: 'hacker@test.com',
            price: 199,
          },
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.event.properties.email).toBeUndefined();
      expect(data.event.properties.price).toBe(199);
    });

    it('GET /api/v1/analytics/insights returns genuine dashboard metrics', async () => {
      const res = await fetch(`${baseUrl}/analytics/insights?timeframe=30d`, {
        headers: {
          'x-tenant-id': tenantId,
          'Authorization': 'Bearer dev_token_tenantadmin',
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.timeframe).toBe('30d');
      expect(data.totalSessions).toBeDefined();
      expect(data.funnel).toBeDefined();
    });

    it('POST /api/v1/notifications/subscribe registers subscription and returns 201', async () => {
      const res = await fetch(`${baseUrl}/notifications/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          endpoint: 'https://push.example.com/sub/12345',
          customerUid: 'cust_endpoint_test',
          channel: 'WEB_PUSH',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.subscription.endpoint).toBe('https://push.example.com/sub/12345');
    });

    it('GET /api/v1/notifications and PATCH /api/v1/notifications/:id/read manages inbox', async () => {
      // Add a notification
      const notif = await NotificationService.sendNotification(tenantId, {
        type: 'ORDER_CONFIRMED',
        title: 'Ready',
        body: 'Your test order is confirmed.',
        recipientUid: 'cust_read_test',
      });

      const getRes = await fetch(`${baseUrl}/notifications?customerUid=cust_read_test`, {
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      expect(getRes.status).toBe(200);
      const getData = await getRes.json();
      expect(getData.notifications.length).toBe(1);
      expect(getData.notifications[0].read).toBe(false);

      const patchRes = await fetch(`${baseUrl}/notifications/${notif.notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'x-tenant-id': tenantId,
        },
      });

      expect(patchRes.status).toBe(200);
      const patchData = await patchRes.json();
      expect(patchData.updated).toBe(true);
    });
  });
});
