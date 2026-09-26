import crypto from 'crypto';
import {
  FirestorePlatformService,
  StoreProductSnoozeState,
} from '../firestoreService';
import { LinkedAccountsAdapter } from './LinkedAccountsAdapter';
import { CommerceDiscoveryService } from './CommerceDiscoveryService';

export type DeliverectOperationalWebhookType =
  | 'busy_mode'
  | 'store_status'
  | 'snooze'
  | 'menu_update'
  | 'prep_time';

export interface DeliverectOperationalWebhookResult {
  success: boolean;
  duplicate?: boolean;
  type: DeliverectOperationalWebhookType;
  channelLinkId: string;
  status?: string;
  snoozedCount?: number;
  menuId?: string;
}

function requiredChannelLinkId(payload: any): string {
  const value = String(
    payload?.channelLinkId ||
      payload?.storeId ||
      payload?.channelLink?._id ||
      payload?.channelLink?.id ||
      (typeof payload?.channelLink === 'string' ? payload.channelLink : '') ||
      ''
  ).trim();
  if (!value) {
    const err: any = new Error('Deliverect operational webhook is missing channelLinkId.');
    err.statusCode = 400;
    err.code = 'WEBHOOK_CHANNEL_LINK_MISSING';
    throw err;
  }
  return value;
}

function normaliseSnoozeItem(
  tenantId: string,
  channelLinkId: string,
  item: any,
  snoozed = true,
  observedAt = new Date().toISOString()
): StoreProductSnoozeState | null {
  const plu = String(item?.plu || item?.productPlu || '').trim();
  if (!plu) return null;

  return {
    tenantId,
    channelLinkId,
    plu,
    snoozed,
    snoozeStart: item?.snoozeStart || item?.start || undefined,
    snoozeEnd: item?.snoozeEnd || item?.end || undefined,
    updatedAt: observedAt,
    source: 'DELIVERECT_WEBHOOK',
  };
}

function menuSnoozeItems(payload: any): any[] {
  const source = payload?.snoozedProducts;
  if (!source) return [];
  if (Array.isArray(source)) return source;
  if (typeof source === 'object') return Object.values(source);
  return [];
}

export class DeliverectOperationalWebhookService {
  static async process(
    tenantId: string,
    type: DeliverectOperationalWebhookType,
    payload: any,
    rawBody: Buffer | string
  ): Promise<DeliverectOperationalWebhookResult> {
    const observedAt = new Date().toISOString();
    const channelLinkId = requiredChannelLinkId(payload);
    const rawBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(rawBody, 'utf8');
    const contentHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
    const externalEventKey = [
      'operational',
      type,
      channelLinkId,
      payload?.eventId || payload?.id || contentHash,
    ].join(':');
    const webhookEventId = `wh_op_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const claim = await FirestorePlatformService.claimWebhookIdempotency(
      'deliverect-operational',
      externalEventKey,
      webhookEventId
    );
    if (!claim.claimed) {
      return {
        success: true,
        duplicate: true,
        type,
        channelLinkId,
      };
    }

    try {
      let result: DeliverectOperationalWebhookResult;

      if (type === 'busy_mode') {
        const status = String(payload?.status || '').trim().toUpperCase();
        if (!['PAUSED', 'BUSY', 'ONLINE'].includes(status)) {
          const err: any = new Error('Busy mode status must be PAUSED, BUSY or ONLINE.');
          err.statusCode = 400;
          err.code = 'WEBHOOK_BUSY_STATUS_INVALID';
          throw err;
        }

        const delay =
          status === 'BUSY' && Number.isFinite(Number(payload?.delay))
            ? Math.max(0, Number(payload.delay))
            : undefined;

        await FirestorePlatformService.saveStoreOperationalState(
          tenantId,
          channelLinkId,
          {
            status: status as 'PAUSED' | 'BUSY' | 'ONLINE',
            preparationTimeDelay: delay,
            locationId: payload?.locationId,
            accountId: payload?.accountId,
          }
        );
        LinkedAccountsAdapter.invalidateTenantMappings(tenantId);

        result = {
          success: true,
          type,
          channelLinkId,
          status,
        };
      } else if (type === 'store_status') {
        const rawStatus = String(
          payload?.status ??
          (typeof payload?.isActive === 'boolean'
            ? payload.isActive ? 'OPEN' : 'CLOSED'
            : '')
        ).trim().toUpperCase();
        const status =
          ['ONLINE', 'OPEN', 'ACTIVE'].includes(rawStatus)
            ? 'OPEN'
            : ['PAUSED', 'CLOSED', 'INACTIVE'].includes(rawStatus)
              ? 'CLOSED'
              : rawStatus;

        if (!['OPEN', 'CLOSED'].includes(status)) {
          const err: any = new Error('Store status webhook must describe an open/closed state.');
          err.statusCode = 400;
          err.code = 'WEBHOOK_STORE_STATUS_INVALID';
          throw err;
        }

        await FirestorePlatformService.saveStoreOperationalState(
          tenantId,
          channelLinkId,
          {
            status: status as 'OPEN' | 'CLOSED',
            preparationTimeDelay: undefined,
            locationId: payload?.locationId,
            accountId: payload?.accountId,
          }
        );
        LinkedAccountsAdapter.invalidateTenantMappings(tenantId);

        result = {
          success: true,
          type,
          channelLinkId,
          status,
        };
      } else if (type === 'prep_time') {
        const rawDelay =
          payload?.preparationTime ??
          payload?.prepTime ??
          payload?.averagePreparationTime ??
          payload?.delay;
        const delay = Number(rawDelay);
        if (!Number.isFinite(delay) || delay < 0) {
          const err: any = new Error('Prep time webhook must contain a non-negative preparation time.');
          err.statusCode = 400;
          err.code = 'WEBHOOK_PREP_TIME_INVALID';
          throw err;
        }

        await FirestorePlatformService.saveStoreOperationalState(
          tenantId,
          channelLinkId,
          {
            preparationTimeDelay: delay,
            locationId: payload?.locationId,
            accountId: payload?.accountId,
          }
        );

        result = {
          success: true,
          type,
          channelLinkId,
        };
      } else if (type === 'menu_update') {
        const menuId = String(payload?.menuId || payload?._id || '').trim();
        const now = observedAt;

        await FirestorePlatformService.saveStoreOperationalState(
          tenantId,
          channelLinkId,
          {
            lastMenuId: menuId || undefined,
            menuUpdatedAt: now,
            locationId: payload?.locationId,
            accountId: payload?.accountId,
          }
        );

        const snoozes = menuSnoozeItems(payload)
          .map((item) => normaliseSnoozeItem(tenantId, channelLinkId, item, true, observedAt))
          .filter((item): item is StoreProductSnoozeState => Boolean(item));

        // A menu publish is a full current menu snapshot. If snoozedProducts is
        // present, replace our per-store snapshot so previously snoozed products
        // can become immediately available again.
        if (Object.prototype.hasOwnProperty.call(payload || {}, 'snoozedProducts')) {
          await FirestorePlatformService.replaceStoreProductSnoozes(
            tenantId,
            channelLinkId,
            snoozes,
            { observedAt }
          );
        }

        LinkedAccountsAdapter.invalidateTenantMappings(tenantId);
        CommerceDiscoveryService.getInstance().clearCache();
        result = {
          success: true,
          type,
          channelLinkId,
          menuId: menuId || undefined,
          snoozedCount: snoozes.length,
        };
      } else {
        const current = await FirestorePlatformService.getStoreProductSnoozes(
          tenantId,
          channelLinkId
        );
        const next = new Map<string, StoreProductSnoozeState>(
          Object.entries(current)
        );

        for (const operation of Array.isArray(payload?.operations) ? payload.operations : []) {
          const action = String(operation?.action || '').toLowerCase();
          const data = operation?.data || {};

          if (Array.isArray(data.allSnoozedItems)) {
            next.clear();
            for (const item of data.allSnoozedItems) {
              const normalized = normaliseSnoozeItem(
                tenantId,
                channelLinkId,
                item,
                true,
                observedAt
              );
              if (normalized) next.set(normalized.plu, normalized);
            }
          }

          for (const item of Array.isArray(data.items) ? data.items : []) {
            const normalized = normaliseSnoozeItem(
              tenantId,
              channelLinkId,
              item,
              action === 'snooze',
              observedAt
            );
            if (!normalized) continue;
            if (action === 'unsnooze') next.delete(normalized.plu);
            else if (action === 'snooze') next.set(normalized.plu, normalized);
          }
        }

        await FirestorePlatformService.replaceStoreProductSnoozes(
          tenantId,
          channelLinkId,
          Array.from(next.values()),
          { observedAt }
        );
        CommerceDiscoveryService.getInstance().clearCache();

        result = {
          success: true,
          type,
          channelLinkId,
          snoozedCount: next.size,
        };
      }

      return result;
    } catch (error) {
      await FirestorePlatformService.releaseWebhookIdempotency(
        'deliverect-operational',
        externalEventKey,
        webhookEventId
      );
      throw error;
    }
  }
}
