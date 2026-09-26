import {
  DispatchAdapter,
  DispatchQuoteParams,
  DispatchQuoteResult,
  CourierQuote,
  DispatchAssignParams,
  DispatchAssignmentResult,
  DispatchCancelParams,
  DispatchCancelResult,
} from './DispatchAdapter';
import { calculateDispatchTiming } from './dispatchTiming';
import { FirestorePlatformService, OrderProjection } from '../firestoreService';
import {
  DispatchState,
  DispatchStateRecord,
  DispatchTimestamps,
  CustomerOrderStatus,
} from '../../src/commerce/postCheckoutModels';
import { TenantDispatchRules, DEFAULT_DISPATCH_RULES } from '../../src/rules/types';
import { BFFError } from '../errors';

// State transition ranking for out-of-order webhook delivery protection
const STATE_PRECEDENCE: Record<DispatchState, number> = {
  NOT_REQUESTED: 0,
  QUOTED: 1,
  SCHEDULED: 2,
  ASSIGNING: 3,
  ASSIGNED: 4,
  PICKUP_EN_ROUTE: 5,
  PICKED_UP: 6,
  DELIVERED: 7,
  CANCEL_PENDING: 8,
  CANCELLED: 9,
  FAILED: 10,
};

export class DispatchOrchestrationService {
  /**
   * Retrieves quotes for a basket and delivery address according to tenant dispatch rules.
   */
  static async getQuotesForBasket(
    adapter: DispatchAdapter,
    params: DispatchQuoteParams,
    tenantRules?: TenantDispatchRules
  ): Promise<DispatchQuoteResult> {
    const rules = tenantRules || DEFAULT_DISPATCH_RULES;

    // Apply allowed providers filter & selection policy from tenant rules
    const quoteParams: DispatchQuoteParams = {
      ...params,
      policy: params.policy || rules.selectionPolicy,
      allowedProviders: params.allowedProviders || rules.allowedProviders,
    };

    const result = await adapter.getQuotes(quoteParams);
    return result;
  }

  /**
   * Evaluates and records the initial dispatch quote state at checkout.
   */
  static async handleCheckoutCreated(
    orderId: string,
    tenantId: string,
    adapter: DispatchAdapter,
    options: {
      fulfillmentType: 'delivery' | 'pickup';
      selectedQuote?: CourierQuote;
      quoteId?: string;
      providerId?: string;
      providerDisplayName?: string;
      deliveryAddress?: any;
      itemsCount: number;
      orderCreatedAt: string;
      requiresAgeCheck?: boolean;
      minimumAge?: number;
      requiresPin?: boolean;
      idempotencyKey: string;
    }
  ): Promise<DispatchStateRecord | null> {
    if (options.fulfillmentType !== 'delivery') {
      return null;
    }

    // Dispatch availability/validation is not the same thing as a courier quote.
    // Only initialise the quote lifecycle when concrete quote + provider evidence
    // is present. Deliverect /fulfillment/validate intentionally returns no such
    // identity, so a validation-only checkout remains validation-only.
    const quoteId = String(options.quoteId || options.selectedQuote?.quoteId || '').trim();
    const providerId = String(options.providerId || options.selectedQuote?.providerId || '').trim();
    const providerDisplayName = String(
      options.providerDisplayName || options.selectedQuote?.providerDisplayName || ''
    ).trim();
    if (!quoteId || !providerId || !providerDisplayName) {
      return null;
    }

    const tenantRules = await FirestorePlatformService.getTenantDispatchRules(tenantId);
    const now = new Date().toISOString();
    const timestamps: DispatchTimestamps = {
      quotedAt: now,
      updatedAt: now,
    };

    let scheduledFor: string | undefined = undefined;
    let targetPickupTime: string | undefined = undefined;
    if (tenantRules.dynamicTiming) {
      const timing = calculateDispatchTiming({
        totalItemQuantity: options.itemsCount,
        itemsPickedPerMinute: tenantRules.itemsPickedPerMinute,
        readyBufferMinutes: tenantRules.readyBufferMinutes,
        orderCreatedAt: options.orderCreatedAt,
        providerSupportsScheduled: options.selectedQuote?.supportsScheduledAssignment === true,
      });

      targetPickupTime = timing.targetReadyTime;
      if (timing.shouldSchedule) scheduledFor = timing.scheduleFor;
    }

    const initialRecord: DispatchStateRecord = {
      state: 'QUOTED',
      providerId,
      providerDisplayName,
      quoteId,
      attemptCount: 0,
      idempotencyKeys: [options.idempotencyKey],
      timestamps,
      scheduledFor,
      targetPickupTime,
      createdAt: now,
    };

    await FirestorePlatformService.updateOrderDispatchState(orderId, initialRecord);

    if (tenantRules.assignmentEvent === 'CHECKOUT_PAID') {
      return this.assignCourierForOrder(orderId, tenantId, adapter, {
        idempotencyKey: options.idempotencyKey,
        deliveryAddress: options.deliveryAddress,
        requiresAgeCheck: options.requiresAgeCheck,
        minimumAge: options.minimumAge,
        requiresPin: options.requiresPin,
      });
    }

    return initialRecord;
  }

  /**
   * Handles picking started event (e.g. from Quest or merchant store app).
   */
  static async handlePickingStarted(
    orderId: string,
    tenantId: string,
    adapter: DispatchAdapter,
    eventId?: string
  ): Promise<DispatchStateRecord | null> {
    const tenantRules = await FirestorePlatformService.getTenantDispatchRules(tenantId);
    const order = await FirestorePlatformService.getOrderProjection(orderId);

    if (!order || order.fulfillmentType !== 'delivery') {
      return null;
    }

    // Check order unaccepted timeout rule
    if (this.isOrderUnacceptedTimeout(order, tenantRules.unacceptedTimeoutMinutes)) {
      console.warn(`[Dispatch] Order ${orderId} unaccepted timeout exceeded. Skipping courier assignment.`);
      return order.dispatch || null;
    }

    if (tenantRules.assignmentEvent === 'START_PICKING') {
      const idempotencyKey = eventId || `picking_start_${orderId}_${Date.now()}`;
      return this.assignCourierForOrder(orderId, tenantId, adapter, { idempotencyKey });
    }

    return order.dispatch || null;
  }

  /**
   * Handles picking completed event (e.g. from Quest).
   * Confirms assignment state, executes scheduled assignment, or retries if failed.
   */
  static async handlePickingCompleted(
    orderId: string,
    tenantId: string,
    adapter: DispatchAdapter,
    eventId?: string
  ): Promise<DispatchStateRecord | null> {
    const tenantRules = await FirestorePlatformService.getTenantDispatchRules(tenantId);
    const order = await FirestorePlatformService.getOrderProjection(orderId);

    if (!order || order.fulfillmentType !== 'delivery' || !order.dispatch) {
      return null;
    }

    const dispatch = order.dispatch;

    // Picking has genuinely finished right now — this is real data, not the item-count
    // estimate calculateDispatchTiming made back at checkout (handleCheckoutCreated).
    // Target the courier's arrival for readyBufferMinutes after this real completion
    // moment (default 1 minute), overriding whatever stale estimate is on the record.
    const realPickCompletionTargetTime = new Date(
      Date.now() + Math.max(0, tenantRules.readyBufferMinutes) * 60_000
    ).toISOString();

    // 1. If courier assignment was SCHEDULED, now is the time to trigger final assignment
    if (dispatch.state === 'SCHEDULED') {
      const idempotencyKey = eventId || `picking_complete_scheduled_${orderId}`;
      return this.assignCourierForOrder(orderId, tenantId, adapter, {
        idempotencyKey,
        force: true,
        customTargetPickupTime: realPickCompletionTargetTime,
      });
    }

    // 2. If courier assignment previously FAILED, retry if within maxRetryAttempts
    if (dispatch.state === 'FAILED' && dispatch.attemptCount < tenantRules.maxRetryAttempts) {
      const idempotencyKey = eventId || `picking_complete_retry_${orderId}_${dispatch.attemptCount + 1}`;
      return this.assignCourierForOrder(orderId, tenantId, adapter, {
        idempotencyKey,
        force: true,
        customTargetPickupTime: realPickCompletionTargetTime,
      });
    }

    return dispatch;
  }

  /**
   * Handles order payment capture settlement (order finalised).
   */
  static async handleOrderSettled(
    orderId: string,
    tenantId: string,
    adapter: DispatchAdapter,
    settlementId?: string
  ): Promise<DispatchStateRecord | null> {
    const tenantRules = await FirestorePlatformService.getTenantDispatchRules(tenantId);
    const order = await FirestorePlatformService.getOrderProjection(orderId);

    if (!order || order.fulfillmentType !== 'delivery') {
      return null;
    }

    if (tenantRules.assignmentEvent === 'ORDER_FINALISED') {
      const idempotencyKey = settlementId || `settled_${orderId}`;
      return this.assignCourierForOrder(orderId, tenantId, adapter, { idempotencyKey });
    }

    return order.dispatch || null;
  }

  /**
   * Handles order cancellation: cancels active courier dispatch if assigned or en route.
   */
  static async handleOrderCancelled(
    orderId: string,
    tenantId: string,
    adapter: DispatchAdapter,
    reason?: string
  ): Promise<DispatchCancelResult | null> {
    const order = await FirestorePlatformService.getOrderProjection(orderId);
    if (!order || !order.dispatch) {
      return null;
    }

    const currentRecord = order.dispatch;

    // If dispatch is already in terminal state or not requested, nothing to cancel with provider
    if (['CANCELLED', 'DELIVERED', 'NOT_REQUESTED'].includes(currentRecord.state)) {
      return {
        success: true,
        deliveryJobId: currentRecord.deliveryJobId || 'none',
        status: 'CANCELLED',
      };
    }

    const now = new Date().toISOString();
    const idempotencyKey = `cancel_${orderId}_${Date.now()}`;

    // If delivery job was created with provider, call adapter cancellation
    if (currentRecord.deliveryJobId) {
      try {
        const cancelRes = await adapter.cancelDispatch({
          orderId,
          tenantId,
          deliveryJobId: currentRecord.deliveryJobId,
          reason: reason || 'Order cancelled by customer or store',
          idempotencyKey,
        });

        const updated: DispatchStateRecord = {
          ...currentRecord,
          state: cancelRes.status === 'CANCEL_PENDING' ? 'CANCEL_PENDING' : 'CANCELLED',
          idempotencyKeys: [...currentRecord.idempotencyKeys, idempotencyKey],
          timestamps: {
            ...currentRecord.timestamps,
            cancelledAt: now,
            updatedAt: now,
          },
        };

        await FirestorePlatformService.updateOrderDispatchState(orderId, updated);
        return cancelRes;
      } catch (err: any) {
        console.warn(`[Dispatch] Provider cancellation error for order ${orderId}:`, err);
        const updated: DispatchStateRecord = {
          ...currentRecord,
          state: 'CANCELLED',
          lastError: err.message || 'Upstream courier cancellation error',
          idempotencyKeys: [...currentRecord.idempotencyKeys, idempotencyKey],
          timestamps: {
            ...currentRecord.timestamps,
            cancelledAt: now,
            updatedAt: now,
          },
        };
        await FirestorePlatformService.updateOrderDispatchState(orderId, updated);
        return {
          success: false,
          deliveryJobId: currentRecord.deliveryJobId,
          status: 'CANCELLED',
          reason: err.message,
        };
      }
    } else {
      // Just mark state cancelled locally
      const updated: DispatchStateRecord = {
        ...currentRecord,
        state: 'CANCELLED',
        idempotencyKeys: [...currentRecord.idempotencyKeys, idempotencyKey],
        timestamps: {
          ...currentRecord.timestamps,
          cancelledAt: now,
          updatedAt: now,
        },
      };
      await FirestorePlatformService.updateOrderDispatchState(orderId, updated);
      return {
        success: true,
        deliveryJobId: 'none',
        status: 'CANCELLED',
      };
    }
  }

  /**
   * Authoritative courier assignment with pre-condition validation, dynamic timing, and idempotency.
   */
  static async assignCourierForOrder(
    orderId: string,
    tenantId: string,
    adapter: DispatchAdapter,
    options: {
      force?: boolean;
      idempotencyKey: string;
      customTargetPickupTime?: string;
      deliveryAddress?: any;
      requiresAgeCheck?: boolean;
      minimumAge?: number;
      requiresPin?: boolean;
    }
  ): Promise<DispatchStateRecord> {
    const order = await FirestorePlatformService.getOrderProjection(orderId);
    if (!order) {
      throw new BFFError('ORDER_NOT_FOUND', `Order ${orderId} not found`, 404, false);
    }

    if (order.fulfillmentType !== 'delivery') {
      throw new BFFError('INVALID_FULFILLMENT', `Cannot assign courier for non-delivery order`, 400, false);
    }

    const tenantRules = await FirestorePlatformService.getTenantDispatchRules(tenantId);
    const existing = order.dispatch;

    // PRECONDITION 1: Never assign when order is rejected, cancelled, or payment failed
    const terminalOrderStatuses = ['REJECTED', 'CANCELLED', 'ORDER_CANCELLED', 'FAILED'];
    if (terminalOrderStatuses.includes(order.status.toUpperCase())) {
      throw new BFFError(
        'DISPATCH_ASSIGNMENT_FORBIDDEN',
        `Cannot assign courier for order with status ${order.status}`,
        400,
        false
      );
    }

    if (order.paymentState === 'FAILED' || order.paymentState === 'DECLINED') {
      throw new BFFError(
        'DISPATCH_ASSIGNMENT_FORBIDDEN',
        `Cannot assign courier because payment pre-authorisation failed`,
        400,
        false
      );
    }

    // PRECONDITION 2: Never assign when order has remained unaccepted beyond timeout
    if (this.isOrderUnacceptedTimeout(order, tenantRules.unacceptedTimeoutMinutes)) {
      throw new BFFError(
        'ORDER_UNACCEPTED_TIMEOUT',
        `Order remained unaccepted for over ${tenantRules.unacceptedTimeoutMinutes} minutes. Courier assignment blocked.`,
        400,
        false
      );
    }

    // PRECONDITION 3: Idempotency check - if already assigned/completed with this key, return existing
    if (existing) {
      if (existing.idempotencyKeys.includes(options.idempotencyKey)) {
        return existing;
      }
      if (['ASSIGNED', 'PICKUP_EN_ROUTE', 'PICKED_UP', 'DELIVERED', 'CANCELLED'].includes(existing.state) && !options.force) {
        return existing;
      }
    }

    if (!existing?.quoteId || !existing.providerId || !existing.providerDisplayName) {
      throw new BFFError(
        'DISPATCH_QUOTE_REQUIRED',
        'Courier assignment requires a verified quote and provider identity.',
        409,
        false
      );
    }
    if (!options.deliveryAddress) {
      throw new BFFError(
        'DISPATCH_DELIVERY_ADDRESS_REQUIRED',
        'Courier assignment requires the verified delivery address; no address is inferred from the order projection.',
        409,
        false
      );
    }

    const now = new Date().toISOString();
    const currentAttempt = (existing.attemptCount || 0) + 1;

    // Transition to ASSIGNING only after all assignment evidence is present.
    const assigningRecord: DispatchStateRecord = {
      ...existing,
      state: 'ASSIGNING',
      attemptCount: currentAttempt,
      idempotencyKeys: [...(existing?.idempotencyKeys || []), options.idempotencyKey],
      timestamps: {
        ...(existing?.timestamps || { quotedAt: now }),
        updatedAt: now,
      },
    };
    await FirestorePlatformService.updateOrderDispatchState(orderId, assigningRecord);

    const quoteId = existing.quoteId;
    const providerId = existing.providerId;

    try {
      const assignParams: DispatchAssignParams = {
        orderId,
        tenantId,
        storeId: order.channelLinkId,
        quoteId,
        providerId,
        deliveryAddress: options.deliveryAddress,
        itemsCount: order.itemsCount || 1,
        orderValueMinorUnits: order.total,
        currency: order.currency,
        requiresAgeCheck: options.requiresAgeCheck,
        minimumAge: options.minimumAge,
        requiresPin: options.requiresPin,
        idempotencyKey: options.idempotencyKey,
        targetPickupTime: options.customTargetPickupTime || existing?.targetPickupTime,
      };

      const result = await adapter.assignCourier(assignParams);

      const assignedRecord: DispatchStateRecord = {
        ...assigningRecord,
        state: result.status,
        deliveryJobId: result.deliveryJobId,
        providerId: result.providerId,
        providerDisplayName: result.providerDisplayName,
        etaMinutes: result.etaMinutes,
        eta: result.estimatedDeliveryTime,
        trackingUrl: result.trackingUrl,
        proofOfDeliveryUrl: result.proofOfDeliveryUrl,
        pinRequirement: result.pinRequirement || assigningRecord.pinRequirement,
        ageVerificationRequirement: result.ageVerificationRequirement || assigningRecord.ageVerificationRequirement,
        scheduledFor: result.scheduledFor,
        targetPickupTime: result.targetPickupTime || assigningRecord.targetPickupTime,
        timestamps: {
          ...assigningRecord.timestamps,
          assignedAt: result.status === 'ASSIGNED' ? now : assigningRecord.timestamps.assignedAt,
          scheduledAt: result.status === 'SCHEDULED' ? now : assigningRecord.timestamps.scheduledAt,
          updatedAt: now,
        },
      };

      await FirestorePlatformService.updateOrderDispatchState(orderId, assignedRecord);
      return assignedRecord;
    } catch (err: any) {
      console.warn(`[Dispatch] Assignment attempt ${currentAttempt} failed for order ${orderId}:`, err);
      const failedRecord: DispatchStateRecord = {
        ...assigningRecord,
        state: 'FAILED',
        lastError: err.message || 'Courier assignment failed',
        timestamps: {
          ...assigningRecord.timestamps,
          failedAt: now,
          updatedAt: now,
        },
      };
      await FirestorePlatformService.updateOrderDispatchState(orderId, failedRecord);
      throw err;
    }
  }

  /**
   * Processes inbound dispatch status webhooks with strict idempotency and out-of-order tolerance.
   */
  static async handleDispatchWebhook(
    payload: {
      orderId: string;
      tenantId?: string;
      deliveryJobId?: string;
      status: DispatchState;
      providerId?: string;
      providerDisplayName?: string;
      trackingUrl?: string;
      proofOfDeliveryUrl?: string;
      pinVerified?: boolean;
      ageCheckResult?: 'VERIFIED' | 'FAILED';
      failureReason?: string;
      etaMinutes?: number;
      estimatedDeliveryTime?: string;
    },
    eventId: string
  ): Promise<DispatchStateRecord | null> {
    const { orderId, status } = payload;
    const order = await FirestorePlatformService.getOrderProjection(orderId);
    if (!order || !order.dispatch) {
      return null;
    }

    const current = order.dispatch;

    // Idempotency: if eventId already processed, return current record
    if (current.idempotencyKeys.includes(eventId)) {
      return current;
    }

    // Out-of-order protection:
    // If incoming status rank is strictly lower than current status rank, do not regress!
    const currentRank = STATE_PRECEDENCE[current.state] ?? 0;
    const incomingRank = STATE_PRECEDENCE[status] ?? 0;

    // Terminal state protection: DELIVERED and CANCELLED cannot regress
    if (['DELIVERED', 'CANCELLED'].includes(current.state) && status !== current.state) {
      console.warn(
        `[Dispatch] Out-of-order webhook ignored: order ${orderId} is ${current.state}, incoming: ${status}`
      );
      return current;
    }

    if (incomingRank < currentRank && !['FAILED', 'CANCELLED'].includes(status)) {
      console.warn(
        `[Dispatch] Out-of-order webhook ignored: order ${orderId} current=${current.state} (rank ${currentRank}), incoming=${status} (rank ${incomingRank})`
      );
      return current;
    }

    const now = new Date().toISOString();
    const timestamps: DispatchTimestamps = {
      ...current.timestamps,
      updatedAt: now,
    };

    if (status === 'PICKUP_EN_ROUTE') timestamps.pickupEnRouteAt = now;
    if (status === 'PICKED_UP') timestamps.pickedUpAt = now;
    if (status === 'DELIVERED') timestamps.deliveredAt = now;
    if (status === 'CANCELLED') timestamps.cancelledAt = now;
    if (status === 'FAILED') timestamps.failedAt = now;

    // Update PIN status if payload explicitly contains pin verification
    const pinRequirement = current.pinRequirement
      ? {
          ...current.pinRequirement,
          status: payload.pinVerified ? ('VERIFIED' as const) : current.pinRequirement.status,
        }
      : undefined;

    // Update Age Verification status if payload contains courier's actual physical verification
    const ageVerificationRequirement = current.ageVerificationRequirement
      ? {
          ...current.ageVerificationRequirement,
          status: payload.ageCheckResult
            ? payload.ageCheckResult
            : current.ageVerificationRequirement.status,
        }
      : undefined;

    const updated: DispatchStateRecord = {
      ...current,
      state: status,
      deliveryJobId: payload.deliveryJobId || current.deliveryJobId,
      providerId: payload.providerId || current.providerId,
      providerDisplayName: payload.providerDisplayName || current.providerDisplayName,
      trackingUrl: payload.trackingUrl || current.trackingUrl,
      proofOfDeliveryUrl: payload.proofOfDeliveryUrl || current.proofOfDeliveryUrl,
      etaMinutes: payload.etaMinutes !== undefined ? payload.etaMinutes : current.etaMinutes,
      eta: payload.estimatedDeliveryTime || current.eta,
      lastError: payload.failureReason || current.lastError,
      pinRequirement,
      ageVerificationRequirement,
      idempotencyKeys: [...current.idempotencyKeys, eventId],
      timestamps,
    };

    await FirestorePlatformService.updateOrderDispatchState(orderId, updated);
    return updated;
  }

  /**
   * Helper: checks if order has remained unaccepted by store past timeout threshold.
   */
  private static isOrderUnacceptedTimeout(order: OrderProjection, timeoutMinutes = 15): boolean {
    if (!order.createdAt) return false;
    const createdTime = new Date(order.createdAt).getTime();
    const elapsedMinutes = (Date.now() - createdTime) / (60 * 1000);

    const unacceptedStatuses = ['SUBMITTED', 'PENDING', 'CHECKOUT_SUBMITTING', 'CHECKOUT_PENDING_CONFIRMATION'];
    const isUnaccepted = unacceptedStatuses.includes(order.status.toUpperCase());

    return isUnaccepted && elapsedMinutes > timeoutMinutes;
  }
}
