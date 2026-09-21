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

export class WebhookService {
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

    if (process.env.DELIVERECT_WEBHOOK_SECRET) {
      return process.env.DELIVERECT_WEBHOOK_SECRET;
    }

    if (isDemoMode() || process.env.NODE_ENV === 'test') {
      return 'demo_deliverect_webhook_secret_key_123';
    }

    return '';
  }

  /**
   * Section 24 & Item 16:
   * Resolves the webhook tenant authoritatively. Never trusts blind query or header parameters.
   * Tests HMAC verification across configured tenant secrets.
   */
  static async resolveTenantForWebhook(
    rawBody: Buffer | string,
    signatureHeader?: string,
    candidateTenantId?: string
  ): Promise<{ tenantId: string; secret: string }> {
    if (!signatureHeader) {
      const err: any = new Error('Missing webhook signature header');
      err.statusCode = 401;
      err.code = 'WEBHOOK_SIGNATURE_MISSING';
      throw err;
    }

    // In demo or test mode, check candidate or default secret
    if (isDemoMode() || process.env.NODE_ENV === 'test') {
      const tId = candidateTenantId || 'brand-alpha';
      const secret = this.getWebhookSecret(tId);
      if (this.verifyDeliverectHmac(rawBody, signatureHeader, secret)) {
        return { tenantId: tId, secret };
      }
    }

    // In staging / production:
    // 1. If candidateTenantId was provided, test its secret first
    if (candidateTenantId) {
      const secret = (await TenantSecretResolver.resolveTenantSecret(candidateTenantId, 'DELIVERECT_WEBHOOK_SECRET')) || this.getWebhookSecret(candidateTenantId);
      if (secret && this.verifyDeliverectHmac(rawBody, signatureHeader, secret)) {
        return { tenantId: candidateTenantId, secret };
      }
    }

    // 2. Query known tenants from Firestore to find the matching secret
    const db = getFirestoreDb();
    if (db) {
      try {
        const tenantsSnap = await db.collection('tenants').get();
        for (const doc of tenantsSnap.docs) {
          const tId = doc.id;
          if (tId === candidateTenantId) continue;
          const secret = (await TenantSecretResolver.resolveTenantSecret(tId, 'DELIVERECT_WEBHOOK_SECRET')) || this.getWebhookSecret(tId);
          if (secret && this.verifyDeliverectHmac(rawBody, signatureHeader, secret)) {
            return { tenantId: tId, secret };
          }
        }
      } catch (e) {
        console.warn('[WebhookService] Failed scanning tenant webhook secrets:', e);
      }
    }

    // 3. Fallback to global DELIVERECT_WEBHOOK_SECRET if configured
    if (process.env.DELIVERECT_WEBHOOK_SECRET) {
      if (this.verifyDeliverectHmac(rawBody, signatureHeader, process.env.DELIVERECT_WEBHOOK_SECRET)) {
        return { tenantId: candidateTenantId || 'brand-alpha', secret: process.env.DELIVERECT_WEBHOOK_SECRET };
      }
    }

    const err: any = new Error('Invalid webhook HMAC signature: No matching tenant found');
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
    const { tenantId: resolvedTenantId } = await this.resolveTenantForWebhook(
      rawBody,
      signatureHeader,
      tenantId
    );
    tenantId = resolvedTenantId;

    // 2. Identify external event key
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const contentHash = crypto.createHash('sha256').update(rawBuffer).digest('hex');
    const externalEventKey =
      (headers['x-deliverect-event-id'] as string) ||
      payload.eventId ||
      payload.id ||
      payload._id ||
      contentHash;

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

    const rawStatus = (
      explicitStatus ||
      payload.event ||
      payload.eventType ||
      payload.type ||
      payload.action ||
      ''
    ).toUpperCase();

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
          const origPriceAmount = typeof origPriceRaw === 'number' ? origPriceRaw : origPriceRaw.amount;
          const unitPrice = originalQuantity > 0 ? origPriceAmount / originalQuantity : origPriceAmount;
          const finalAmount =
            payload.amendedPrice !== undefined
              ? typeof payload.amendedPrice === 'number'
                ? payload.amendedPrice
                : payload.amendedPrice.amount
              : Math.round(unitPrice * suppliedQuantity);
          const finalPrice = typeof existingItem?.originalPrice === 'number'
            ? finalAmount
            : { amount: finalAmount, currency: (origPriceRaw as any).currency || 'GBP' };

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
        const nextFinal = payload.newFinalAmount ?? payload.finalAmount ?? (refreshed?.finalAmount !== undefined ? refreshed.finalAmount : refreshed?.total);

        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKING_WITH_CHANGES', {
          updatedViaWebhookId: webhookEventId,
          finalAmount: nextFinal,
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
          const subPriceRaw = payload.substitutePrice ?? payload.substitute?.price;
          const subPriceAmount =
            typeof subPriceRaw === 'object' && subPriceRaw !== null
              ? subPriceRaw.amount
              : Number(subPriceRaw || 0);

          const origPriceRaw = existingItem?.originalPrice;
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
          const chargedPriceAmount =
            payload.chargedPrice !== undefined
              ? typeof payload.chargedPrice === 'object'
                ? payload.chargedPrice.amount
                : Number(payload.chargedPrice)
              : subType === 'BEST_MATCH'
                ? Math.min(origPriceAmount, subPriceAmount)
                : subPriceAmount;

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
        const nextFinal = payload.newFinalAmount ?? (refreshed?.finalAmount !== undefined ? refreshed.finalAmount : refreshed?.total);

        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKING_WITH_CHANGES', {
          updatedViaWebhookId: webhookEventId,
          finalAmount: nextFinal,
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
        const nextFinal = payload.newFinalAmount ?? payload.finalAmount ?? (refreshed?.finalAmount !== undefined ? refreshed.finalAmount : refreshed?.total);

        await FirestorePlatformService.updateOrderProjectionState(targetOrder.orderId, 'PICKING_WITH_CHANGES', {
          updatedViaWebhookId: webhookEventId,
          finalAmount: nextFinal,
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
      } else if (rawStatus === 'READY' || rawStatus === 'READY_FOR_PICKUP' || rawStatus === 'READY_FOR_COURIER') {
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

    // If order was not found in projections, still mark event processed to avoid infinite retries
    await FirestorePlatformService.updateWebhookEventStatus(webhookEventId, 'PROCESSED');
    return {
      success: true,
      eventId: webhookEventId,
      status: 'PROCESSED',
      message: 'Webhook processed; no local order projection was matched.',
    };
  }
}
