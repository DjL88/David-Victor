import crypto from 'crypto';

export type ChannelIngressKind =
  | 'MENU_PUSH'
  | 'SNOOZE'
  | 'UNSNOOZE'
  | 'BUSY_MODE'
  | 'STORE_STATUS'
  | 'STORE_PROVISION'
  | 'CHANNEL_REGISTRATION'
  | 'PROMOTIONS'
  | 'PREP_TIME'
  | 'ORDER_STATUS'
  | 'COURIER_UPDATE'
  | 'PAYMENT_UPDATE'
  | 'PICKING_STATUS'
  | 'ORDER_AMENDMENT'
  | 'ORDER_SUBSTITUTION';

export type ChannelIngressPriority = 'REALTIME' | 'NORMAL' | 'BULK';

export interface ChannelIngressEnvelope {
  eventId: string;
  tenantId: string;
  kind: ChannelIngressKind;
  priority: ChannelIngressPriority;
  receivedAt: string;
  channelLinkId?: string;
  locationId?: string;
  catalogId?: string;
  payload: unknown;
}

export function priorityForChannelEvent(kind: ChannelIngressKind): ChannelIngressPriority {
  switch (kind) {
    case 'SNOOZE':
    case 'UNSNOOZE':
    case 'BUSY_MODE':
    case 'STORE_STATUS':
    case 'PREP_TIME':
      return 'REALTIME';
    case 'MENU_PUSH':
      return 'BULK';
    default:
      return 'NORMAL';
  }
}

export function createChannelIngressEnvelope(input: {
  tenantId: string;
  kind: ChannelIngressKind;
  payload: any;
  rawBody?: Buffer | string;
  eventId?: string;
}): ChannelIngressEnvelope {
  const raw = input.rawBody === undefined
    ? Buffer.from(JSON.stringify(input.payload ?? {}), 'utf8')
    : Buffer.isBuffer(input.rawBody)
      ? input.rawBody
      : Buffer.from(input.rawBody, 'utf8');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  return {
    eventId: String(input.eventId || input.payload?.eventId || input.payload?.id || hash),
    tenantId: input.tenantId,
    kind: input.kind,
    priority: priorityForChannelEvent(input.kind),
    receivedAt: new Date().toISOString(),
    channelLinkId: input.payload?.channelLinkId || input.payload?.storeId || undefined,
    locationId: input.payload?.locationId || undefined,
    catalogId: input.payload?.catalogId || input.payload?.menuId || undefined,
    payload: input.payload,
  };
}

/**
 * Small deterministic buffer used before durable queue dispatch. It deliberately
 * drains REALTIME before NORMAL before BULK so an 800-menu-push burst cannot
 * starve snooze/busy-mode updates.
 *
 * Production durability is provided by the queue adapter; this class only owns
 * ordering and bounded batching.
 */
export class ChannelIngressBuffer {
  private readonly lanes: Record<ChannelIngressPriority, ChannelIngressEnvelope[]> = {
    REALTIME: [],
    NORMAL: [],
    BULK: [],
  };

  enqueue(event: ChannelIngressEnvelope): void {
    this.lanes[event.priority].push(event);
  }

  get size(): number {
    return this.lanes.REALTIME.length + this.lanes.NORMAL.length + this.lanes.BULK.length;
  }

  drain(maxItems: number): ChannelIngressEnvelope[] {
    if (maxItems <= 0) return [];
    const output: ChannelIngressEnvelope[] = [];
    for (const priority of ['REALTIME', 'NORMAL', 'BULK'] as const) {
      while (output.length < maxItems && this.lanes[priority].length) {
        output.push(this.lanes[priority].shift()!);
      }
      if (output.length >= maxItems) break;
    }
    return output;
  }
}
