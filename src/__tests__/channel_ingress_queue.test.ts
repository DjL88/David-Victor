import { describe, expect, it } from 'vitest';
import {
  ChannelIngressBuffer,
  createChannelIngressEnvelope,
  priorityForChannelEvent,
} from '../../server/deliverect/ChannelIngressQueue';

describe('Channel ingress priority buffer', () => {
  it('classifies operational events ahead of bulk menu pushes', () => {
    expect(priorityForChannelEvent('SNOOZE')).toBe('REALTIME');
    expect(priorityForChannelEvent('BUSY_MODE')).toBe('REALTIME');
    expect(priorityForChannelEvent('PREP_TIME')).toBe('REALTIME');
    expect(priorityForChannelEvent('MENU_PUSH')).toBe('BULK');
    expect(priorityForChannelEvent('ORDER_STATUS')).toBe('NORMAL');
  });

  it('accepts an 800 menu burst but drains a later snooze and busy event first', () => {
    const buffer = new ChannelIngressBuffer();

    for (let index = 0; index < 800; index += 1) {
      buffer.enqueue(createChannelIngressEnvelope({
        tenantId: 'brand-scale',
        kind: 'MENU_PUSH',
        eventId: `menu-${index}`,
        payload: { channelLinkId: `store-${index}`, menuId: 'catalog-master' },
      }));
    }

    buffer.enqueue(createChannelIngressEnvelope({
      tenantId: 'brand-scale',
      kind: 'SNOOZE',
      eventId: 'snooze-now',
      payload: { channelLinkId: 'store-1', plu: 'MILK-1' },
    }));
    buffer.enqueue(createChannelIngressEnvelope({
      tenantId: 'brand-scale',
      kind: 'BUSY_MODE',
      eventId: 'busy-now',
      payload: { channelLinkId: 'store-2', status: 'BUSY' },
    }));

    expect(buffer.size).toBe(802);
    const first = buffer.drain(3);
    expect(first.map((event) => event.kind)).toEqual(['SNOOZE', 'BUSY_MODE', 'MENU_PUSH']);
    expect(buffer.size).toBe(799);
  });

  it('uses stable payload hashing when Deliverect sends no event id', () => {
    const payload = { channelLinkId: 'store-1', menuId: 'menu-1' };
    const first = createChannelIngressEnvelope({
      tenantId: 'brand-a',
      kind: 'MENU_PUSH',
      payload,
      rawBody: JSON.stringify(payload),
    });
    const second = createChannelIngressEnvelope({
      tenantId: 'brand-a',
      kind: 'MENU_PUSH',
      payload,
      rawBody: JSON.stringify(payload),
    });
    expect(first.eventId).toBe(second.eventId);
  });
});
