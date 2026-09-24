import crypto from 'crypto';

/**
 * WebhookAuthenticator & Normalized Picking Webhook Pipeline.
 *
 * ARCHITECTURAL ROLE:
 * Decouples domain event processing from Deliverect-specific signature headers
 * and raw payload structures.
 *
 * Deliverect documents HMAC-SHA256 verification using:
 * Header: `x-server-authorization-hmac-sha256`
 */
export type NormalizedPickingDomainEvent =
  | 'ORDER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'ITEM_PICKED'
  | 'ITEM_SUBSTITUTED'
  | 'ITEM_REMOVED'
  | 'ITEM_QUANTITY_AMENDED'
  | 'PICKING_COMPLETE'
  | 'ORDER_CANCELLED_UNAVAILABLE_ITEM';

export interface NormalizedWebhookEvent<T = any> {
  eventId: string;
  orderId: string;
  channelLinkId: string;
  eventType: NormalizedPickingDomainEvent;
  timestamp: string;
  payload: T;
}

export interface WebhookAuthenticator {
  authenticate(headers: Record<string, string | string[] | undefined>, rawBody: string | Buffer): boolean;
  normalizeEvent(rawPayload: Record<string, any>): NormalizedWebhookEvent;
}

export class DeliverectWebhookAuthenticator implements WebhookAuthenticator {
  constructor(private readonly secret: string = '') {}

  authenticate(headers: Record<string, string | string[] | undefined>, rawBody: string | Buffer): boolean {
    // A configured authenticator must fail closed. Demo callers that deliberately
    // need unsigned fixtures should inject an explicit test authenticator instead.
    if (!this.secret) return false;

    const headerValue =
      headers['x-server-authorization-hmac-sha256'] ??
      headers['X-Server-Authorization-HMAC-SHA256'];
    const signature = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!signature) return false;

    try {
      const cleanSignature = signature.replace(/^sha256=/i, '').trim();
      if (!/^[a-fA-F0-9]{64}$/.test(cleanSignature)) return false;

      const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
      const expected = crypto.createHmac('sha256', this.secret).update(rawBuffer).digest();
      const actual = Buffer.from(cleanSignature, 'hex');
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  normalizeEvent(rawPayload: Record<string, any>): NormalizedWebhookEvent {
    const rawType = String(rawPayload.type || rawPayload.event || '').toLowerCase();
    let eventType: NormalizedPickingDomainEvent = 'PICKING_STARTED';

    if (rawType.includes('accepted') || rawType.includes('confirmed')) eventType = 'ORDER_ACCEPTED';
    else if (rawType.includes('substitut')) eventType = 'ITEM_SUBSTITUTED';
    else if (rawType.includes('amend') || rawType.includes('quantity')) eventType = 'ITEM_QUANTITY_AMENDED';
    else if (rawType.includes('remov')) eventType = 'ITEM_REMOVED';
    else if (rawType.includes('complete') || rawType.includes('ready')) eventType = 'PICKING_COMPLETE';
    else if (rawType.includes('picked')) eventType = 'ITEM_PICKED';
    else if (rawType.includes('cancel')) eventType = 'ORDER_CANCELLED_UNAVAILABLE_ITEM';

    return {
      eventId: rawPayload.id || `evt_${Date.now()}`,
      orderId: rawPayload.orderId || rawPayload.orderReference || '',
      channelLinkId: rawPayload.channelLinkId || '',
      eventType,
      timestamp: rawPayload.timestamp || new Date().toISOString(),
      payload: rawPayload,
    };
  }
}

// Fail-closed default. Production request handlers should construct a tenant-
// scoped authenticator with a secret resolved server-side.
export const defaultWebhookAuthenticator = new DeliverectWebhookAuthenticator();
