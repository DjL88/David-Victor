import { DomainNotification, NotificationSubscription } from '../domain/models';
import { getCurrentIdToken } from '../firebase';

export class NotificationClient {
  private tenantId: string;

  constructor(tenantId: string = 'brand-alpha') {
    this.tenantId = tenantId;
  }

  setTenant(tenantId: string) {
    this.tenantId = tenantId;
  }

  /**
   * Subscribes the current device/browser to Web Push notifications.
   * If service worker and push manager are available, requests PushSubscription.
   */
  async subscribeWebPush(customerUid?: string, sessionId?: string): Promise<NotificationSubscription | null> {
    try {
      let endpoint = `in_app_fallback_${Date.now()}`;
      let keys: { p256dh: string; auth: string } | undefined;

      if (
        typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window
      ) {
        // Real browser PushManager integration if available
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        if (registration) {
          const pushSubscription = await registration.pushManager.getSubscription();
          if (pushSubscription) {
            endpoint = pushSubscription.endpoint;
            const keyJson = pushSubscription.toJSON();
            if (keyJson.keys) {
              keys = {
                p256dh: keyJson.keys.p256dh || '',
                auth: keyJson.keys.auth || '',
              };
            }
          }
        }
      }

      const token = await getCurrentIdToken().catch(() => null);
      const res = await fetch('/api/v1/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': this.tenantId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          endpoint,
          keys,
          customerUid: token ? undefined : customerUid,
          sessionId,
          channel: 'WEB_PUSH',
        }),
      });

      if (!res.ok) {
        throw new Error(`Subscription failed: ${res.statusText}`);
      }

      const data = await res.json();
      return data.subscription;
    } catch (err) {
      console.warn('[NotificationClient] Push subscription error:', err);
      return null;
    }
  }

  /**
   * Fetches the customer's notification inbox.
   */
  async getNotifications(customerUid?: string, sessionId?: string): Promise<DomainNotification[]> {
    const token = await getCurrentIdToken().catch(() => null);
    const params = new URLSearchParams();
    if (!token && customerUid) params.set('customerUid', customerUid);
    if (sessionId) params.set('sessionId', sessionId);

    const res = await fetch(`/api/v1/notifications?${params.toString()}`, {
      headers: {
        'x-tenant-id': this.tenantId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch notifications: ${res.statusText}`);
    }

    const data = await res.json();
    return data.notifications || [];
  }

  /**
   * Marks a notification as read.
   */
  async markAsRead(notificationId: string, sessionId?: string): Promise<boolean> {
    const token = await getCurrentIdToken().catch(() => null);
    const res = await fetch(`/api/v1/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': this.tenantId,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(sessionId ? { sessionId } : {}),
    });

    return res.ok;
  }
}
