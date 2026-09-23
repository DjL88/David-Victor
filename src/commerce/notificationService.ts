import {
  NotificationEventType,
  TenantNotificationSettings,
  OrderLiveStatus,
  DispatchedNotificationRecord,
  NotificationEventRule,
} from './notificationModels';
import { Order } from './models';

export const DEFAULT_NOTIFICATION_RULES: NotificationEventRule[] = [
  {
    id: 'rule-order-created',
    eventType: 'order_created',
    enabled: true,
    channels: ['push', 'email'],
    debounceSeconds: 0,
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30 },
    template: {
      title: 'Order {{orderRef}} Confirmed',
      body: 'Thank you for ordering with {{brandName}}. We have received your order for {{slotTime}}.',
    },
  },
  {
    id: 'rule-payment-auth',
    eventType: 'payment_authorised',
    enabled: true,
    channels: ['email'],
    debounceSeconds: 0,
    retryPolicy: { maxAttempts: 2, backoffSeconds: 15 },
    template: {
      title: 'Payment Pre-authorised: £{{authAmount}}',
      body: 'Pre-authorisation placed with safety buffer. Final charge settled strictly upon picking completion.',
    },
  },
  {
    id: 'rule-picking-started',
    eventType: 'picking_started',
    enabled: true,
    channels: ['push'],
    debounceSeconds: 60,
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30 },
    template: {
      title: 'Picking Started for {{orderRef}}',
      body: 'Our store specialist is hand-picking your fresh bakery and chilled essentials.',
    },
  },
  {
    id: 'rule-picking-amended',
    eventType: 'picking_amended',
    enabled: true,
    channels: ['push', 'sms', 'whatsapp'],
    debounceSeconds: 120, // Debounce 2 minutes so multiple picker adjustments are batched
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30 },
    template: {
      title: 'Order Item Update: Best-Match Chosen',
      body: 'An item was substituted with our Lower Price Guarantee: {{substitutionSummary}}.',
    },
  },
  {
    id: 'rule-ready-collection',
    eventType: 'ready_for_collection',
    enabled: true,
    channels: ['sms', 'push', 'email'],
    debounceSeconds: 0,
    retryPolicy: { maxAttempts: 5, backoffSeconds: 45 },
    template: {
      title: 'Your Order is Packed & Ready for Pickup',
      body: 'Head to the collection bay at {{storeName}}. Show code: {{pickupCode}}.',
    },
  },
  {
    id: 'rule-dispatched',
    eventType: 'dispatched',
    enabled: true,
    channels: ['push', 'sms'],
    debounceSeconds: 0,
    retryPolicy: { maxAttempts: 3, backoffSeconds: 30 },
    template: {
      title: 'Groceries Dispatched! Courier on the way',
      body: 'Your courier is en route in an EV delivery van. Estimated arrival: {{eta}}.',
    },
  },
  {
    id: 'rule-driver-nearby',
    eventType: 'driver_nearby',
    enabled: true,
    channels: ['push', 'sms'],
    debounceSeconds: 0,
    retryPolicy: { maxAttempts: 2, backoffSeconds: 15 },
    template: {
      title: 'Driver is 2 Minutes Away',
      body: 'Your courier is arriving shortly. Please be ready at your doorstep.',
    },
  },
  {
    id: 'rule-delivered',
    eventType: 'delivered',
    enabled: true,
    channels: ['push', 'email'],
    debounceSeconds: 0,
    retryPolicy: { maxAttempts: 3, backoffSeconds: 60 },
    template: {
      title: 'Delivered • Final Total £{{finalTotal}}',
      body: 'Your order was safely delivered. Receipt and batch certificates have been emailed.',
    },
  },
  {
    id: 'rule-failed-delivery',
    eventType: 'failed_delivery',
    enabled: true,
    channels: ['sms', 'whatsapp', 'push'],
    debounceSeconds: 0,
    retryPolicy: { maxAttempts: 5, backoffSeconds: 60 },
    template: {
      title: 'Delivery Attempted: Action Required',
      body: 'We could not reach you at your delivery address. Our driver is waiting 5 minutes.',
    },
  },
];

export const DEFAULT_NOTIFICATION_SETTINGS: Record<string, TenantNotificationSettings> = {
  'brand-alpha': {
    tenantId: 'brand-alpha',
    senderName: 'Chelmsford Artisan Grocer',
    replyToEmail: 'orders@chelmsfordgrocer.co.uk',
    updatedAt: new Date().toISOString(),
    eventRules: DEFAULT_NOTIFICATION_RULES,
  },
};

/**
 * Builds live activity and status banner data for iOS Dynamic Island, Android Live Update, or web.
 */
export function buildLiveStatusForOrder(
  order: any,
  brandName: string = 'Artisan Grocer'
): OrderLiveStatus {
  const statusStr = String(order.status || '').toUpperCase();
  const orderId = order.id || 'ORD-PREVIEW';
  const orderReference = order.orderReference || order.id || 'ORD-8942';

  let stage: OrderLiveStatus['stage'] = 'ACCEPTED';
  let headline = `${brandName}: Order Confirmed`;
  let detail = 'Order received and scheduled for fulfillment';
  let progress = 15;
  let eta = '35 mins';
  let courierName: string | undefined = undefined;

  if (statusStr.includes('PICK') || statusStr === 'PICKING') {
    stage = 'PICKING';
    headline = 'Picking your fresh groceries · 8 of 12 items';
    detail = 'Specialist is hand-selecting farm dairy & sourdough';
    progress = 45;
    eta = '25 mins';
  } else if (statusStr === 'READY_FOR_COLLECTION' || statusStr === 'PACKED' || statusStr === 'PICKING_COMPLETE') {
    stage = 'PACKED';
    headline = 'Order packed & chilled in holding';
    detail = 'Temperature-controlled staging area awaiting courier';
    progress = 70;
    eta = '18 mins';
  } else if (statusStr === 'COURIER_ASSIGNED') {
    stage = 'COURIER_ASSIGNED';
    headline = 'Courier assigned · Electric Van';
    courierName = 'Alex (EV Van 4)';
    detail = 'Courier arriving at store loading dock';
    progress = 80;
    eta = '15 mins';
  } else if (statusStr === 'DISPATCHED' || statusStr === 'OUT_FOR_DELIVERY') {
    stage = 'ON_THE_WAY';
    headline = 'On the way · 12 minutes';
    courierName = 'Alex';
    detail = '1.2 miles away · Route optimized';
    progress = 90;
    eta = '12 mins';
  } else if (statusStr === 'DRIVER_NEARBY' || statusStr === 'COURIER_NEARBY') {
    stage = 'ARRIVING';
    headline = 'Driver is 2 minutes away';
    courierName = 'Alex';
    detail = 'Pulling up to delivery destination';
    progress = 96;
    eta = '2 mins';
  } else if (statusStr === 'DELIVERED') {
    stage = 'DELIVERED';
    headline = 'Delivered to Doorstep';
    detail = 'Handed over at front door · Enjoy your fresh food';
    progress = 100;
    eta = 'Delivered';
  }

  const finalTotal =
    order.totals?.finalCapturedAmount ||
    order.totals?.total ||
    order.total ||
    38.2;

  return {
    orderId,
    orderReference,
    stage,
    headline,
    detail,
    progress,
    eta,
    courierName,
    finalTotal,
    itemsPickedCount: 8,
    itemsTotalCount: 12,
    substitutionsCount: 1,
    updatedAt: new Date().toISOString(),
  };
}

export class NotificationService {
  private settings: Record<string, TenantNotificationSettings> = DEFAULT_NOTIFICATION_SETTINGS;
  private dispatchedLogs: DispatchedNotificationRecord[] = [];

  getSettings(tenantId: string): TenantNotificationSettings {
    return (
      this.settings[tenantId] || {
        tenantId,
        senderName: 'Store updates',
        replyToEmail: '',
        eventRules: DEFAULT_NOTIFICATION_RULES.map((rule) => ({
          ...rule,
          channels: [...rule.channels],
          retryPolicy: { ...rule.retryPolicy },
          template: { ...rule.template },
        })),
        updatedAt: new Date().toISOString(),
      }
    );
  }

  saveSettings(settings: TenantNotificationSettings): void {
    this.settings[settings.tenantId] = settings;
  }

  handleOrderEvent(order: Order, eventType: NotificationEventType): OrderLiveStatus {
    const liveStatus = buildLiveStatusForOrder(order);
    return liveStatus;
  }

  getDispatchedLogs(tenantId: string, limit: number = 30): DispatchedNotificationRecord[] {
    return this.dispatchedLogs.slice(0, limit);
  }

  buildLiveStatus(order: Order): OrderLiveStatus {
    return buildLiveStatusForOrder(order);
  }
}

export const defaultNotificationService = new NotificationService();
