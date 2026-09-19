import { DomainNotification, NotificationSubscription, NotificationType } from '../src/domain/models';
import { FirestorePlatformService, OrderProjection } from './firestoreService';

export class NotificationService {
  /**
   * Registers a customer's browser / PWA Web Push notification subscription.
   */
  static async subscribe(
    tenantId: string,
    params: {
      customerUid?: string;
      sessionId?: string;
      endpoint: string;
      keys?: { p256dh: string; auth: string };
      channel?: 'WEB_PUSH' | 'IN_APP';
    }
  ): Promise<NotificationSubscription> {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    const subscription: NotificationSubscription = {
      subscriptionId,
      tenantId,
      customerUid: params.customerUid,
      sessionId: params.sessionId,
      endpoint: params.endpoint,
      keys: params.keys,
      channel: params.channel || 'WEB_PUSH',
      createdAt: now,
      updatedAt: now,
    };

    await FirestorePlatformService.saveNotificationSubscription(subscription);
    return subscription;
  }

  /**
   * Emits a transactional in-app / push notification to a customer.
   */
  static async sendNotification(
    tenantId: string,
    payload: {
      type: NotificationType;
      title: string;
      body: string;
      orderId?: string;
      recipientUid?: string;
      recipientSessionId?: string;
      metadata?: Record<string, string | number | boolean>;
    }
  ): Promise<DomainNotification> {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const notification: DomainNotification = {
      notificationId,
      tenantId,
      orderId: payload.orderId,
      recipientUid: payload.recipientUid,
      recipientSessionId: payload.recipientSessionId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata,
      read: false,
      createdAt: new Date().toISOString(),
    };

    await FirestorePlatformService.createNotification(notification);

    // If customer has Web Push subscriptions, simulate or execute push dispatch
    const subscriptions = await FirestorePlatformService.getNotificationSubscriptions(
      tenantId,
      payload.recipientUid,
      payload.recipientSessionId
    );

    if (subscriptions.length > 0) {
      console.log(`[NotificationService] Dispatched ${payload.type} notification to ${subscriptions.length} active subscription(s).`);
    }

    return notification;
  }

  /**
   * Retrieves notification history for customer inbox.
   */
  static async getCustomerNotifications(
    tenantId: string,
    customerUid?: string,
    sessionId?: string
  ): Promise<DomainNotification[]> {
    return FirestorePlatformService.getCustomerNotifications(tenantId, customerUid, sessionId);
  }

  /**
   * Marks a notification as read.
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    return FirestorePlatformService.markNotificationAsRead(notificationId);
  }

  // ==========================================
  // TRANSACTIONAL ORDER TRIGGERS (Section 58)
  // ==========================================

  static async notifyOrderConfirmed(order: OrderProjection): Promise<DomainNotification> {
    return this.sendNotification(order.tenantId, {
      type: 'ORDER_CONFIRMED',
      orderId: order.orderId,
      recipientUid: (order as any).customerUid,
      recipientSessionId: (order as any).sessionId,
      title: 'Order Confirmed',
      body: `Your order #${order.orderReference || order.orderId.slice(-6)} has been received and confirmed by the store.`,
      metadata: { total: order.total, fulfillmentType: order.fulfillmentType },
    });
  }

  static async notifyPickingStarted(order: OrderProjection): Promise<DomainNotification> {
    return this.sendNotification(order.tenantId, {
      type: 'PICKING_STARTED',
      orderId: order.orderId,
      recipientUid: (order as any).customerUid,
      recipientSessionId: (order as any).sessionId,
      title: 'Picking Started',
      body: `Store associates are now hand-picking the items for your order.`,
      metadata: { itemsCount: order.itemsCount },
    });
  }

  static async notifyItemsAmended(
    order: OrderProjection,
    amendments: { substitutedCount: number; removedCount: number }
  ): Promise<DomainNotification> {
    const details = [];
    if (amendments.substitutedCount > 0) {
      details.push(`${amendments.substitutedCount} item(s) substituted`);
    }
    if (amendments.removedCount > 0) {
      details.push(`${amendments.removedCount} item(s) out of stock and removed`);
    }
    const amendmentText = details.join(' and ');

    return this.sendNotification(order.tenantId, {
      type: 'ITEMS_AMENDED',
      orderId: order.orderId,
      recipientUid: (order as any).customerUid,
      recipientSessionId: (order as any).sessionId,
      title: 'Order Items Updated',
      body: `Update on order #${order.orderReference || order.orderId.slice(-6)}: ${amendmentText}. Authorised total adjusted.`,
      metadata: {
        substitutedCount: amendments.substitutedCount,
        removedCount: amendments.removedCount,
      },
    });
  }

  static async notifyPickingComplete(order: OrderProjection): Promise<DomainNotification> {
    const isCollection = order.fulfillmentType === 'collection' || order.fulfillmentType === 'pickup';
    const title = isCollection ? 'Ready for Collection' : 'Order Packed & Ready';
    const body = isCollection
      ? `Your order #${order.orderReference || order.orderId.slice(-6)} is packed and ready for collection at the store.`
      : `Your order #${order.orderReference || order.orderId.slice(-6)} is packed and ready for dispatch.`;

    return this.sendNotification(order.tenantId, {
      type: isCollection ? 'READY_FOR_COLLECTION' : 'PICKING_COMPLETE',
      orderId: order.orderId,
      recipientUid: (order as any).customerUid,
      recipientSessionId: (order as any).sessionId,
      title,
      body,
    });
  }

  static async notifyOutForDelivery(order: OrderProjection): Promise<DomainNotification> {
    return this.sendNotification(order.tenantId, {
      type: 'OUT_FOR_DELIVERY',
      orderId: order.orderId,
      recipientUid: (order as any).customerUid,
      recipientSessionId: (order as any).sessionId,
      title: 'Out for Delivery',
      body: `Your courier is on the way with order #${order.orderReference || order.orderId.slice(-6)}.`,
      metadata: { estimatedDeliveryTime: order.estimatedDeliveryTime || '' },
    });
  }

  static async notifyOrderCompleted(order: OrderProjection): Promise<DomainNotification> {
    const isCollection = order.fulfillmentType === 'collection' || order.fulfillmentType === 'pickup';
    return this.sendNotification(order.tenantId, {
      type: isCollection ? 'ORDER_COLLECTED' : 'ORDER_DELIVERED',
      orderId: order.orderId,
      recipientUid: (order as any).customerUid,
      recipientSessionId: (order as any).sessionId,
      title: isCollection ? 'Order Collected' : 'Order Delivered',
      body: `Order #${order.orderReference || order.orderId.slice(-6)} has been successfully completed. Thank you for shopping with us!`,
    });
  }

  static async notifyOrderCancelled(order: OrderProjection, reason?: string): Promise<DomainNotification> {
    return this.sendNotification(order.tenantId, {
      type: 'ORDER_CANCELLED',
      orderId: order.orderId,
      recipientUid: (order as any).customerUid,
      recipientSessionId: (order as any).sessionId,
      title: 'Order Cancelled',
      body: `Order #${order.orderReference || order.orderId.slice(-6)} has been cancelled. Any pre-authorized funds hold has been released or refunded. ${reason ? `Reason: ${reason}` : ''}`,
      metadata: { reason: reason || 'Merchant or customer request' },
    });
  }
}
