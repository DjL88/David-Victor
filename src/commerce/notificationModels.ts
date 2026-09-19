/**
 * Notifications & Live Order Status Domain Models
 * Event-driven notification dispatch abstraction and platform-neutral Live Activity state.
 */

export type NotificationChannel =
  | 'EMAIL'
  | 'PUSH'
  | 'IOS_LIVE_ACTIVITY'
  | 'ANDROID_LIVE_UPDATE';

export type NotificationChannelSimple = 'sms' | 'email' | 'push' | 'whatsapp';

export type NotificationEventType =
  | 'order_created'
  | 'payment_authorised'
  | 'picking_started'
  | 'picking_amended'
  | 'ready_for_collection'
  | 'dispatched'
  | 'driver_nearby'
  | 'delivered'
  | 'failed_delivery'
  | 'ORDER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'ORDER_CHANGED'
  | 'PICKING_COMPLETE'
  | 'PAYMENT_COMPLETE'
  | 'PAYMENT_ACTION_REQUIRED'
  | 'COURIER_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'COURIER_NEARBY'
  | 'DELIVERED'
  | 'CANCELLED';

export type OrderStatusType =
  | 'CREATED'
  | 'CONFIRMED'
  | 'PICKING'
  | 'READY_FOR_COLLECTION'
  | 'DISPATCHED'
  | 'DRIVER_NEARBY'
  | 'DELIVERED'
  | 'FAILED_DELIVERY';

export interface NotificationChannelConfig {
  channel: NotificationChannel;
  enabled: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationTemplate {
  title: string;
  body: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffSeconds: number;
}

export interface NotificationEventRule {
  id: string;
  eventType: string;
  enabled: boolean;
  channels: NotificationChannelSimple[];
  template: NotificationTemplate;
  debounceSeconds: number;
  retryPolicy: RetryPolicy;
  templateSubject?: string;
  templateBody?: string;
}

export interface TenantNotificationSettings {
  tenantId: string;
  senderName: string;
  replyToEmail: string;
  eventRules: NotificationEventRule[];
  updatedAt: string;
}

export type LiveStatusStage =
  | 'ACCEPTED'
  | 'PICKING'
  | 'PACKED'
  | 'COURIER_ASSIGNED'
  | 'ON_THE_WAY'
  | 'ARRIVING'
  | 'DELIVERED';

/**
 * Platform-neutral representation of order progression for
 * iOS ActivityKit Live Activities, Android Live Update, and Web Status Banners.
 */
export interface OrderLiveStatus {
  orderId: string;
  orderReference: string;
  stage: LiveStatusStage;
  headline: string; // e.g. "Picking your order · 8 of 12 items"
  detail: string; // e.g. "Store team is hand-picking fresh essentials"
  progress?: number; // 0 to 100 percentage
  eta?: string; // e.g. "18:24" or "12 minutes"
  courierName?: string;
  courierVehicle?: string;
  finalTotal?: number;
  itemsPickedCount?: number;
  itemsTotalCount?: number;
  substitutionsCount?: number;
  updatedAt: string;
}

export interface DispatchedNotificationRecord {
  id: string;
  orderId: string;
  eventType: string;
  channel: string;
  recipientRedacted: string; // e.g. "j***@example.com" or "Device Token [iOS LiveActivity]"
  title: string;
  body: string;
  dispatchedAt: string;
  status: 'SENT' | 'DELIVERED' | 'FAILED';
}
