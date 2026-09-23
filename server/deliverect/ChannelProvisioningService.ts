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
      payload?.externalLocation?.id ||
      payload?.externalId ||
      ''
    ).trim() || undefined;

    const warnings: string[] = [];
    if (!channelLinkId) warnings.push('CHANNEL_LINK_ID_MISSING');
    if (!locationId) warnings.push('LOCATION_ID_MISSING');

    const quarantined = warnings.length > 0;

    if (channelLinkId) {
      await FirestorePlatformService.saveTenantStore(tenantId, {
        channelLinkId,
        physicalLocationId: locationId ? (locationId.startsWith('loc_') ? locationId : `loc_${locationId}`) : undefined,
        deliverectLocationId: locationId,
        externalLocationId,
        lifecycleStatus: 'ACTIVE',
        provisioningState: quarantined ? 'QUARANTINED' : type === 'CHANNEL_REGISTRATION' ? 'REGISTERED' : 'PROVISIONED',
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
      warnings,
    };
  }
}
