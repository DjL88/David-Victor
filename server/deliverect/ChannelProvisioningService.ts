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
  channelStatus?: 'REGISTERED' | 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  warnings: string[];
}

/**
 * Tolerant Channel provisioning ingestion.
 *
 * Deliverect provisioning/registration payload contracts can evolve. We keep
 * the raw contract boundary permissive, extract only stable identifiers, and
 * quarantine incomplete events rather than rejecting/retrying them forever.
 *
 * Tenant ownership is deliberately separate from operational channel state.
 * Registering/provisioning a mapped channel establishes the durable Bwydi
 * pairing; later Disable/Inactive events may stop ordering but must not silently
 * unassign the location or erase the tenant catalogue. Explicit platform-admin
 * unassignment remains the authority for breaking ownership.
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

    const rawStatus = String(
      payload?.status ||
      payload?.channelStatus ||
      payload?.integrationStatus ||
      ''
    ).trim().toUpperCase();

    const channelStatus: ChannelProvisioningResult['channelStatus'] =
      ['REGISTER', 'REGISTERED'].includes(rawStatus)
        ? 'REGISTERED'
        : ['ACTIVE', 'ACTIVATE', 'ACTIVATED'].includes(rawStatus)
          ? 'ACTIVE'
          : ['INACTIVE', 'DISABLE', 'DISABLED'].includes(rawStatus)
            ? 'INACTIVE'
            : 'UNKNOWN';

    const warnings: string[] = [];
    if (!channelLinkId) warnings.push('CHANNEL_LINK_ID_MISSING');
    if (!locationId) warnings.push('LOCATION_ID_MISSING');

    const quarantined = warnings.length > 0;

    if (channelLinkId) {
      const lifecycleStatus =
        channelStatus === 'INACTIVE'
          ? 'INACTIVE'
          : channelStatus === 'ACTIVE'
            ? 'ACTIVE'
            : type === 'STORE_PROVISION'
              ? 'ACTIVE'
              : 'INACTIVE';

      const provisioningState =
        quarantined
          ? 'QUARANTINED'
          : type === 'STORE_PROVISION'
            ? 'PROVISIONED'
            : channelStatus === 'ACTIVE'
              ? 'ACTIVE'
              : channelStatus === 'INACTIVE'
                ? 'INACTIVE'
                : 'REGISTERED';

      await FirestorePlatformService.saveTenantStore(tenantId, {
        channelLinkId,
        physicalLocationId: locationId ? (locationId.startsWith('loc_') ? locationId : `loc_${locationId}`) : undefined,
        deliverectLocationId: locationId,
        externalLocationId,
        lifecycleStatus,
        status: channelStatus === 'ACTIVE' ? 'ACTIVE' : channelStatus === 'INACTIVE' ? 'INACTIVE' : undefined,
        // Registration/provisioning establishes tenant ownership. Operational
        // INACTIVE/DISABLED state is represented above and never doubles as an
        // ownership mutation; otherwise a Deliverect lifecycle callback can
        // make the storefront lose its location/catalogue association.
        assigned: true,
        provisioningState,
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
        channelStatus,
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
      channelStatus,
      warnings,
    };
  }
}
