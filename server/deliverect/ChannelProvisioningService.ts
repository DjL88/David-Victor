import { FirestorePlatformService } from '../firestoreService';

export type ChannelProvisioningEventType = 'STORE_PROVISION' | 'CHANNEL_REGISTRATION';

export interface ChannelProvisioningResult {
  accepted: boolean;
  quarantined: boolean;
  type: ChannelProvisioningEventType;
  tenantId: string;
  channelLinkId?: string;
  locationId?: string;
  externalLocationId?: string;
  accountId?: string;
  status?: string;
  warnings: string[];
}

/**
 * Tolerant Channel provisioning ingestion.
 *
 * Deliverect provisioning/registration payload contracts can evolve. We keep
 * the raw contract boundary permissive, extract only stable identifiers, and
 * quarantine incomplete events rather than rejecting/retrying them forever.
 */
export class ChannelProvisioningService {
  static async process(
    tenantId: string,
    type: ChannelProvisioningEventType,
    payload: any
  ): Promise<ChannelProvisioningResult> {
    const channelLinkId = String(
      payload?.channelLinkId ||
      payload?.storeId ||
      payload?.channelLink?._id ||
      payload?.channelLink?.id ||
      ''
    ).trim() || undefined;
    const locationId = String(
      payload?.locationId ||
      payload?.location?._id ||
      payload?.location?.id ||
      ''
    ).trim() || undefined;
    const externalLocationId = String(
      payload?.externalLocationId ||
      payload?.channelLocationId ||
      payload?.externalLocation?.id ||
      payload?.externalId ||
      ''
    ).trim() || undefined;
    const accountId = String(
      payload?.accountId ||
      payload?.account?._id ||
      payload?.account?.id ||
      (typeof payload?.account === 'string' ? payload.account : '') ||
      ''
    ).trim() || undefined;
    const status = String(
      payload?.status ||
      payload?.action ||
      payload?.event ||
      ''
    ).trim().toLowerCase() || undefined;

    const warnings: string[] = [];
    if (!channelLinkId) warnings.push('CHANNEL_LINK_ID_MISSING');
    if (!locationId) warnings.push('LOCATION_ID_MISSING');

    const quarantined = warnings.length > 0;
    const isInactiveLifecycle =
      status === 'inactive' ||
      status === 'disable' ||
      status === 'disabled';

    if (channelLinkId) {
      await FirestorePlatformService.saveTenantStore(tenantId, {
        channelLinkId,
        physicalLocationId: locationId ? (locationId.startsWith('loc_') ? locationId : `loc_${locationId}`) : undefined,
        deliverectLocationId: locationId,
        externalLocationId,
        accountId,
        accountLinkId: accountId ? `acclink_${accountId}` : undefined,
        lifecycleStatus: isInactiveLifecycle ? 'INACTIVE' : 'ACTIVE',
        status: isInactiveLifecycle ? 'INACTIVE' : undefined,
        assigned: !isInactiveLifecycle,
        provisioningState: quarantined
          ? 'QUARANTINED'
          : type === 'CHANNEL_REGISTRATION'
            ? (isInactiveLifecycle ? 'DISABLED' : status === 'active' ? 'ACTIVE' : 'REGISTERED')
            : 'PROVISIONED',
        provisioningSource: 'DELIVERECT_CHANNEL',
        lastProvisioningEventAt: new Date().toISOString(),
      });
    }

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: 'deliverect-channel',
      userName: 'Deliverect Channel',
      userRole: 'system' as any,
      tenantId,
      category: 'Integration',
      action: type,
      details: JSON.stringify({
        channelLinkId,
        locationId,
        externalLocationId,
        accountId,
        status,
        quarantined,
        warnings,
      }),
    });

    return {
      accepted: true,
      quarantined,
      type,
      tenantId,
      channelLinkId,
      locationId,
      externalLocationId,
      accountId,
      status,
      warnings,
    };
  }
}
