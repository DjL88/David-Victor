import { describe, expect, it } from 'vitest';
import { DeliverectOperationalWebhookService } from '../../server/deliverect/DeliverectOperationalWebhookService';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('WP-04 operational certification matrix', () => {
  const process = async (tenantId: string, type: any, payload: any) =>
    DeliverectOperationalWebhookService.process(tenantId, type, payload, Buffer.from(JSON.stringify(payload)));

  it.each([
    ['busy_mode', { channelLinkId: 'store-1', eventId: 'busy-1', status: 'BUSY', delay: 25 }, 'BUSY', 25],
    ['busy_mode', { channelLinkId: 'store-1', eventId: 'pause-1', status: 'PAUSED' }, 'PAUSED', undefined],
    ['busy_mode', { channelLinkId: 'store-1', eventId: 'online-1', status: 'ONLINE' }, 'ONLINE', undefined],
    ['store_status', { channelLinkId: 'store-1', eventId: 'open-1', status: 'OPEN' }, 'OPEN', undefined],
    ['store_status', { channelLinkId: 'store-1', eventId: 'closed-1', status: 'CLOSED' }, 'CLOSED', undefined],
  ])('persists %s transition %s replay-safely', async (type, payload, expectedStatus, expectedDelay) => {
    const tenantId = `cert-${payload.eventId}`;
    const first = await process(tenantId, type, payload);
    const replay = await process(tenantId, type, payload);
    expect(first).toMatchObject({ success: true, duplicate: undefined, channelLinkId: 'store-1', status: expectedStatus });
    expect(replay).toMatchObject({ success: true, duplicate: true, channelLinkId: 'store-1' });
    const state = (await FirestorePlatformService.getStoreOperationalStates(tenantId))['store-1'];
    expect(state.status).toBe(expectedStatus);
    if (expectedDelay !== undefined) expect(state.preparationTimeDelay).toBe(expectedDelay);
  });

  it('persists prep time and suppresses an exact replay', async () => {
    const tenantId = 'cert-prep-time';
    const payload = { channelLinkId: 'store-prep', eventId: 'prep-1', preparationTime: 18 };
    expect(await process(tenantId, 'prep_time', payload)).toMatchObject({ success: true });
    expect(await process(tenantId, 'prep_time', payload)).toMatchObject({ success: true, duplicate: true });
    const state = (await FirestorePlatformService.getStoreOperationalStates(tenantId))['store-prep'];
    expect(state.preparationTimeDelay).toBe(18);
  });

  it('makes snooze/unsnooze replay-safe without leaking state between stores', async () => {
    const tenantId = 'cert-snooze';
    const snooze = { channelLinkId: 'store-a', eventId: 'snooze-1', operations: [{ action: 'snooze', data: { items: [{ plu: 'MILK' }] } }] };
    const unsnooze = { channelLinkId: 'store-a', eventId: 'unsnooze-1', operations: [{ action: 'unsnooze', data: { items: [{ plu: 'MILK' }] } }] };
    await process(tenantId, 'snooze', snooze);
    expect((await process(tenantId, 'snooze', snooze)).duplicate).toBe(true);
    expect((await FirestorePlatformService.getStoreProductSnoozes(tenantId, 'store-a'))['MILK']).toBeDefined();
    expect((await FirestorePlatformService.getStoreProductSnoozes(tenantId, 'store-b'))['MILK']).toBeUndefined();
    await process(tenantId, 'snooze', unsnooze);
    expect((await process(tenantId, 'snooze', unsnooze)).duplicate).toBe(true);
    expect((await FirestorePlatformService.getStoreProductSnoozes(tenantId, 'store-a'))['MILK']).toBeUndefined();
  });

  it.each([
    ['busy_mode', { channelLinkId: 'bad-1', eventId: 'bad-busy', status: 'MAYBE' }],
    ['store_status', { channelLinkId: 'bad-2', eventId: 'bad-store', status: 'MAYBE' }],
    ['prep_time', { channelLinkId: 'bad-3', eventId: 'bad-prep', preparationTime: -1 }],
  ])('releases the idempotency claim after invalid %s input so a corrected retry can run', async (type, badPayload) => {
    const tenantId = `cert-retry-${badPayload.eventId}`;
    await expect(process(tenantId, type, badPayload)).rejects.toThrow();
    const corrected = type === 'busy_mode'
      ? { ...badPayload, status: 'ONLINE' }
      : type === 'store_status'
        ? { ...badPayload, status: 'OPEN' }
        : { ...badPayload, preparationTime: 10 };
    const result = await process(tenantId, type, corrected);
    expect(result).toMatchObject({ success: true });
    expect(result.duplicate).not.toBe(true);
  });

  it('fails closed when channelLinkId is absent', async () => {
    await expect(process('cert-missing-channel', 'busy_mode', { eventId: 'x', status: 'ONLINE' }))
      .rejects.toMatchObject({ code: 'WEBHOOK_CHANNEL_LINK_MISSING', statusCode: 400 });
  });
});
