import { describe, expect, it, vi } from 'vitest';
import { DeliverectOperationalWebhookService } from '../../server/deliverect/DeliverectOperationalWebhookService';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('Deliverect operational webhooks', () => {
  it('persists BUSY state and preparation delay per channelLinkId', async () => {
    const tenantId = `tenant-busy-${Date.now()}`;
    const channelLinkId = 'channel-busy-1';
    const payload = {
      accountId: 'account-1',
      locationId: 'location-1',
      channelLinkId,
      status: 'BUSY',
      delay: 30,
    };

    const result = await DeliverectOperationalWebhookService.process(
      tenantId,
      'busy_mode',
      payload,
      JSON.stringify(payload)
    );

    expect(result).toMatchObject({
      success: true,
      type: 'busy_mode',
      channelLinkId,
      status: 'BUSY',
    });

    const states = await FirestorePlatformService.getStoreOperationalStates(tenantId);
    expect(states[channelLinkId]).toMatchObject({
      status: 'BUSY',
      preparationTimeDelay: 30,
      locationId: 'location-1',
      accountId: 'account-1',
    });
  });

  it('keeps a per-store snooze snapshot and removes an item on unsnooze', async () => {
    const tenantId = `tenant-snooze-${Date.now()}`;
    const channelLinkId = 'channel-snooze-1';

    const snoozePayload = {
      channelLinkId,
      operations: [
        {
          action: 'snooze',
          data: {
            items: [
              {
                plu: 'BANANA-1',
                snoozeStart: '2026-09-23T10:00:00Z',
                snoozeEnd: '2026-09-23T14:00:00Z',
              },
            ],
            allSnoozedItems: [
              {
                plu: 'BANANA-1',
                snoozeStart: '2026-09-23T10:00:00Z',
                snoozeEnd: '2026-09-23T14:00:00Z',
              },
            ],
          },
        },
      ],
    };

    const snoozed = await DeliverectOperationalWebhookService.process(
      tenantId,
      'snooze',
      snoozePayload,
      JSON.stringify(snoozePayload)
    );
    expect(snoozed.snoozedCount).toBe(1);

    const active = await FirestorePlatformService.getStoreProductSnoozes(
      tenantId,
      channelLinkId
    );
    expect(active['BANANA-1']?.snoozed).toBe(true);

    const unsnoozePayload = {
      channelLinkId,
      operations: [
        {
          action: 'unsnooze',
          data: {
            items: [{ plu: 'BANANA-1' }],
          },
        },
      ],
    };

    const unsnoozed = await DeliverectOperationalWebhookService.process(
      tenantId,
      'snooze',
      unsnoozePayload,
      JSON.stringify(unsnoozePayload)
    );
    expect(unsnoozed.snoozedCount).toBe(0);

    const cleared = await FirestorePlatformService.getStoreProductSnoozes(
      tenantId,
      channelLinkId
    );
    expect(cleared['BANANA-1']).toBeUndefined();
  });

  it('captures menu publish metadata and its current snoozed product snapshot', async () => {
    const tenantId = `tenant-menu-${Date.now()}`;
    const channelLinkId = 'channel-menu-1';
    const payload = {
      channelLinkId,
      menuId: 'menu-123',
      snoozedProducts: {
        snoozeA: {
          plu: 'MILK-1',
          snoozeStart: '2026-09-23T10:00:00Z',
          snoozeEnd: '2026-09-23T12:00:00Z',
        },
      },
    };

    const result = await DeliverectOperationalWebhookService.process(
      tenantId,
      'menu_update',
      payload,
      JSON.stringify(payload)
    );

    expect(result).toMatchObject({
      success: true,
      type: 'menu_update',
      channelLinkId,
      menuId: 'menu-123',
      snoozedCount: 1,
    });

    const states = await FirestorePlatformService.getStoreOperationalStates(tenantId);
    expect(states[channelLinkId]?.lastMenuId).toBe('menu-123');

    const snoozes = await FirestorePlatformService.getStoreProductSnoozes(
      tenantId,
      channelLinkId
    );
    expect(snoozes['MILK-1']?.snoozed).toBe(true);
  });
  it('retains snooze status for a PLU that is not in the current catalogue', async () => {
    const tenantId = `tenant-unknown-plu-${Date.now()}`;
    const channelLinkId = 'channel-unknown-plu-1';

    const payload = {
      channelLinkId,
      operations: [
        {
          action: 'snooze',
          data: {
            items: [{ plu: 'NOT-IN-CATALOG-YET' }],
          },
        },
      ],
    };

    await DeliverectOperationalWebhookService.process(
      tenantId,
      'snooze',
      payload,
      JSON.stringify(payload)
    );

    const independent = await FirestorePlatformService.getStoreProductOperationalStates(
      tenantId,
      channelLinkId
    );
    expect(independent['NOT-IN-CATALOG-YET']).toMatchObject({
      plu: 'NOT-IN-CATALOG-YET',
      availability: 'SNOOZED',
      snoozed: true,
    });

    const unsnooze = {
      channelLinkId,
      operations: [
        {
          action: 'unsnooze',
          data: { items: [{ plu: 'NOT-IN-CATALOG-YET' }] },
        },
      ],
    };

    await DeliverectOperationalWebhookService.process(
      tenantId,
      'snooze',
      unsnooze,
      JSON.stringify(unsnooze)
    );

    const after = await FirestorePlatformService.getStoreProductOperationalStates(
      tenantId,
      channelLinkId
    );
    expect(after['NOT-IN-CATALOG-YET']).toMatchObject({
      availability: 'ACTIVE',
      snoozed: false,
    });
  });


  it('replaces a 15k-SKU operational snapshot without serial per-SKU upserts', async () => {
    const tenantId = `tenant-scale-${Date.now()}`;
    const channelLinkId = 'channel-scale-15k';
    const snoozes = Array.from({ length: 15_000 }, (_, index) => ({
      tenantId,
      channelLinkId,
      plu: `SKU-${index}`,
      snoozed: true,
      updatedAt: '2026-09-26T12:00:00.000Z',
      source: 'DELIVERECT_WEBHOOK' as const,
    }));
    const perSkuUpsert = vi.spyOn(FirestorePlatformService, 'upsertStoreProductOperationalState');

    await FirestorePlatformService.replaceStoreProductSnoozes(
      tenantId,
      channelLinkId,
      snoozes
    );

    expect(perSkuUpsert).not.toHaveBeenCalled();
    const operational = await FirestorePlatformService.getStoreProductOperationalStates(
      tenantId,
      channelLinkId
    );
    expect(Object.keys(operational)).toHaveLength(15_000);
    expect(operational['SKU-0']).toMatchObject({ availability: 'SNOOZED', snoozed: true });
    expect(operational['SKU-14999']).toMatchObject({ availability: 'SNOOZED', snoozed: true });
    perSkuUpsert.mockRestore();
  }, 10_000);

  it('does not let an older bulk snooze snapshot regress newer PLU state', async () => {
    const tenantId = `tenant-snooze-order-${Date.now()}`;
    const channelLinkId = 'channel-snooze-order';

    await FirestorePlatformService.replaceStoreProductSnoozes(
      tenantId,
      channelLinkId,
      [{
        tenantId,
        channelLinkId,
        plu: 'SKU-1',
        snoozed: true,
        snoozeEnd: '2026-09-26T18:00:00.000Z',
        updatedAt: '2026-09-26T12:05:00.000Z',
        source: 'DELIVERECT_WEBHOOK',
      }],
      '2026-09-26T12:05:00.000Z'
    );

    await FirestorePlatformService.replaceStoreProductSnoozes(
      tenantId,
      channelLinkId,
      [{
        tenantId,
        channelLinkId,
        plu: 'SKU-1',
        snoozed: true,
        snoozeEnd: '2026-09-26T13:00:00.000Z',
        updatedAt: '2026-09-26T12:00:00.000Z',
        source: 'DELIVERECT_WEBHOOK',
      }],
      '2026-09-26T12:00:00.000Z'
    );

    const operational = await FirestorePlatformService.getStoreProductOperationalStates(
      tenantId,
      channelLinkId
    );
    expect(operational['SKU-1']).toMatchObject({
      availability: 'SNOOZED',
      snoozed: true,
      snoozeEnd: '2026-09-26T18:00:00.000Z',
      updatedAt: '2026-09-26T12:05:00.000Z',
    });
  });

  it('preserves last-known snoozes for an ambiguous empty replacement', async () => {
    const tenantId = `tenant-snooze-empty-${Date.now()}`;
    const channelLinkId = 'channel-snooze-empty';

    await FirestorePlatformService.replaceStoreProductSnoozes(
      tenantId,
      channelLinkId,
      [{
        tenantId,
        channelLinkId,
        plu: 'SKU-1',
        snoozed: true,
        updatedAt: '2026-09-26T12:05:00.000Z',
        source: 'DELIVERECT_WEBHOOK',
      }],
      '2026-09-26T12:05:00.000Z'
    );

    // No observedAt means this empty set carries no ordering evidence and must
    // not silently clear a newer last-known-good operational state.
    await FirestorePlatformService.replaceStoreProductSnoozes(
      tenantId,
      channelLinkId,
      []
    );

    const snoozes = await FirestorePlatformService.getStoreProductSnoozes(
      tenantId,
      channelLinkId
    );
    expect(snoozes['SKU-1']?.snoozed).toBe(true);
    const operational = await FirestorePlatformService.getStoreProductOperationalStates(
      tenantId,
      channelLinkId
    );
    expect(operational['SKU-1']?.availability).toBe('SNOOZED');
  });

  it('fails closed rather than partially applying an operational snapshot above 15k SKUs', async () => {
    const tenantId = `tenant-over-limit-${Date.now()}`;
    const channelLinkId = 'channel-scale-over-limit';
    const snoozes = Array.from({ length: 15_001 }, (_, index) => ({
      tenantId,
      channelLinkId,
      plu: `SKU-${index}`,
      snoozed: true,
      updatedAt: '2026-09-26T12:00:00.000Z',
      source: 'DELIVERECT_WEBHOOK' as const,
    }));

    await expect(
      FirestorePlatformService.replaceStoreProductSnoozes(tenantId, channelLinkId, snoozes)
    ).rejects.toMatchObject({ code: 'OPERATIONAL_STATE_LIMIT_EXCEEDED', statusCode: 413 });
  });

});
