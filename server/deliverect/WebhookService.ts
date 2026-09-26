import crypto from 'crypto';
import { FirestorePlatformService } from '../firestoreService';
import { WebhookEvent, NormalizedPickingEvent, Money } from '../../src/domain/models';
import { PaymentService } from './PaymentService';
import { NotificationService } from '../notificationService';
import { AnalyticsService } from '../analyticsService';
import { AsyncWorkerService } from '../asyncWorkerService';
import { isDemoMode } from '../runtimeMode';
import { TenantSecretResolver } from './IntegrationContext';
import { getFirestoreDb } from '../firebase';
import { getDispatchAdapter } from './index';
import { DispatchOrchestrationService } from './DispatchOrchestrationService';
import { SecretManager } from '../secrets';

export interface WebhookProcessingResult {
  success: boolean;
  eventId: string;
  status: 'PROCESSED' | 'DEDUPLICATED' | 'IGNORED';
  message?: string;
  orderId?: string;
  newState?: string;
}

/**
 * State ranking to guarantee monotonic order progression.
 * Out-of-order events will NEVER regress an order that is already in a later lifecycle phase.
 */
export const ORDER_STATE_RANKING: Record<string, number> = {
  CHECKOUT_SUBMITTING: 1,
  SUBMITTED: 2,
  CHECKOUT_PENDING_CONFIRMATION: 3,
  PENDING: 3,
  ORDER_CONFIRMED: 4,
  CONFIRMED: 4,
  STORE_ACCEPTED: 5,
  ORDER_ACCEPTED: 5,
  ACCEPTED: 5,
  PREPARING: 6,
  PICKING: 6,
  PICKING_STARTED: 6,
  PICKING_WITH_CHANGES: 7,
  ITEM_PICKED: 7,
  ITEM_QUANTITY_AMENDED: 7,
  QUANTITY_REDUCED: 7,
  ITEM_SUBSTITUTED: 7,
  BEST_MATCH_SUBSTITUTION: 7,
  CUSTOMER_SELECTED_SUBSTITUTION: 7,
  ITEM_REMOVED: 7,
  REMOVE_IF_UNAVAILABLE: 7,
  PICKED: 8,
  PICKING_COMPLETE: 8,
  READY: 9,
  READY_FOR_PICKUP: 9,
  READY_FOR_COURIER: 9,
  COURIER_ASSIGNED: 10,
  DISPATCHING: 11,
  OUT_FOR_DELIVERY: 11,
  DELIVERED: 12,
  // Terminal states (cannot be superseded except by explicit failure workflows)
  ORDER_FAILED: 99,
  FAILED: 99,
  CANCELLED: 99,
  ORDER_CANCELLED: 99,
  ORDER_CANCELLED_UNAVAILABLE_ITEM: 99,
};

const DELIVERECT_NUMERIC_ORDER_STATUS: Record<number, string> = {
  0: 'UNKNOWN',
  10: 'ORDER_CONFIRMED',
  20: 'ACCEPTED',
  30: 'DUPLICATE',
  40: 'PREPARING',
  50: 'PREPARING',
  60: 'READY',
  70: 'READY',
  80: 'OUT_FOR_DELIVERY',
  90: 'FINALIZED',
  95: 'FINALIZED',
  100: 'ORDER_CANCELLED',
  110: 'ORDER_CANCELLED',
  120: 'ORDER_FAILED',
  121: 'ORDER_FAILED',
  124: 'ORDER_FAILED',
};

export function normalizeDeliverectOrderStatus(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return DELIVERECT_NUMERIC_ORDER_STATUS[value] || String(value);
  }

  const text = String(value ?? '').trim();
  if (/^\d+$/.test(text)) {
    const numeric = Number(text);
    return DELIVERECT_NUMERIC_ORDER_STATUS[numeric] || text;
  }

  return text.toUpperCase();
}

export class WebhookService {
  private static ingressBuckets = new Map<string, { tokens: number; updatedAt: number }>();

  /**
   * Per-tenant ingress bucket. It is intentionally applied only after HMAC
   * verification so unauthenticated traffic cannot consume another tenant's
   * allowance. A shared/distributed limiter can replace this implementation
   * without changing the route contract.
   */
  static consumeWebhookIngressToken(tenantId: string): void {
    const capacity = Math.max(10, Number(process.env.WEBHOOK_TENANT_BURST || 300));
    const refillPerMinute = Math.max(10, Number(process.env.WEBHOOK_TENANT_PER_MINUTE || 300));
    const now = Date.now();
    const current = this.ingressBuckets.get(tenantId) || { tokens: capacity, updatedAt: now };
    const elapsedMinutes = Math.max(0, now - current.updatedAt) / 60_000;
    current.tokens = Math.min(capacity, current.tokens + elapsedMinutes * refillPerMinute);
    current.updatedAt = now;

    if (current.tokens < 1) {
      const err: any = new Error('Webhook ingress queue is temporarily saturated for this tenant.');
      err.statusCode = 429;
      err.code = 'WEBHOOK_INGRESS_SATURATED';
      throw err;
    }

    current.tokens -= 1;
    this.ingressBuckets.set(tenantId, current);
  }

  static resetWebhookIngressBucketsForTest(): void {
    this.ingressBuckets.clear();
  }
  /**
   * Constant-time HMAC SHA-256 verification (WH-01).
   * Prevents timing attacks and rejects any tampered bytes or modified signatures.
   */
  static verifyDeliverectHmac(
    rawBody: Buffer | string,
    signatureHeader?: string,
    secret?: string
  ): boolean {
    if (!signatureHeader || !secret) {
      return false;
    }

    try {
      const cleanSignature = signatureHeader.replace(/^sha256=/i, '').trim();
      const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

      const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(rawBuffer)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedHex, 'hex');
      const actualBuffer = Buffer.from(cleanSignature, 'hex');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Computes an HMAC SHA-256 hex signature for testing / outgoing webhooks.
   */
  static computeHmacSignature(rawBody: Buffer | string, secret: string): string {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    return crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
  }

  /**
   * Alias for computeHmacSignature
   */
  static computeSignature(rawBody: Buffer | string, secret: string): string {
    return this.computeHmacSignature(rawBody, secret);
  }

  /**
   * Alias for computeHmacSignature (Deliverect webhook signature test helper)
   */
  static computeDeliverectHmac(rawBody: Buffer | string, secret: string): string {
    return this.computeHmacSignature(rawBody, secret);
  }

  /**
   * Directly ingests an incoming event with strict HMAC verification and idempotency check.
   */
  static async ingestEvent(
    tenantId: string,
    environment: string,
    externalEventKey: string,
    eventType: string,
    payload: any,
    rawBody: Buffer | string,
    signatureHeader: string,
    secret: string
  ): Promise<{ status: string; duplicate: boolean; webhookEventId: string }> {
    const isValid = this.verifyDeliverectHmac(rawBody, signatureHeader, secret);
    if (!isValid) {
      const err: any = new Error('HMAC verification failed: Signature does not match payload digest');
      err.statusCode = 401;
      err.code = 'HMAC_VERIFICATION_FAILED';
      throw err;
    }

    const webhookEventId = `wh_evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const claim = await FirestorePlatformService.claimWebhookIdempotency('deliverect', externalEventKey, webhookEventId);
    if (!claim.claimed) {
      return {
        status: 'DUPLICATE_ACKNOWLEDGED',
        duplicate: true,
        webhookEventId: claim.existingEventId || webhookEventId,
      };
    }

    const existing = await FirestorePlatformService.getWebhookEvent(externalEventKey);
    if (existing && existing.processingStatus === 'PROCESSED') {
      return {
        status: 'DUPLICATE_ACKNOWLEDGED',
        duplicate: true,
        webhookEventId: existing.webhookEventId,
      };
    }

    const journalEntry: WebhookEvent = {
      webhookEventId,
      provider: 'deliverect',
      environment: (environment as any) || 'staging',
      tenantId,
      externalEventKey,
      receivedAt: new Date().toISOString(),
      verified: true,
      eventType: eventType || 'ORDER_STATUS_UPDATE',
      processingStatus: 'PROCESSED',
    };

    await FirestorePlatformService.recordWebhookEvent(journalEntry);

    return {
      status: 'PROCESSED',
      duplicate: false,
      webhookEventId,
    };
  }

  /**
   * Resolves the configured Deliverect webhook secret for a tenant / environment.
   */
  static getWebhookSecret(tenantId: string = 'brand-alpha'): string {
    const tenantSpecific = process.env[`DELIVERECT_WEBHOOK_SECRET_${tenantId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
    if (tenantSpecific) return tenantSpecific;

    // A shared global secret is acceptable only in explicit demo/test. In
    // staging/production every tenant must resolve its own secret so a valid
    // signature for Tenant A can never authenticate a Tenant B webhook.
    if (isDemoMode() || process.env.NODE_ENV === 'test') {
      return process.env.DELIVERECT_WEBHOOK_SECRET || 'demo_deliverect_webhook_secret_key_123';
    }

    return '';
  }

  /**
   * Resolves the configured Dispatch webhook secret for a tenant / environment.
   * Mirrors getWebhookSecret's precedence (tenant-specific secret, generic
   * secret, demo fallback) — Dispatch webhooks are verified with the same
   * HMAC SHA-256 scheme as Deliverect commerce webhooks.
   */
  static getDispatchWebhookSecret(tenantId: string = 'brand-alpha'): string {
    const tenantSpecific = process.env[`DISPATCH_WEBHOOK_SECRET_${tenantId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`];
    if (tenantSpecific) return tenantSpecific;

    if (process.env.DISPATCH_WEBHOOK_SECRET) {
      return process.env.DISPATCH_WEBHOOK_SECRET;
    }

    if (isDemoMode() || process.env.NODE_ENV === 'test') {
      return 'demo_dispatch_webhook_secret_key_123';
    }

    return '';
  }

  /**
   * Verifies an inbound Dispatch webhook's HMAC signature. Unlike the
   * Deliverect commerce webhook, POST /dispatch/webhooks previously had no
   * signature check at all — anyone who knew an orderId could forge a
   * DELIVERED status or a fake ageCheckResult. This fails closed: a missing
   * signature, an unconfigured secret (outside demo/test mode), or a
   * mismatched signature all throw a 401 rather than letting the payload
   * through.
   */
  static async verifyDispatchWebhookAuth(
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    tenantId: string
  ): Promise<void> {
    const signatureHeader =
      (headers['x-dispatch-signature'] as string) ||
      (headers['x-dispatch-hmac-sha256'] as string) ||
      (headers['x-signature'] as string);

    const secret =
      (await TenantSecretResolver.resolveTenantSecret(tenantId, 'DISPATCH_WEBHOOK_SECRET')) ||
      this.getDispatchWebhookSecret(tenantId);

    if (!secret) {
      const err: any = new Error('Dispatch webhook secret is not configured for this tenant.');
      err.statusCode = 401;
      err.code = 'DISPATCH_WEBHOOK_SECRET_MISSING';
      throw err;
    }

    if (!this.verifyDeliverectHmac(rawBody, signatureHeader, secret)) {
      const err: any = new Error('Dispatch webhook signature verification failed.');
      err.statusCode = 401;
      err.code = 'DISPATCH_WEBHOOK_SIGNATURE_INVALID';
      throw err;
    }
  }

  /**
   * Deliverect staging may sign Channel callbacks with the channelLinkId.
   * Never derive an HMAC secret from arbitrary webhook payload fields: the
   * candidate channelLinkId must already be mapped to the resolved tenant
   * through its allowlist or discovered store projection.
   */
  static async getMappedStagingChannelLinkSecrets(
    tenantId: string,
    payload: any
  ): Promise<string[]> {
    // Menu Publish sends an array of menu objects, while the smaller Channel
    // callbacks send a single object. Extract identifiers from every envelope
    // item so the staging HMAC can still be checked against an already-mapped
    // channel/location without trusting arbitrary payload values.
    const payloadItems = Array.isArray(payload) ? payload : [payload];
    const candidateChannelLinkIds = new Set<string>();
    const candidateLocationIds = new Set<string>();
    for (const item of payloadItems) {
      // Retail/Quest picking callbacks use a PICKING_STATUS_UPDATE envelope
      // whose trusted store identifiers live under eventData. Keep accepting
      // the root-level Channel webhook shape as well.
      const eventData = item?.eventData || item?.data?.eventData || item?.data || {};
      const channelLinkId = String(
        item?.channelLinkId ||
        item?.channelLink?._id ||
        item?.channelLink?.id ||
        (typeof item?.channelLink === 'string' ? item.channelLink : '') ||
        eventData?.channelLinkId ||
        eventData?.channelLink?._id ||
        eventData?.channelLink?.id ||
        (typeof eventData?.channelLink === 'string' ? eventData.channelLink : '') ||
        ''
      ).trim();
      const locationId = String(
        item?.locationId ||
        item?.location?._id ||
        item?.location?.id ||
        (typeof item?.location === 'string' ? item.location : '') ||
        eventData?.locationId ||
        eventData?.location?._id ||
        eventData?.location?.id ||
        (typeof eventData?.location === 'string' ? eventData.location : '') ||
        ''
      ).trim();
      if (channelLinkId) candidateChannelLinkIds.add(channelLinkId);
      if (locationId) candidateLocationIds.add(locationId);
    }

    const integration = await FirestorePlatformService.getIntegrationConfig(tenantId);
    const isProductionWebhook =
      integration?.environment === 'production' ||
      process.env.DELIVERECT_ENV === 'production';
    if (isProductionWebhook) return [];

    const allowed = new Set(
      (integration?.allowedChannelLinkIds || [])
        .map((value: unknown) => String(value || '').trim())
        .filter(Boolean)
    );
    const stores = await FirestorePlatformService.getTenantStores(tenantId);
    const activeStores = stores.filter((store: any) => {
      const channelLinkId = String(store?.channelLinkId || store?.id || '').trim();
      return Boolean(channelLinkId) &&
        store?.lifecycleStatus !== 'ORPHANED' &&
        store?.lifecycleStatus !== 'ARCHIVED' &&
        (!allowed.size || allowed.has(channelLinkId));
    });

    const secrets = new Set<string>();
    const addMappedStoreSecrets = (store: any) => {
      const channelLinkId = String(store?.channelLinkId || store?.id || '').trim();
      const deliverectLocationId = String(store?.deliverectLocationId || '').trim();
      const physicalLocationId = String(store?.physicalLocationId || '').trim();
      const externalLocationId = String(store?.externalLocationId || '').trim();

      if (channelLinkId) secrets.add(channelLinkId);

      // Deliverect documents channelLink as the normal staging secret. Some
      // partner callbacks may use a location identifier in staging. Only add
      // location values already bound to this resolved tenant/store.
      if (deliverectLocationId) secrets.add(deliverectLocationId);
      if (physicalLocationId) {
        secrets.add(physicalLocationId);
        if (physicalLocationId.startsWith('loc_')) {
          secrets.add(physicalLocationId.slice(4));
        }
      }
      if (externalLocationId) secrets.add(externalLocationId);
    };

    for (const candidateChannelLinkId of candidateChannelLinkIds) {
      if (allowed.has(candidateChannelLinkId)) {
        secrets.add(candidateChannelLinkId);
      }
      const matchedStore = activeStores.find((store: any) =>
        String(store?.channelLinkId || store?.id || '').trim() === candidateChannelLinkId
      );
      if (matchedStore) addMappedStoreSecrets(matchedStore);
    }

    for (const candidateLocationId of candidateLocationIds) {
      const matchedStore = activeStores.find((store: any) => {
        const values = [
          store?.deliverectLocationId,
          store?.physicalLocationId,
          typeof store?.physicalLocationId === 'string' && store.physicalLocationId.startsWith('loc_')
            ? store.physicalLocationId.slice(4)
            : undefined,
          store?.externalLocationId,
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        return values.includes(candidateLocationId);
      });
      if (matchedStore) addMappedStoreSecrets(matchedStore);
    }

    // Defensive fallback for a single-store staging tenant. This avoids
    // rejecting a genuine callback if Deliverect omits/moves the channelLinkId
    // field while keeping the fallback bounded to one already-mapped store.
    if (secrets.size === 0 && activeStores.length === 1) {
      const onlyStore = activeStores[0];
      const onlyChannelLinkId = String(
        onlyStore?.channelLinkId || onlyStore?.id || ''
      ).trim();
      if (!allowed.size || allowed.has(onlyChannelLinkId)) {
        addMappedStoreSecrets(onlyStore);
      }
    }

    // A known LT channel can be assigned manually while Deliverect's store
    // discovery temporarily omits it. In that state there is deliberately no
    // store projection yet, but a sole tenant-scoped allowlist entry is still
    // an authoritative mapping and is the documented staging HMAC secret.
    if (secrets.size === 0 && allowed.size === 1) {
      secrets.add(Array.from(allowed)[0]);
    }

    return Array.from(secrets);
  }

  /**
   * Resolves an operational callback to an already-mapped channel link.
   *
   * Deliverect Menu Push payloads do not always repeat channelLinkId even though
   * the callback URL/account/location is already bound to a store. Never trust
   * an arbitrary payload value: only return a channel link that is already
   * present in this tenant's active store projection (and allowlist when set).
   */
  static async resolveMappedOperationalChannelLinkId(
    tenantId: string,
    payload: any
  ): Promise<string | null> {
    const payloadItems = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.menus)
        ? payload.menus
        : [payload];
    const integration = await FirestorePlatformService.getIntegrationConfig(tenantId);
    const allowed = new Set(
      (integration?.allowedChannelLinkIds || [])
        .map((value: unknown) => String(value || '').trim())
        .filter(Boolean)
    );
    const stores = await FirestorePlatformService.getTenantStores(tenantId);
    const activeStores = stores.filter((store: any) => {
      const lifecycle = String(store?.lifecycleStatus || 'ACTIVE').toUpperCase();
      const id = String(store?.channelLinkId || store?.id || '').trim();
      return Boolean(id) &&
        lifecycle !== 'ORPHANED' &&
        lifecycle !== 'ARCHIVED' &&
        (!allowed.size || allowed.has(id));
    });

    const directChannelLinkIds = Array.from(new Set<string>(payloadItems
      .map((item: any) => String(
        item?.channelLinkId ||
        item?.storeId ||
        item?.channelLink?._id ||
        item?.channelLink?.id ||
        (typeof item?.channelLink === 'string' ? item.channelLink : '') ||
        ''
      ).trim())
      .filter(Boolean)));
    if (directChannelLinkIds.length === 1) {
      const directChannelLinkId = directChannelLinkIds[0];
      const direct = activeStores.find((store: any) =>
        String(store?.channelLinkId || store?.id || '').trim() === directChannelLinkId
      );
      if (direct) return directChannelLinkId;
    }

    const locationCandidates = payloadItems.flatMap((item: any) => [
      item?.locationId,
      item?.channelLocationId,
      item?.externalLocationId,
      item?.location?._id,
      item?.location?.id,
      typeof item?.location === 'string' ? item.location : undefined,
    ])
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    if (locationCandidates.length) {
      const matched = activeStores.filter((store: any) => {
        const storeValues = [
          store?.deliverectLocationId,
          store?.physicalLocationId,
          typeof store?.physicalLocationId === 'string' && store.physicalLocationId.startsWith('loc_')
            ? store.physicalLocationId.slice(4)
            : undefined,
          store?.externalLocationId,
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        return locationCandidates.some((candidate) => storeValues.includes(candidate));
      });
      if (matched.length === 1) {
        return String(matched[0]?.channelLinkId || matched[0]?.id || '').trim() || null;
      }
    }

    const payloadAccountIds = Array.from(new Set<string>(payloadItems
      .map((item: any) => String(
        item?.accountId ||
        item?.account?._id ||
        item?.account?.id ||
        (typeof item?.account === 'string' ? item.account : '') ||
        ''
      ).trim())
      .filter(Boolean)));
    const payloadAccountId = payloadAccountIds.length === 1 ? payloadAccountIds[0] : '';
    const mappedAccountId = String(integration?.deliverectAccountId || '').trim();

    // Account-only callbacks are safe to collapse to a store only when the
    // tenant has exactly one active mapped channel. Never guess in multi-store
    // estates because the same account can legitimately contain many locations.
    if (
      activeStores.length === 1 &&
      (!payloadAccountId || !mappedAccountId || payloadAccountId === mappedAccountId)
    ) {
      return String(activeStores[0]?.channelLinkId || activeStores[0]?.id || '').trim() || null;
    }

    return null;
  }

  /**
   * Section 24 & Item 16:
   * Resolves the webhook tenant authoritatively. Never trusts blind query or header parameters.
   * Tests HMAC verification across configured tenant secrets.
   */
  static async resolveTenantForWebhook(
    rawBody: Buffer | string,
    signatureHeader?: string,
    candidateTenantId?: string,
    options?: {
      stagingTemporarySecrets?: string[];
    }
  ): Promise<{ tenantId: string; secret: string }> {
    if (!signatureHeader) {
      const err: any = new Error('Missing webhook signature header');
      err.statusCode = 401;
      err.code = 'WEBHOOK_SIGNATURE_MISSING';
      throw err;
    }

    if (!candidateTenantId) {
      const err: any = new Error('Webhook tenant could not be resolved from the route identifier.');
      err.statusCode = 404;
      err.code = 'WEBHOOK_TENANT_NOT_FOUND';
      throw err;
    }

    const integration = await FirestorePlatformService.getIntegrationConfig(candidateTenantId);
    const environment = String(
      integration?.activeEnv ||
      integration?.environment ||
      process.env.DELIVERECT_ENV ||
      'staging'
    ).toLowerCase() === 'production'
      ? 'production'
      : 'staging';

    // Demo/test fixtures keep their explicit local secret. Live deployments
    // must follow the active integration profile's Secret Manager reference;
    // the old deliverect-webhook-{tenantId} name remains a migration fallback.
    let secret = '';
    if (isDemoMode() || process.env.NODE_ENV === 'test') {
      secret = this.getWebhookSecret(candidateTenantId);
    } else {
      let configuredSecretRef = '';
      try {
        const profile = await FirestorePlatformService.getIntegrationProfile(
          candidateTenantId,
          environment
        );
        configuredSecretRef = String(
          profile?.secretRefs?.deliverectWebhookSecret || ''
        ).trim();
      } catch {
        // Preserve legacy lookup when a profile is not available yet.
      }
      secret =
        (configuredSecretRef
          ? await SecretManager.getSecret(configuredSecretRef)
          : null) ||
        (await SecretManager.getSecret(`deliverect-webhook-${candidateTenantId}`)) ||
        '';
    }

    if (secret && this.verifyDeliverectHmac(rawBody, signatureHeader, secret)) {
      this.consumeWebhookIngressToken(candidateTenantId);
      return { tenantId: candidateTenantId, secret };
    }

    const isProductionWebhook =
      integration?.environment === 'production' ||
      process.env.DELIVERECT_ENV === 'production' ||
      process.env.APP_MODE === 'production';

    // Deliverect staging Channel callbacks may be signed with the mapped
    // channelLink/location identifier instead of the tenant webhook secret.
    // These candidates are not payload-trusted: callers obtain them only from
    // this tenant's existing store projection/allowlist. Permit that bounded
    // staging scheme automatically so callback auth does not depend on a
    // deployment-specific feature flag. Production always fails closed to the
    // canonical tenant Secret Manager secret above.
    if (!isProductionWebhook) {
      const candidates = Array.from(
        new Set(
          (options?.stagingTemporarySecrets || [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      );

      for (const temporarySecret of candidates) {
        if (this.verifyDeliverectHmac(rawBody, signatureHeader, temporarySecret)) {
          console.info(
            `[WebhookService] Verified mapped staging Channel HMAC for tenant ${candidateTenantId}.`
          );
          this.consumeWebhookIngressToken(candidateTenantId);
          return { tenantId: candidateTenantId, secret: temporarySecret };
        }
      }
    }

    const err: any = new Error('Invalid webhook HMAC signature for resolved tenant');
    err.statusCode = 401;
    err.code = 'WEBHOOK_SIGNATURE_INVALID';
    throw err;
  }

  /**
   * Ingests, journals, deduplicates, and processes an incoming Deliverect webhook event.
   * Enforces:
   * 1. HMAC validation (WH-01)
   * 2. Immutable journal entry in Firestore (webhookEvents)
   * 3. Idempotent deduplication (WH-02)
   * 4. Monotonic state progression (WH-03: out-of-order tolerance)
   */
  static async processWebhook(
    payload: any,
    rawBody: Buffer | string,
    headers: Record<string, string | string[] | undefined>,
    tenantId: string = 'brand-alpha'
  ): Promise<WebhookProcessingResult> {
    const signatureHeader =
      (headers['x-server-authorization-hmac-sha256'] as string) ||
      (headers['x-deliverect-signature'] as string) ||
      (headers['x-signature'] as string) ||
      (headers['x-deliverect-hmac-sha256'] as string);

    // 1. Authoritatively resolve tenant & verify HMAC signature
    const stagingTemporarySecrets =
      await this.getMappedStagingChannelLinkSecrets(tenantId, payload);

    const { tenantId: resolvedTenantId } = await this.resolveTenantForWebhook(
      rawBody,
      signatureHeader,
      tenantId,
      { stagingTemporarySecrets }
    );
    tenantId = resolvedTenantId;

    // 2. Identify external event key
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');

    const timestampValue =
      payload?.timestamp ||
      payload?.createdAt ||
      payload?.updatedAt ||
      payload?.data?.timestamp;
    if (timestampValue) {
      const timestampMs = Date.parse(String(timestampValue));
      if (Number.isFinite(timestampMs) && Date.now() - timestampMs > 5 * 60 * 1000) {
        const err: any = new Error('Webhook timestamp is older than the permitted 5 minute window.');
        err.statusCode = 400;
        err.code = 'WEBHOOK_TIMESTAMP_STALE';
        throw err;
      }
    }

    const externalEventKey = crypto
      .createHash('sha256')
      .update(Buffer.from(`${tenantId}:`, 'utf8'))
      .update(rawBuffer)
      .digest('hex');

    const webhookEventId = `wh_evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 3. Deduplication Check (WH-02) via Atomic Idempotency Claim
    const claim = await FirestorePlatformService.claimWebhookIdempotency('deliverect', externalEventKey, webhookEventId);
    if (!claim.claimed) {
      console.log(`[WebhookService] Deduplicated event ${externalEventKey} via atomic idempotency claim.`);
      return {
        success: true,
        eventId: claim.existingEventId || webhookEventId,
        status: 'DEDUPLICATED',
        message: 'Event was previously processed and acknowledged idempotently.',
      };
    }

    try {
    const existing = await FirestorePlatformService.getWebhookEvent(externalEventKey);
    if (existing && existing.processingStatus === 'PROCESSED') {
      console.log(`[WebhookService] Deduplicated event ${externalEventKey} - already processed.`);
      return {
        success: true,
        eventId: existing.webhookEventId,
        status: 'DEDUPLICATED',
        message: 'Event was previously processed and acknowledged idempotently.',
      };
    }

    // 4. Resolve integration environment authoritatively
    const integrationConfig = await FirestorePlatformService.getIntegrationConfig(tenantId);
    const resolvedEnv: 'staging' | 'production' =
      integrationConfig?.environment === 'production' || (!isDemoMode() && process.env.DELIVERECT_ENV === 'production')
        ? 'production'
        : 'staging';

    // Inbound Event Journal (Write PENDING)
    const journalEntry: WebhookEvent = {
      webhookEventId,
      provider: 'deliverect',
      environment: resolvedEnv,
      tenantId,
      externalEventKey,
      receivedAt: new Date().toISOString(),
      verified: true,
      eventType: payload.event || payload.eventType || payload.type || payload.status || payload.action || 'ORDER_STATUS_UPDATE',
      processingStatus: 'PENDING',
    };

    await FirestorePlatformService.recordWebhookEvent(journalEntry);

    // 5. Normalise and Process State Update
    const explicitStatus =
      payload.status ||
      payload.orderStatus ||
      payload.pickingStatus ||
      payload.data?.status;

    const rawStatus = normalizeDeliverectOrderStatus(
      explicitStatus ??
      payload.event ??
      payload.eventType ??
      payload.type ??
      payload.action ??
      ''
    );

    const correlationCandidates = [
      payload.orderId,
      payload.order?.id,
      payload.order?._id,
      payload.data?.orderId,
      payload.channelOrderId,
      payload.order?.channelOrderId,
      payload.channelOrderDisplayId,
      payload.order?.channelOrderDisplayId,
      payload.channelOrderRawId,
      payload.orderReference,
      payload.checkoutId,
      payload.data?.checkoutId,
      payload.checkout?.id,
      payload.channelOrderReference,
    ]
      .map((value) => String(value || '').trim())
      .filter((value, index, values) => value && values.indexOf(value) === index);

    let targetOrder = null;
    for (const candidate of correlationCandidates) {
      targetOrder = await FirestorePlatformService.getOrderProjectionByExternalIdentifier(candidate);
      if (targetOrder) break;
    }

    if (targetOrder?.tenantId && targetOrder.tenantId !== tenantId) {
      const err: any = new Error('Webhook order correlation resolved to a different tenant.');
      err.statusCode = 403;
      err.code = 'WEBHOOK_TENANT_MISMATCH';
      throw err;
    }

    // Backward-compatible checkout-only recovery for pending checkouts created before
    // provisional order projections were introduced.
    if (!targetOrder) {
      const explicitCheckoutId = String(
        payload.checkoutId || payload.data?.checkoutId || payload.checkout?.id || ''
      ).trim();
      const channelOrderReference = String(
        payload.channelOrderId ||
        payload.order?.channelOrderId ||
        payload.channelOrderReference ||
        ''
      ).trim();

      let checkout = explicitCheckoutId
        ? await FirestorePlatformService.getCheckoutProjection(explicitCheckoutId)
        : null;
      if (!checkout && channelOrderReference) {
        checkout = await FirestorePlatformService.getCheckoutByReference(channelOrderReference);
      }

      if (checkout && ['OPEN', 'COMPLETED', 'FAILED'].includes(rawStatus)) {
        const upstreamOrderId = String(
          payload.orderId ||
          payload.order?.id ||
          payload.order?._id ||
          payload.data?.orderId ||
          ''
        ).trim() || undefined;

        const checkoutState =
          rawStatus === 'COMPLETED'
            ? 'ORDER_CONFIRMED'
            : rawStatus === 'FAILED'
              ? 'ORDER_FAILED'
              : 'CHECKOUT_PENDING_CONFIRMATION';

        await FirestorePlatformService.updateCheckoutStatus(
          checkout.checkoutId,
          checkoutState,
          {
            orderId: upstreamOrderId || checkout.orderId,
            failureReason: payload.failureReason || payload.reason,
          }
        );
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');

        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: upstreamOrderId || checkout.orderId,
          newState: checkoutState,
        };
      }
    }

    if (targetOrder) {
      const currentState = (targetOrder.status || 'SUBMITTED').toUpperCase();

      // Deliverect status 30 means its upstream system detected a duplicate
      // insertion. This is diagnostic, not a new customer lifecycle state, so
      // acknowledge it without replacing the real order state with "DUPLICATE".
      if (rawStatus === 'DUPLICATE') {
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'IGNORED',
          message: 'Deliverect reported a duplicate order insertion; existing order state was preserved.',
          orderId: targetOrder.orderId,
          newState: currentState,
        };
      }

      // Unknown numeric POS/order statuses are valid transport events but do not
      // carry a documented lifecycle meaning for this integration. Acknowledge
      // and journal them without inventing a state transition. This specifically
      // prevents values such as Quest status 25 from being mistaken for a
      // picking event or persisted literally as an order state.
      if (/^\d+$/.test(rawStatus)) {
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'IGNORED',
          message: `Unmapped Deliverect numeric order status ${rawStatus} was safely acknowledged without changing order state.`,
          orderId: targetOrder.orderId,
          newState: currentState,
        };
      }

      const currentRank = ORDER_STATE_RANKING[currentState] || 0;
      const incomingRank = ORDER_STATE_RANKING[rawStatus] || 0;

      const isQuestItemEvent = [
        'ITEM_PICKED',
        'ITEM_QUANTITY_AMENDED',
        'QUANTITY_REDUCED',
        'ITEM_SUBSTITUTED',
        'BEST_MATCH_SUBSTITUTION',
        'CUSTOMER_SELECTED_SUBSTITUTION',
        'ITEM_REMOVED',
        'REMOVE_IF_UNAVAILABLE',
        'ORDER_CANCELLED_UNAVAILABLE_ITEM',
      ].includes(rawStatus);

      // WH-03: Monotonic Progression Guard for general order status transitions
      if (!isQuestItemEvent && incomingRank > 0 && incomingRank <= currentRank && currentRank < 90) {
        console.warn(
          `[WebhookService] Out-of-order webhook ignored for order ${targetOrder.orderId}. Current state: ${currentState} (rank ${currentRank}), incoming: ${rawStatus} (rank ${incomingRank}). No regression permitted.`
        );

        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'IGNORED',
          message: `Order state is already at ${currentState}; out-of-order state ${rawStatus} was safely acknowledged without regression.`,
          orderId: targetOrder.orderId,
          newState: currentState,
        };
      }

      // Guard: If it's a Quest item event but order has already completed picking (rank >= 8) or is cancelled (rank 99)
      if (isQuestItemEvent && currentRank >= 8 && rawStatus !== 'ORDER_CANCELLED_UNAVAILABLE_ITEM') {
        console.warn(
          `[WebhookService] Picking item event ${rawStatus} ignored for order ${targetOrder.orderId}. Order is already at state ${currentState} (rank ${currentRank}).`
        );
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'IGNORED',
          message: `Order state is already at ${currentState}; item event ${rawStatus} was safely acknowledged without regression.`,
          orderId: targetOrder.orderId,
          newState: currentState,
        };
      }

      // 1. Quest: Order Cancelled due to unavailable critical item (QST-05 / QST-06)
      if (rawStatus === 'ORDER_CANCELLED_UNAVAILABLE_ITEM') {
        const targetPlu = payload.plu || payload.item?.plu || payload.originalPlu;
        if (targetPlu) {
          await FirestorePlatformService.updateOrderPickingItem(targetOrder.orderId, targetPlu, {
            state: 'REMOVED',
            pickedQuantity: 0,
            finalPrice: { amount: 0, currency: 'GBP' },
          });
        }
        await FirestorePlatformService.updateOrderPickingState(targetOrder.orderId, { status: 'CANCELLED' });
        // Do NOT set paymentState here: PaymentService.handleOrderCancellation (invoked
        // below) reads order.paymentState to decide refund vs. void vs. no-op-for-unpaid,
        // so writing 'RELEASED' first would corrupt that decision — it was previously
        // set directly here, silently skipping the real refund/void logic entirely.
        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'CANCELLED', {
          failureReason: payload.reason || 'Item unavailable: order cancelled per customer substitution policy',
          updatedViaWebhookId: webhookEventId,
        });
        if (targetOrder.checkoutId) {
          await FirestorePlatformService.updateCheckoutStatus(targetOrder.checkoutId, 'CANCELLED', {
            orderId: targetOrder.orderId,
            failureReason: payload.reason || 'Order cancelled per customer substitution policy',
          });
        }
        // Same real cancellation workflow as the general ORDER_CANCELLED/FAILED branch
        // below: void/refund via PaymentService, notify, track analytics.
        AsyncWorkerService.enqueueOrderCancellation({
          orderId: targetOrder.orderId,
          tenantId: targetOrder.tenantId,
          reason: payload.reason || 'Item unavailable: order cancelled per customer substitution policy',
        });
        if (targetOrder.fulfillmentType === 'delivery') {
          const dispatchAdapter = getDispatchAdapter(targetOrder.tenantId);
          DispatchOrchestrationService.handleOrderCancelled(
            targetOrder.orderId,
            targetOrder.tenantId,
            dispatchAdapter,
            payload.reason
          ).catch((err) => console.warn('[WebhookService] Dispatch cancel error:', err));
        }
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: targetOrder.orderId,
          newState: 'CANCELLED',
        };
      }

      // 2. Quest: Individual Item Picked
      if (rawStatus === 'ITEM_PICKED') {
        const targetPlu = payload.plu || payload.item?.plu || payload.originalPlu || payload.product?.plu;
        if (targetPlu) {
          const existingItem = await FirestorePlatformService.getOrderLineItem(targetOrder.orderId, targetPlu);
          const pickedQty = payload.quantity ?? payload.pickedQuantity ?? existingItem?.originalQuantity ?? 1;
          await FirestorePlatformService.updateOrderPickingItem(targetOrder.orderId, targetPlu, {
            state: 'PICKED',
            pickedQuantity: pickedQty,
          });
        }
        const nextState = currentRank < 6 ? 'PICKING' : currentState;
        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, nextState, {
          updatedViaWebhookId: webhookEventId,
        });
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: targetOrder.orderId,
          newState: nextState,
        };
      }

      // 3. Quest: Item Quantity Amended / Reduced (QST-03)
      if (rawStatus === 'ITEM_QUANTITY_AMENDED' || rawStatus === 'QUANTITY_REDUCED') {
        const targetPlu = payload.plu || payload.item?.plu || payload.originalPlu || payload.product?.plu;
        if (targetPlu) {
          const existingItem = await FirestorePlatformService.getOrderLineItem(targetOrder.orderId, targetPlu);
          const suppliedQuantity =
            payload.amendedQuantity ?? payload.suppliedQuantity ?? payload.quantity ?? payload.newQuantity ?? 0;
          const originalQuantity = existingItem?.originalQuantity || (existingItem as any)?.orderedQuantity || 1;
          const origPriceRaw = existingItem?.originalPrice || { amount: 0, currency: 'GBP' };
          const origUnitPrice =
            typeof origPriceRaw === 'number' ? origPriceRaw : origPriceRaw.amount;

          // Deliverect Retail item prices are unit prices in integer minor units.
          // Quantity is applied separately by the final-amount calculator. If Quest
          // amends quantity without sending a replacement unit price, preserve the
          // original unit price. Dividing by originalQuantity here would undercharge
          // every multi-quantity amendment.
          const amendedUnitPrice =
            payload.amendedPrice !== undefined
              ? typeof payload.amendedPrice === 'number'
                ? payload.amendedPrice
                : payload.amendedPrice.amount
              : origUnitPrice;

          const finalPrice: Money = {
            amount: Math.round(amendedUnitPrice),
            currency:
              (typeof payload.amendedPrice === 'object' && payload.amendedPrice?.currency) ||
              (typeof origPriceRaw === 'object' && origPriceRaw?.currency) ||
              'GBP',
          };

          await FirestorePlatformService.updateOrderPickingItem(targetOrder.orderId, targetPlu, {
            state: 'QUANTITY_AMENDED',
            pickedQuantity: suppliedQuantity,
            finalPrice,
            amendment: {
              originalQuantity,
              suppliedQuantity,
              reason: payload.reason || 'Store inventory limited',
            },
          });
        }
        const refreshed = await FirestorePlatformService.getOrderProjection(targetOrder.orderId);
        const nextFinal = refreshed
          ? PaymentService.calculateAuthoritativeFinalAmount(refreshed)
          : 0;

        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKING_WITH_CHANGES', {
          updatedViaWebhookId: webhookEventId,
          finalAmount: nextFinal,
          upstreamReportedFinalAmount:
            payload.newFinalAmount ?? payload.finalAmount,
        });
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: targetOrder.orderId,
          newState: 'PICKING_WITH_CHANGES',
        };
      }

      // 4. Quest: Item Substituted - Best Match or Customer Selected (QST-04, QST-05)
      if (
        rawStatus === 'ITEM_SUBSTITUTED' ||
        rawStatus === 'BEST_MATCH_SUBSTITUTION' ||
        rawStatus === 'CUSTOMER_SELECTED_SUBSTITUTION'
      ) {
        const targetPlu = payload.plu || payload.item?.plu || payload.originalPlu || payload.product?.plu;
        if (targetPlu) {
          const existingItem = await FirestorePlatformService.getOrderLineItem(targetOrder.orderId, targetPlu);
          const subPlu = payload.substitutePlu || payload.substitute?.plu || payload.newPlu || 'SUB_PLU';
          const subName = payload.substituteName || payload.substitute?.name || 'Alternative Product';
          const subPriceRaw =
            payload.substitutePrice ??
            payload.substituteCatalogPrice ??
            payload.substitute?.price;
          const subPriceAmount =
            typeof subPriceRaw === 'object' && subPriceRaw !== null
              ? subPriceRaw.amount
              : Number(subPriceRaw || 0);

          const origPriceRaw =
            existingItem?.originalPrice ??
            payload.originalPrice ??
            payload.item?.price;
          const origPriceAmount =
            typeof origPriceRaw === 'object' && origPriceRaw !== null
              ? origPriceRaw.amount
              : Number(origPriceRaw || 0);

          const subType =
            rawStatus === 'CUSTOMER_SELECTED_SUBSTITUTION' ||
            payload.type === 'CUSTOMER_SELECTED' ||
            payload.substitutionType === 'CUSTOMER_SELECTED'
              ? 'CUSTOMER_SELECTED'
              : 'BEST_MATCH';

          // Lower-of-Original-and-Substitute guarantee for Best Match substitutions
          const preferredApprovedRaw = existingItem?.preferredSubstitutePrice;
          const preferredApprovedAmount =
            typeof preferredApprovedRaw === 'object' && preferredApprovedRaw !== null
              ? preferredApprovedRaw.amount
              : typeof preferredApprovedRaw === 'number'
                ? preferredApprovedRaw
                : undefined;

          const requestedChargedPrice =
            payload.chargedPrice !== undefined
              ? typeof payload.chargedPrice === 'object'
                ? payload.chargedPrice.amount
                : Number(payload.chargedPrice)
              : subType === 'BEST_MATCH'
                ? Math.min(origPriceAmount, subPriceAmount)
                : subPriceAmount;

          const chargedPriceAmount =
            subType === 'CUSTOMER_SELECTED' &&
            preferredApprovedAmount !== undefined
              ? Math.min(requestedChargedPrice, preferredApprovedAmount)
              : subType === 'BEST_MATCH'
                ? Math.min(
                    requestedChargedPrice,
                    origPriceAmount,
                    subPriceAmount
                  )
                : requestedChargedPrice;

          const currency = (origPriceRaw as any)?.currency || (existingItem?.originalPrice as any)?.currency || 'GBP';
          const finalPrice: Money = { amount: chargedPriceAmount, currency };
          const substitutePrice: Money = { amount: subPriceAmount, currency };
          const originalPrice: Money = typeof origPriceRaw === 'object' && origPriceRaw !== null && 'amount' in origPriceRaw
            ? origPriceRaw
            : { amount: origPriceAmount, currency };
          const chargedPrice: Money = { amount: chargedPriceAmount, currency };

          await FirestorePlatformService.updateOrderPickingItem(targetOrder.orderId, targetPlu, {
            state: 'SUBSTITUTED',
            pickedQuantity: existingItem?.originalQuantity || (existingItem as any)?.orderedQuantity || 1,
            finalPrice,
            substitution: {
              type: subType,
              originalPlu: targetPlu,
              originalName: existingItem?.name || targetPlu,
              originalPrice,
              substitutePlu: subPlu,
              substituteName: subName,
              substitutePrice,
              chargedPrice,
              reason: payload.reason || 'Out of stock',
            },
          });
        }
        const refreshed = await FirestorePlatformService.getOrderProjection(targetOrder.orderId);
        const nextFinal = refreshed
          ? PaymentService.calculateAuthoritativeFinalAmount(refreshed)
          : 0;

        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKING_WITH_CHANGES', {
          updatedViaWebhookId: webhookEventId,
          finalAmount: nextFinal,
          upstreamReportedFinalAmount: payload.newFinalAmount,
        });
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: targetOrder.orderId,
          newState: 'PICKING_WITH_CHANGES',
        };
      }

      // 5. Quest: Item Removed (QST-02)
      if (rawStatus === 'ITEM_REMOVED' || rawStatus === 'REMOVE_IF_UNAVAILABLE') {
        const targetPlu = payload.plu || payload.item?.plu || payload.originalPlu || payload.product?.plu;
        if (targetPlu) {
          const existingItem = await FirestorePlatformService.getOrderLineItem(targetOrder.orderId, targetPlu);
          const finalPrice: Money = { amount: 0, currency: (existingItem?.originalPrice as any)?.currency || 'GBP' };

          await FirestorePlatformService.updateOrderPickingItem(targetOrder.orderId, targetPlu, {
            state: 'REMOVED',
            pickedQuantity: 0,
            finalPrice,
          });
        }
        const refreshed = await FirestorePlatformService.getOrderProjection(targetOrder.orderId);
        const nextFinal = refreshed
          ? PaymentService.calculateAuthoritativeFinalAmount(refreshed)
          : 0;

        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKING_WITH_CHANGES', {
          updatedViaWebhookId: webhookEventId,
          finalAmount: nextFinal,
          upstreamReportedFinalAmount:
            payload.newFinalAmount ?? payload.finalAmount,
        });
        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: targetOrder.orderId,
          newState: 'PICKING_WITH_CHANGES',
        };
      }

      // 6. Quest: Picking Started (QST-01)
      if (rawStatus === 'PICKING_STARTED' || rawStatus === 'PREPARING' || rawStatus === 'PICKING') {
        await FirestorePlatformService.updateOrderPickingState(targetOrder.orderId, {
          status: 'IN_PROGRESS',
          startedAt: new Date().toISOString(),
        });
        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKING', {
          updatedViaWebhookId: webhookEventId,
        });

        // Dispatch orchestration is DELIVERY ONLY. A Collection/pickup order has
        // no courier to assign; invoking Dispatch here previously created phantom
        // delivery jobs against pickup orders.
        if (targetOrder.fulfillmentType === 'delivery') {
          const dispatchAdapter = getDispatchAdapter(targetOrder.tenantId);
          DispatchOrchestrationService.handlePickingStarted(
            targetOrder.orderId,
            targetOrder.tenantId,
            dispatchAdapter,
            webhookEventId
          ).catch((err) => console.warn('[WebhookService] Dispatch picking started error:', err));
        } else {
          console.log(
            `[WebhookService] Skipping Dispatch for ${targetOrder.orderId}: fulfillmentType=${targetOrder.fulfillmentType}`
          );
        }

        // Emit notification & analytics (Phase 14)
        NotificationService.notifyPickingStarted(targetOrder).catch((err) =>
          console.error('[WebhookService] Notification error:', err)
        );
        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'PICKING_STARTED',
          storeId: targetOrder.channelLinkId,
        }).catch((err) => console.error('[WebhookService] Analytics error:', err));

        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: targetOrder.orderId,
          newState: 'PICKING',
        };
      }

      // 7. Quest: Picking Complete (QST-01)
      if (rawStatus === 'PICKING_COMPLETE' || rawStatus === 'PICKED') {
        // Mark any remaining pending items as picked
        const latestProjection = await FirestorePlatformService.getOrderProjection(targetOrder.orderId);
        if (latestProjection?.picking?.items) {
          for (const item of latestProjection.picking.items) {
            if (item.state === 'PENDING') {
              await FirestorePlatformService.updateOrderPickingItem(targetOrder.orderId, item.plu, {
                state: 'PICKED',
                pickedQuantity: item.originalQuantity || (item as any).orderedQuantity || 1,
              });
            }
          }
        }
        await FirestorePlatformService.updateOrderPickingState(targetOrder.orderId, {
          status: 'COMPLETED',
          completedAt: new Date().toISOString(),
        });

        // Dispatch orchestration is DELIVERY ONLY.
        if (targetOrder.fulfillmentType === 'delivery') {
          const dispatchAdapter = getDispatchAdapter(targetOrder.tenantId);
          DispatchOrchestrationService.handlePickingCompleted(
            targetOrder.orderId,
            targetOrder.tenantId,
            dispatchAdapter,
            webhookEventId
          ).catch((err) => console.warn('[WebhookService] Dispatch picking completed error:', err));
        }

        // Payment settlement requires an actual authorised payment to capture.
        // An unpaid Collection order (third_party, isPrepaid:false,
        // orderIsAlreadyPaid:false) has no authorisation, so enqueuing
        // settlement and setting CAPTURE_PENDING would strand it in a payment
        // state it can never leave.
        const requiresSettlement = Boolean(
          (targetOrder as any).paymentAuthorisationId ||
            (targetOrder as any).paymentAuthorizationId ||
            (targetOrder as any).dpayAuthorisationId ||
            (targetOrder as any).dpayAuthorizationId ||
            targetOrder.paymentId ||
            targetOrder.paymentState === 'AUTHORISED' ||
            targetOrder.paymentState === 'AUTHORIZED'
        );

        if (requiresSettlement) {
          AsyncWorkerService.enqueuePaymentSettlement({
            orderId: targetOrder.orderId,
            tenantId: targetOrder.tenantId,
            webhookEventId,
          });
        } else {
          console.log(
            `[WebhookService] Skipping payment settlement for ${targetOrder.orderId}: no authorised payment to capture.`
          );
        }

        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKED', {
          updatedViaWebhookId: webhookEventId,
          ...(requiresSettlement
            ? { paymentState: 'CAPTURE_PENDING' }
            : { paymentState: 'NO_CAPTURE_REQUIRED' }),
        });

        if (targetOrder.checkoutId) {
          await FirestorePlatformService.updateCheckoutStatus(targetOrder.checkoutId, 'READY' as any, {
            orderId: targetOrder.orderId,
          });
        }

        // Emit notification & analytics (Phase 14)
        NotificationService.notifyPickingComplete(targetOrder).catch((err) =>
          console.error('[WebhookService] Notification error:', err)
        );
        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'PICKING_COMPLETE',
          storeId: targetOrder.channelLinkId,
        }).catch((err) => console.error('[WebhookService] Analytics error:', err));

        await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
        return {
          success: true,
          eventId: webhookEventId,
          status: 'PROCESSED',
          orderId: targetOrder.orderId,
          newState: 'PICKED',
        };
      }

      // Map incoming status to canonical customer status. Commerce checkout
      // webhooks use open -> completed/failed; picking/order webhooks use the
      // order lifecycle states below.
      let canonicalState = rawStatus;
      if (rawStatus === 'OPEN') {
        canonicalState = 'CHECKOUT_PENDING_CONFIRMATION';
      } else if (rawStatus === 'COMPLETED') {
        canonicalState = 'ORDER_CONFIRMED';
      } else if (rawStatus === 'ACCEPTED' || rawStatus === 'STORE_ACCEPTED' || rawStatus === 'ORDER_ACCEPTED') {
        canonicalState = 'ACCEPTED';
      } else if (rawStatus === 'CONFIRMED' || rawStatus === 'ORDER_CONFIRMED') {
        canonicalState = 'ORDER_CONFIRMED';
      } else if (
        rawStatus === 'READY' ||
        rawStatus === 'READY_FOR_PICKUP' ||
        rawStatus === 'READY_FOR_COURIER' ||
        rawStatus === 'FINALIZED'
      ) {
        // Deliverect POS status 90/95 means the POS workflow is finalized; it
        // does not prove the order was delivered to the customer.
        canonicalState = 'READY';
      } else if (rawStatus === 'OUT_FOR_DELIVERY' || rawStatus === 'DISPATCHING' || rawStatus === 'COURIER_ASSIGNED') {
        canonicalState = 'OUT_FOR_DELIVERY';
      } else if (rawStatus === 'DELIVERED') {
        canonicalState = 'DELIVERED';
      } else if (rawStatus === 'CANCELLED' || rawStatus === 'ORDER_CANCELLED') {
        canonicalState = 'ORDER_CANCELLED';
      } else if (rawStatus === 'FAILED' || rawStatus === 'ORDER_FAILED') {
        canonicalState = 'ORDER_FAILED';
      }

      // If order is cancelled or failed, execute settlement cancellation workflow via AsyncWorkerService
      if (canonicalState === 'ORDER_CANCELLED' || canonicalState === 'ORDER_FAILED') {
        AsyncWorkerService.enqueueOrderCancellation({
          orderId: targetOrder.orderId,
          tenantId: targetOrder.tenantId,
          reason: payload.failureReason || payload.reason,
        });

        // Cancel active courier dispatch (delivery only)
        if (targetOrder.fulfillmentType === 'delivery') {
          const dispatchAdapter = getDispatchAdapter(targetOrder.tenantId);
          DispatchOrchestrationService.handleOrderCancelled(
            targetOrder.orderId,
            targetOrder.tenantId,
            dispatchAdapter,
            payload.failureReason || payload.reason
          ).catch((err) => console.warn('[WebhookService] Dispatch cancel error:', err));
        }

        NotificationService.notifyOrderCancelled(targetOrder, payload.failureReason || payload.reason).catch(
          (err) => console.error('[WebhookService] Notification error:', err)
        );
        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'ORDER_CANCELLED',
          storeId: targetOrder.channelLinkId,
        }).catch((err) => console.error('[WebhookService] Analytics error:', err));
      } else if (canonicalState === 'ACCEPTED' || canonicalState === 'ORDER_CONFIRMED') {
        NotificationService.notifyOrderConfirmed(targetOrder).catch((err) =>
          console.error('[WebhookService] Notification error:', err)
        );
        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'ORDER_ACCEPTED',
          storeId: targetOrder.channelLinkId,
        }).catch((err) => console.error('[WebhookService] Analytics error:', err));
      } else if (canonicalState === 'OUT_FOR_DELIVERY') {
        NotificationService.notifyOutForDelivery(targetOrder).catch((err) =>
          console.error('[WebhookService] Notification error:', err)
        );
        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'COURIER_ASSIGNED',
          storeId: targetOrder.channelLinkId,
        }).catch((err) => console.error('[WebhookService] Analytics error:', err));
      } else if (canonicalState === 'DELIVERED') {
        NotificationService.notifyOrderCompleted(targetOrder).catch((err) =>
          console.error('[WebhookService] Notification error:', err)
        );
        AnalyticsService.trackEvent(targetOrder.tenantId, {
          type: 'ORDER_DELIVERED',
          storeId: targetOrder.channelLinkId,
        }).catch((err) => console.error('[WebhookService] Analytics error:', err));
      }

      const upstreamOrderId = String(
        payload.orderId ||
        payload.order?.id ||
        payload.order?._id ||
        payload.data?.orderId ||
        ''
      ).trim() || undefined;
      const upstreamChannelOrderId = String(
        payload.channelOrderId ||
        payload.order?.channelOrderId ||
        ''
      ).trim() || undefined;
      const upstreamDisplayId = String(
        payload.channelOrderDisplayId ||
        payload.order?.channelOrderDisplayId ||
        ''
      ).trim() || undefined;

      // Update projection state and searchable correlation aliases in Firestore.
      await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, canonicalState, {
        updatedViaWebhookId: webhookEventId,
        amendments: payload.amendments,
        failureReason: payload.failureReason,
        channelOrderRawId: upstreamOrderId,
        channelOrderId: upstreamChannelOrderId,
        channelOrderDisplayId: upstreamDisplayId,
      });

      // Also update any active checkout projection. Prefer the real Deliverect order
      // id once it is known; the order projection remains resolvable through the
      // promoted channelOrderRawId alias.
      if (targetOrder.checkoutId) {
        await FirestorePlatformService.updateCheckoutStatus(
          targetOrder.checkoutId,
          canonicalState as any,
          {
            orderId: upstreamOrderId || targetOrder.orderId,
            failureReason: payload.failureReason || payload.reason,
          }
        );
      }

      console.log(`[WebhookService] Updated order ${targetOrder.orderId} from ${currentState} to ${canonicalState}`);

      await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
      return {
        success: true,
        eventId: webhookEventId,
        status: 'PROCESSED',
        orderId: targetOrder.orderId,
        newState: canonicalState,
      };
    }

    // Do not acknowledge an order-correlated event that arrived before its
    // local projection. Keep the journal entry as FAILED and release the claim
    // so Deliverect retry or an operator replay can process it later.
    if (correlationCandidates.length > 0) {
      const unmatched: any = new Error('Webhook is valid but no local order projection is available yet.');
      unmatched.statusCode = 503;
      unmatched.code = 'WEBHOOK_ORDER_NOT_FOUND_RETRYABLE';
      throw unmatched;
    }

    // Non-order events can be safely journaled without a local order projection.
    await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
    return {
      success: true,
      eventId: webhookEventId,
      status: 'PROCESSED',
      message: 'Webhook processed; no order correlation was supplied.',
    };
    } catch (err: any) {
      const errorCode = err?.code || 'WEBHOOK_PROCESSING_ERROR';
      await FirestorePlatformService.updateWebhookEventStatus(
        webhookEventId,
        'FAILED',
        errorCode
      ).catch(() => {});
      await FirestorePlatformService.releaseWebhookIdempotency(
        'deliverect',
        externalEventKey,
        webhookEventId
      ).catch(() => {});
      throw err;
    }
  }
}
