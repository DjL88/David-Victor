import {
  DPayPaymentRequest,
  DPayPaymentResponse,
  PaymentGatewayProfile,
  DomainPaymentProjection,
  SettlementResult,
} from '../../src/domain/models';
import { Money } from '../../src/domain/money';
import { CommerceError, ErrorCode } from '../errors';
import { DPayAdapter } from './DPayAdapter';
import { DemoPaymentAdapter } from './DemoPaymentAdapter';
import { DeliverectDPayAdapter } from './DeliverectDPayAdapter';
import { FirestorePlatformService, OrderProjection } from '../firestoreService';
import { getServerRuntimeMode } from '../runtimeMode';
import { getDispatchAdapter } from './index';
import { DispatchOrchestrationService } from './DispatchOrchestrationService';
import { getCircuitBreaker } from '../circuitBreaker';
import { calculateSubstitutionLineEconomics } from '../../src/commerce/substitutionPricing';

const dPayAdapters = new Map<string, DPayAdapter>();

function requirePaymentTenantId(tenantId?: string): string {
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedTenantId || normalizedTenantId === 'default') {
    throw new CommerceError(
      ErrorCode.INVALID_INPUT,
      'An explicit tenantId is required for every payment operation.',
      400
    );
  }
  return normalizedTenantId;
}

export function getDPayAdapter(
  tenantId: string,
  environment: string = process.env.DELIVERECT_ENV || 'staging',
  deliverectAccountId: string = 'default'
): DPayAdapter {
  const normalizedTenantId = requirePaymentTenantId(tenantId);
  const appMode = getServerRuntimeMode();
  const key = `${normalizedTenantId}:${environment}:${deliverectAccountId}:${appMode}`;
  let adapter = dPayAdapters.get(key);
  if (!adapter) {
    if (appMode === 'demo') {
      adapter = new DemoPaymentAdapter();
    } else {
      // Credential and environment resolution is asynchronous and tenant/profile
      // scoped inside DeliverectDPayAdapter. Do not decide availability from
      // process-local env credentials here: dedicated tenant secrets may live
      // exclusively in Secret Manager.
      adapter = new DeliverectDPayAdapter(normalizedTenantId, environment);
    }
    dPayAdapters.set(key, adapter);
    console.log(`[Deliverect Pay] Active DPay Adapter for [${key}]: ${adapter.adapterName}`);
  }
  return adapter;
}

export function setDPayAdapter(
  adapter: DPayAdapter,
  tenantId?: string,
  environment: string = process.env.DELIVERECT_ENV || 'staging',
  deliverectAccountId: string = 'default'
): void {
  const normalizedTenantId = requirePaymentTenantId(tenantId || (getServerRuntimeMode() === 'demo' || process.env.NODE_ENV === 'test' ? 'brand-alpha' : undefined));
  const appMode = getServerRuntimeMode();
  const key = `${normalizedTenantId}:${environment}:${deliverectAccountId}:${appMode}`;
  dPayAdapters.set(key, adapter);
}

export function resetDPayAdapter(): void {
  dPayAdapters.clear();
}

export interface CeilingCalculationOptions {
  approvedSubstituteUplift?: Money;
  approvedCatchWeightTolerance?: Money;
  explicitAgreedCharges?: Money[];
  // Disallowed arbitrary buffer fields for defensive check
  arbitraryBufferPercentage?: number;
  safetyBufferPercentage?: number;
}

export class PaymentService {
  private static async assertPaymentTenant(paymentId: string, tenantId: string): Promise<void> {
    const projection = await FirestorePlatformService.getPaymentProjection(paymentId);
    if (projection && projection.tenantId !== tenantId) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        'Payment does not belong to the resolved tenant.',
        404
      );
    }
  }

  private static assertOrderTenant(order: OrderProjection, tenantId: string): void {
    if (order.tenantId && order.tenantId !== tenantId) {
      throw new CommerceError(
        ErrorCode.ORDER_NOT_FOUND,
        'Order not found for the resolved tenant.',
        404
      );
    }
  }

  /**
   * Section 20: Explicit Customer-Approved Authorization Ceiling.
   *
   * ABSOLUTELY DO NOT implement arbitrary percentage buffers (e.g., 10% or 15%).
   * Authorized ceiling must derive strictly and exclusively from customer consent:
   *   reconciledBasketTotal
   *   + explicitly customer-approved substitute uplift
   *   + explicitly customer-approved catch-weight tolerance where applicable
   *   + other explicitly agreed potential charges
   */
  static calculateApprovedAuthorizationCeiling(
    reconciledBasketTotal: Money,
    options: CeilingCalculationOptions = {}
  ): Money {
    if (
      options.arbitraryBufferPercentage !== undefined ||
      options.safetyBufferPercentage !== undefined
    ) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        'Arbitrary safety buffers or percentage markups (e.g. 10% or 15%) are strictly prohibited by platform policy. Every authorized amount must be traceable to explicit customer consent.',
        422
      );
    }

    if (!Number.isInteger(reconciledBasketTotal.amount) || reconciledBasketTotal.amount < 0) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        `Reconciled basket total must be a non-negative integer minor unit (received: ${reconciledBasketTotal.amount})`,
        422
      );
    }

    const currency = reconciledBasketTotal.currency;
    let ceilingMinor = reconciledBasketTotal.amount;

    if (options.approvedSubstituteUplift) {
      if (options.approvedSubstituteUplift.currency !== currency) {
        throw new CommerceError(
          ErrorCode.INVALID_INPUT,
          `Currency mismatch for substitute uplift: expected ${currency}, received ${options.approvedSubstituteUplift.currency}`,
          422
        );
      }
      if (!Number.isInteger(options.approvedSubstituteUplift.amount) || options.approvedSubstituteUplift.amount < 0) {
        throw new CommerceError(
          ErrorCode.INVALID_INPUT,
          'Substitute uplift must be a non-negative integer minor unit',
          422
        );
      }
      ceilingMinor += options.approvedSubstituteUplift.amount;
    }

    if (options.approvedCatchWeightTolerance) {
      if (options.approvedCatchWeightTolerance.currency !== currency) {
        throw new CommerceError(
          ErrorCode.INVALID_INPUT,
          `Currency mismatch for catch-weight tolerance: expected ${currency}, received ${options.approvedCatchWeightTolerance.currency}`,
          422
        );
      }
      if (!Number.isInteger(options.approvedCatchWeightTolerance.amount) || options.approvedCatchWeightTolerance.amount < 0) {
        throw new CommerceError(
          ErrorCode.INVALID_INPUT,
          'Catch-weight tolerance must be a non-negative integer minor unit',
          422
        );
      }
      ceilingMinor += options.approvedCatchWeightTolerance.amount;
    }

    if (options.explicitAgreedCharges && options.explicitAgreedCharges.length > 0) {
      for (const charge of options.explicitAgreedCharges) {
        if (charge.currency !== currency) {
          throw new CommerceError(
            ErrorCode.INVALID_INPUT,
            `Currency mismatch for agreed charge: expected ${currency}, received ${charge.currency}`,
            422
          );
        }
        if (!Number.isInteger(charge.amount) || charge.amount < 0) {
          throw new CommerceError(
            ErrorCode.INVALID_INPUT,
            'Agreed charge must be a non-negative integer minor unit',
            422
          );
        }
        ceilingMinor += charge.amount;
      }
    }

    return {
      amount: ceilingMinor,
      currency,
    };
  }

  /**
   * Retrieves payment gateways for a store/channel link (PAY-01).
   */
  static async getPaymentGateways(channelLinkId: string, tenantId: string): Promise<PaymentGatewayProfile[]> {
    const resolvedTenant = requirePaymentTenantId(tenantId);
    const adapter = getDPayAdapter(resolvedTenant);
    return getCircuitBreaker(resolvedTenant, 'dpay').execute(() =>
      adapter.getPaymentGateways(channelLinkId)
    );
  }

  /**
   * Requests payment authorization (PAY-02, PAY-04, PAY-06).
   * Verifies minor units, tokenized mode, and checks against customerApprovedMaxAmount.
   */
  static async requestPayment(
    request: DPayPaymentRequest,
    tenantId: string
  ): Promise<DPayPaymentResponse> {
    const resolvedTenant = requirePaymentTenantId(tenantId);
    // Check for raw PAN/CVC leaks
    const payloadStr = JSON.stringify(request);
    if (payloadStr.includes('pan') || payloadStr.includes('cvc') || payloadStr.includes('cvv')) {
      if (/\b(?:\d[ -]*?){13,16}\b/.test(payloadStr)) {
        throw new CommerceError(
          ErrorCode.INVALID_INPUT,
          'Raw PAN/CVC detected in request payload. Raw card information must never be sent to our BFF.',
          400
        );
      }
    }

    // Ensure tokenized mode
    if (!request.mode || request.mode.type !== 'token' || !request.mode.tokenId) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        'Deliverect Pay requires tokenized payment credentials. Raw cards must be tokenized directly via the payment proxy.',
        422
      );
    }

    // Minor units verification
    if (!Number.isInteger(request.amount) || request.amount <= 0) {
      throw new CommerceError(
        ErrorCode.INVALID_INPUT,
        `Payment amount must be an integer minor unit (e.g. 1550 for £15.50), received: ${request.amount}`,
        422
      );
    }

    // Ceiling check (PAY-06)
    if (request.customerApprovedMaxAmount) {
      if (request.customerApprovedMaxAmount.currency !== request.currency) {
        throw new CommerceError(
          ErrorCode.INVALID_INPUT,
          `Payment currency (${request.currency}) does not match authorized ceiling currency (${request.customerApprovedMaxAmount.currency})`,
          422
        );
      }
      if (request.amount > request.customerApprovedMaxAmount.amount) {
        throw new CommerceError(
          ErrorCode.PAYMENT_NOT_AUTHORISED,
          `Payment request amount of ${request.amount} exceeds customer-approved maximum authorized ceiling of ${request.customerApprovedMaxAmount.amount}`,
          422
        );
      }
    }

    const adapter = getDPayAdapter(resolvedTenant);
    const response = await getCircuitBreaker(resolvedTenant, 'dpay').execute(() =>
      adapter.requestPayment(request)
    );

    // Save payment projection
    const projection: DomainPaymentProjection = {
      paymentId: response.paymentId,
      tenantId: resolvedTenant,
      channelLinkId: request.channelLinkId,
      status: response.status,
      amount: { amount: response.amount, currency: response.currency },
      authorizedAmount: { amount: response.authorizedAmount, currency: response.currency },
      customerApprovedMaxAmount: {
        amount: request.customerApprovedMaxAmount?.amount ?? request.amount,
        currency: request.customerApprovedMaxAmount?.currency ?? request.currency,
      },
      capturedAmount: { amount: response.capturedAmount, currency: response.currency },
      captureMode: response.captureMode,
      currency: response.currency,
      residualHoldAmount: response.residualHoldAmount !== undefined
        ? { amount: response.residualHoldAmount, currency: response.currency }
        : undefined,
      orderReference: response.orderReference,
      basketId: request.basketId,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt || response.createdAt,
    };

    await FirestorePlatformService.savePaymentProjection(projection);
    return response;
  }

  /**
   * Retrieves payment status and projection.
   */
  static async getPayment(paymentId: string, tenantId: string): Promise<DPayPaymentResponse> {
    const resolvedTenant = requirePaymentTenantId(tenantId);
    await this.assertPaymentTenant(paymentId, resolvedTenant);
    const adapter = getDPayAdapter(resolvedTenant);
    return getCircuitBreaker(resolvedTenant, 'dpay').execute(() =>
      adapter.getPayment(paymentId)
    );
  }

  /**
   * Captures an authorized payment (PAY-07, PAY-08).
   */
  static async capture(paymentId: string, finalAmountMinor: number, tenantId: string): Promise<DPayPaymentResponse> {
    const resolvedTenant = requirePaymentTenantId(tenantId);
    await this.assertPaymentTenant(paymentId, resolvedTenant);
    const adapter = getDPayAdapter(resolvedTenant);
    const response = await getCircuitBreaker(resolvedTenant, 'dpay').execute(() =>
      adapter.capture(paymentId, finalAmountMinor)
    );

    await FirestorePlatformService.updatePaymentProjection(paymentId, {
      status: response.status,
      capturedAmount: { amount: response.capturedAmount, currency: response.currency },
      residualHoldAmount: response.residualHoldAmount !== undefined
        ? { amount: response.residualHoldAmount, currency: response.currency }
        : undefined,
      updatedAt: new Date().toISOString(),
    });

    return response;
  }

  /**
   * Releases an uncaptured authorization. Provider confirmation is mandatory
   * before the local projection is marked canceled.
   */
  static async voidAuthorization(
    paymentId: string,
    reason?: string,
    tenantId?: string
  ): Promise<DPayPaymentResponse> {
    const resolvedTenant = requirePaymentTenantId(tenantId);
    await this.assertPaymentTenant(paymentId, resolvedTenant);
    const adapter = getDPayAdapter(resolvedTenant);
    const response = await getCircuitBreaker(resolvedTenant, 'dpay').execute(() =>
      adapter.voidAuthorization(paymentId, reason)
    );

    await FirestorePlatformService.updatePaymentProjection(paymentId, {
      status: response.status,
      authorizedAmount: { amount: response.authorizedAmount, currency: response.currency },
      capturedAmount: { amount: response.capturedAmount, currency: response.currency },
      residualHoldAmount: { amount: response.residualHoldAmount ?? 0, currency: response.currency },
      updatedAt: response.updatedAt || new Date().toISOString(),
    });

    return response;
  }

  /**
   * Refunds a captured payment.
   */
  static async refund(
    paymentId: string,
    refundAmountMinor: number,
    reason?: string,
    tenantId?: string
  ): Promise<DPayPaymentResponse> {
    const resolvedTenant = requirePaymentTenantId(tenantId);
    await this.assertPaymentTenant(paymentId, resolvedTenant);
    const adapter = getDPayAdapter(resolvedTenant);
    const response = await getCircuitBreaker(resolvedTenant, 'dpay').execute(() =>
      adapter.refund(paymentId, refundAmountMinor, reason)
    );

    await FirestorePlatformService.updatePaymentProjection(paymentId, {
      status: response.status,
      updatedAt: new Date().toISOString(),
    });

    return response;
  }

  /**
   * Reauthorizes or performs additional auth if picked amount exceeds ceiling (PAY-08).
   */
  static async reauthorize(
    paymentId: string,
    additionalAmountMinor: number,
    tenantId: string
  ): Promise<DPayPaymentResponse> {
    const resolvedTenant = requirePaymentTenantId(tenantId);
    await this.assertPaymentTenant(paymentId, resolvedTenant);
    const projection = await FirestorePlatformService.getPaymentProjection(paymentId);
    if (!projection?.customerApprovedMaxAmount) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        'Reauthorization is blocked because no customer-approved maximum is persisted for this payment.',
        422
      );
    }
    const currentAuthorized = projection.authorizedAmount.amount;
    const requestedAuthorized = currentAuthorized + additionalAmountMinor;
    if (
      projection.customerApprovedMaxAmount.currency !== projection.authorizedAmount.currency ||
      requestedAuthorized > projection.customerApprovedMaxAmount.amount
    ) {
      throw new CommerceError(
        ErrorCode.PAYMENT_NOT_AUTHORISED,
        'Reauthorization would exceed the persisted customer-approved authorization ceiling.',
        422
      );
    }
    const adapter = getDPayAdapter(resolvedTenant);
    const response = await getCircuitBreaker(resolvedTenant, 'dpay').execute(() =>
      adapter.reauthorize(paymentId, additionalAmountMinor)
    );

    await FirestorePlatformService.updatePaymentProjection(paymentId, {
      authorizedAmount: { amount: response.authorizedAmount, currency: response.currency },
      amount: { amount: response.amount, currency: response.currency },
      updatedAt: new Date().toISOString(),
    });

    return response;
  }

  /**
   * Derives authoritative final order amount from picked items, amended quantities,
   * customer substitutions, and non-item order charges (PAY-05, PAY-07, PAY-08).
   * Enforces non-negative integer minor units.
   */
  static calculateAuthoritativeFinalAmount(order: OrderProjection): number {
    // If picking items exist, derive the exact payable subtotal from the frozen
    // checkout price model and the actual Quest result.
    if (order.picking?.items && order.picking.items.length > 0) {
      let itemsSubtotal = 0;

      const getItemPrice = (priceVal: any): number | undefined => {
        if (typeof priceVal === 'number' && Number.isFinite(priceVal)) {
          return Math.round(priceVal);
        }
        if (
          priceVal &&
          typeof priceVal.amount === 'number' &&
          Number.isFinite(priceVal.amount)
        ) {
          return Math.round(priceVal.amount);
        }
        return undefined;
      };

      for (const item of order.picking.items) {
        const itemState = (
          item.state ||
          (item as any).status ||
          'PENDING'
        ).toUpperCase();

        if (itemState === 'REMOVED' || itemState === 'OUT_OF_STOCK') {
          continue;
        }

        if (itemState === 'SUBSTITUTED') {
          const persistedLineTotal = item.substitution?.economics?.customerChargeLineTotal;
          if (persistedLineTotal) {
            if (!Number.isInteger(persistedLineTotal.amount) || persistedLineTotal.amount < 0) {
              throw new CommerceError(
                ErrorCode.INVALID_INPUT,
                `Invalid persisted substitution line total for ${item.plu}`,
                422
              );
            }
            itemsSubtotal += persistedLineTotal.amount;
            continue;
          }

          // Legacy/imported substituted lines are reconciled to the same safe
          // line-total rule rather than falling back to per-unit protection.
          const originalQty = Math.max(1, Math.trunc(item.originalQuantity || 1));
          const replacementQty = Math.max(
            1,
            Math.trunc(
              item.substitution?.replacementQuantity ??
              item.pickedQuantity ??
              1
            )
          );
          const originalRaw = (item as any).price ?? item.originalPrice;
          const replacementRaw =
            item.substitution?.substitutePrice ??
            item.finalPrice ??
            item.originalPrice;
          const originalAmount =
            typeof originalRaw === 'number' ? Math.round(originalRaw) : Math.round(originalRaw?.amount ?? 0);
          const replacementAmount =
            typeof replacementRaw === 'number' ? Math.round(replacementRaw) : Math.round(replacementRaw?.amount ?? 0);
          const currency =
            (typeof originalRaw === 'object' && originalRaw?.currency) ||
            (typeof replacementRaw === 'object' && replacementRaw?.currency) ||
            'GBP';
          const economics = calculateSubstitutionLineEconomics({
            originalQuantity: originalQty,
            originalUnitPrice: { amount: originalAmount, currency },
            replacementQuantity: replacementQty,
            replacementUnitPrice: { amount: replacementAmount, currency },
            protectedOriginalUnitPrices: item.bundlePricing?.protectedUnitPrices || [],
          });
          itemsSubtotal += economics.customerChargeLineTotal.amount;
          continue;
        }

        const qty =
          item.pickedQuantity !== undefined
            ? item.pickedQuantity
            : (item.originalQuantity ?? 1);
        if (qty <= 0) continue;

        const originalUnitPrice =
          getItemPrice((item as any).price) ??
          getItemPrice(item.originalPrice) ??
          0;
        const finalUnitPrice = getItemPrice(item.finalPrice);
        const substituteUnitPrice =
          getItemPrice((item as any).substitutedBy?.price) ??
          getItemPrice(item.substitution?.substitutePrice);
        const chargedSubstitutePrice = getItemPrice(
          item.substitution?.chargedPrice
        );

        let effectiveUnitPrice: number;

        if (itemState === 'SUBSTITUTED') {
          if (item.substitution?.type === 'CUSTOMER_SELECTED') {
            // Customer-selected alternatives may exceed the protected/original
            // item price, but never exceed the price the customer explicitly
            // approved for that replacement.
            const observedSubstitutePrice =
              chargedSubstitutePrice ??
              finalUnitPrice ??
              substituteUnitPrice ??
              originalUnitPrice;
            const approvedPrice = getItemPrice(item.preferredSubstitutePrice);

            effectiveUnitPrice =
              approvedPrice !== undefined
                ? Math.min(observedSubstitutePrice, approvedPrice)
                : observedSubstitutePrice;
          } else if (item.substitution?.type === 'BEST_MATCH') {
            // Best Match can never increase the customer's price. Enforce the
            // lower-of guarantee again at settlement even if an upstream event
            // supplied a different chargedPrice.
            const policyCap =
              substituteUnitPrice !== undefined
                ? Math.min(originalUnitPrice, substituteUnitPrice)
                : originalUnitPrice;
            const observedSubstitutePrice =
              chargedSubstitutePrice ??
              finalUnitPrice ??
              substituteUnitPrice ??
              originalUnitPrice;

            effectiveUnitPrice = Math.min(
              observedSubstitutePrice,
              policyCap
            );
          } else {
            // Legacy/imported order projections can mark a line SUBSTITUTED
            // without recording the substitution policy. In that case preserve
            // the authoritative final price rather than inventing Best Match.
            effectiveUnitPrice =
              chargedSubstitutePrice ??
              finalUnitPrice ??
              substituteUnitPrice ??
              originalUnitPrice;
          }
        } else {
          effectiveUnitPrice =
            finalUnitPrice !== undefined
              ? finalUnitPrice
              : originalUnitPrice;
        }

        effectiveUnitPrice = Math.max(0, Math.round(effectiveUnitPrice));

        const protectedBundlePrices = (
          item.bundlePricing?.protectedUnitPrices || []
        )
          .map((price) => getItemPrice(price))
          .filter((price): price is number => price !== undefined)
          .sort((a, b) => a - b);

        const protectedQty = Math.min(qty, protectedBundlePrices.length);
        const standaloneQty = Math.max(0, qty - protectedQty);

        if (protectedQty > 0) {
          if (
            itemState === 'SUBSTITUTED' &&
            item.substitution?.type === 'CUSTOMER_SELECTED'
          ) {
            // Explicitly approved replacement: the replacement price is allowed
            // to exceed the bundle allocation, up to the approved amount.
            itemsSubtotal += effectiveUnitPrice * protectedQty;
          } else {
            // Normal pick, quantity amendment, or Best Match: the frozen bundle
            // allocation is a price ceiling. If the supplied item becomes cheaper,
            // the customer receives the lower price.
            for (let i = 0; i < protectedQty; i++) {
              itemsSubtotal += Math.min(
                protectedBundlePrices[i],
                effectiveUnitPrice
              );
            }
          }
        }

        // Any units beyond the protected bundle pool are ordinary standalone
        // units and retain the normal item/substitution pricing policy.
        itemsSubtotal += effectiveUnitPrice * standaloneQty;
      }

      // Calculate non-item fees/charges from metadata if available. Bundle
      // discounts are NOT subtracted here because they have already been
      // converted into protected component unit prices at checkout.
      let nonItemCharges = 0;
      if (order.metadata?.charges && typeof order.metadata.charges === 'object') {
        for (const charge of Object.values(order.metadata.charges)) {
          if (typeof charge === 'number') {
            nonItemCharges += Math.round(charge);
          } else if (charge && typeof (charge as any).amount === 'number') {
            nonItemCharges += Math.round((charge as any).amount);
          }
        }
      }

      const calculated = itemsSubtotal + nonItemCharges;
      // Legitimate zero-value must remain 0; never fall back to order.total when
      // picking items were processed.
      return Math.max(0, Math.round(calculated));
    }

    // If order already has an explicitly calculated finalAmount without picking items array
    if (typeof order.finalAmount === 'number' && order.finalAmount >= 0) {
      return Math.round(order.finalAmount);
    }

    // Fallback to order.total only when there genuinely is no picking or final amount data
    return Math.max(0, Math.round(order.total || 0));
  }
  /**
   * Final Payment Settlement Reconciliation (Phase 13, PAY-07, PAY-08).
   * 
   * Traced lifecycle from Quest PICKING_COMPLETE:
   * 1. Derives authoritative final order amount.
   * 2. If final <= authorized: captures exact final amount and releases residual hold.
   * 3. If final > authorized: triggers reauthorization if requested, or flags PAYMENT_ACTION_REQUIRED.
   * 4. Updates order and payment projections in Firestore and writes structured audit record.
   */
  static async settleOrderPayment(
    orderId: string,
    tenantId: string,
    options?: { reauthorizeIfNeeded?: boolean; actor?: any }
  ): Promise<SettlementResult> {
    const order = await FirestorePlatformService.getOrderProjection(orderId);
    if (!order) {
      throw new CommerceError(ErrorCode.ORDER_NOT_FOUND, `Order '${orderId}' not found for payment settlement`, 404);
    }
    const resolvedTenant = requirePaymentTenantId(tenantId);
    this.assertOrderTenant(order, resolvedTenant);

    // Resolve payment ID
    let paymentId = order.paymentId;
    if (!paymentId && order.checkoutId) {
      const checkout = await FirestorePlatformService.getCheckoutProjection(order.checkoutId);
      paymentId = checkout?.paymentId;
    }

    if (!paymentId) {
      console.warn(`[PaymentService] Order '${orderId}' does not have an associated paymentId. Cannot execute DPay capture.`);
      const finalAmount = this.calculateAuthoritativeFinalAmount(order);

      // Check if order was placed with an explicit offline payment method
      const isOfflinePayment =
        order.metadata?.paymentMethod === 'CASH_ON_COLLECTION' ||
        (order as any).paymentMethod === 'CASH_ON_COLLECTION';

      if (isOfflinePayment) {
        return {
          status: 'SETTLED',
          orderId,
          paymentId: 'offline',
          finalAmount,
          authorizedAmount: 0,
          capturedAmount: 0,
          residualHoldReleased: 0,
          settledAt: new Date().toISOString(),
        };
      }

      // Online DPay order with missing payment ID -> settlement failure / operational alert
      return {
        status: 'PAYMENT_ACTION_REQUIRED',
        orderId,
        paymentId: 'unattached',
        finalAmount,
        authorizedAmount: order.authorizedMaximum || order.total || 0,
        capturedAmount: 0,
        residualHoldReleased: 0,
        settledAt: new Date().toISOString(),
      };
    }

    // Resolve authorized amount from payment projection or order
    const payment = (await FirestorePlatformService.getPaymentProjection(paymentId)) ||
      (await PaymentService.getPayment(paymentId, resolvedTenant).catch(() => null));

    const authorizedAmount = payment?.authorizedAmount?.amount ??
      (payment?.authorizedAmount as any) ??
      order.authorizedMaximum ??
      order.total;

    const finalAmount = this.calculateAuthoritativeFinalAmount(order);

    // CASE 1: finalAmount <= authorizedAmount (PAY-07)
    if (finalAmount <= authorizedAmount) {
      try {
        await PaymentService.capture(paymentId, finalAmount, resolvedTenant);
        const residualHold = Math.max(0, authorizedAmount - finalAmount);

        const settlementResult: SettlementResult = {
          status: 'SETTLED',
          orderId,
          paymentId,
          finalAmount,
          authorizedAmount,
          capturedAmount: finalAmount,
          residualHoldReleased: residualHold,
          settledAt: new Date().toISOString(),
        };

        // Update OrderProjection with captured state and residual hold
        await FirestorePlatformService.updateOrderProjectionState(orderId, order.status, {
          paymentState: 'CAPTURED',
          finalAmount,
          capturedAmount: finalAmount,
          residualHoldReleased: residualHold,
          settlementDetails: settlementResult,
        });

        // Audit Log
        await FirestorePlatformService.addAuditLog(tenantId, {
          userId: options?.actor?.uid || 'system:dpay-settlement',
          userName: options?.actor?.email || 'System Payment Settlement',
          userRole: 'platformSuperAdmin',
          tenantId,
          action: 'PAYMENT_SETTLED',
          category: 'Payment',
          details: `Successfully settled payment ${paymentId} for order ${orderId}. Captured £${(finalAmount / 100).toFixed(2)}, released residual hold of £${(residualHold / 100).toFixed(2)}.`,
        });

        // Trigger dispatch courier assignment if rule is set to ORDER_FINALISED
        const dispatchAdapter = getDispatchAdapter(tenantId);
        DispatchOrchestrationService.handleOrderSettled(orderId, tenantId, dispatchAdapter, paymentId).catch(
          (dErr) => console.warn('[PaymentService] Dispatch finalisation warning:', dErr)
        );

        return settlementResult;
      } catch (err: any) {
        console.error(`[PaymentService] Capture failed for payment ${paymentId} on order ${orderId}:`, err);
        const failureResult: SettlementResult = {
          status: 'CAPTURE_FAILED',
          orderId,
          paymentId,
          finalAmount,
          authorizedAmount,
          error: err.message,
          settledAt: new Date().toISOString(),
        };

        await FirestorePlatformService.updateOrderProjectionState(orderId, order.status, {
          paymentState: 'CAPTURE_FAILED',
          finalAmount,
          settlementDetails: failureResult,
        });

        await FirestorePlatformService.addAuditLog(tenantId, {
          userId: options?.actor?.uid || 'system:dpay-settlement',
          userName: options?.actor?.email || 'System Payment Settlement',
          userRole: 'platformSuperAdmin',
          tenantId,
          action: 'PAYMENT_CAPTURE_FAILED',
          category: 'Payment',
          details: `Payment capture failed for payment ${paymentId} on order ${orderId}: ${err.message}`,
        });

        return failureResult;
      }
    }

    // CASE 2: finalAmount > authorizedAmount (PAY-08)
    const excessAmount = finalAmount - authorizedAmount;
    const customerApprovedMaximum =
      payment?.customerApprovedMaxAmount?.amount ??
      order.authorizedMaximum ??
      authorizedAmount;

    if (finalAmount > customerApprovedMaximum) {
      // Never allow a worker/admin boolean to manufacture customer consent.
      // The existing authorization remains untouched until a new independently
      // evidenced customer ceiling is persisted.
      options = { ...options, reauthorizeIfNeeded: false };
    }

    if (options?.reauthorizeIfNeeded) {
      try {
        console.log(`[PaymentService] Reauthorizing payment ${paymentId} by ${excessAmount} minor units...`);
        await PaymentService.reauthorize(paymentId, excessAmount, resolvedTenant);
        
        // Reauthorization succeeded: now capture finalAmount
        await PaymentService.capture(paymentId, finalAmount, resolvedTenant);
        const settlementResult: SettlementResult = {
          status: 'SETTLED',
          orderId,
          paymentId,
          finalAmount,
          authorizedAmount: finalAmount,
          capturedAmount: finalAmount,
          residualHoldReleased: 0,
          settledAt: new Date().toISOString(),
        };

        await FirestorePlatformService.updateOrderProjectionState(orderId, order.status, {
          paymentState: 'CAPTURED',
          finalAmount,
          capturedAmount: finalAmount,
          residualHoldReleased: 0,
          settlementDetails: settlementResult,
        });

        await FirestorePlatformService.addAuditLog(tenantId, {
          userId: options?.actor?.uid || 'system:dpay-settlement',
          userName: options?.actor?.email || 'System Payment Settlement',
          userRole: 'platformSuperAdmin',
          tenantId,
          action: 'PAYMENT_REAUTHORIZED_AND_SETTLED',
          category: 'Payment',
          details: `Successfully reauthorized additional £${(excessAmount / 100).toFixed(2)} and captured £${(finalAmount / 100).toFixed(2)} for order ${orderId}.`,
        });

        return settlementResult;
      } catch (err: any) {
        console.warn(`[PaymentService] Reauthorization failed for payment ${paymentId}:`, err.message);
      }
    }

    // Reauthorization not performed or failed: DO NOT capture over ceiling!
    const reasonText = `Final picked amount (£${(finalAmount / 100).toFixed(2)}) exceeds customer-approved authorization ceiling (£${(authorizedAmount / 100).toFixed(2)}) by £${(excessAmount / 100).toFixed(2)}. Customer reauthorization or merchant approval required.`;
    const actionRequiredResult: SettlementResult = {
      status: 'PAYMENT_ACTION_REQUIRED',
      orderId,
      paymentId,
      finalAmount,
      authorizedAmount,
      capturedAmount: 0,
      excessAmount,
      requiresReauthorization: true,
      reason: reasonText,
      errorMessage: reasonText,
      settledAt: new Date().toISOString(),
    };

    await FirestorePlatformService.updateOrderProjectionState(orderId, order.status, {
      paymentState: 'PAYMENT_ACTION_REQUIRED',
      finalAmount,
      settlementDetails: actionRequiredResult,
    });

    await FirestorePlatformService.addAuditLog(tenantId, {
      userId: options?.actor?.uid || 'system:dpay-settlement',
      userName: options?.actor?.email || 'System Payment Settlement',
      userRole: 'platformSuperAdmin',
      tenantId,
      action: 'SETTLEMENT_REAUTHORIZATION_REQUIRED',
      category: 'Payment',
      details: `Order ${orderId} final amount (£${(finalAmount / 100).toFixed(2)}) exceeds authorized ceiling (£${(authorizedAmount / 100).toFixed(2)}). Reauthorization required before capture.`,
    });

    return actionRequiredResult;
  }

  /**
   * Handles payment lifecycle when an order is cancelled or failed.
   * If authorized but not captured: releases pre-authorization hold.
   * If already captured: issues full refund.
   */
  static async handleOrderCancellation(
    orderId: string,
    tenantId: string,
    reason?: string,
    actor?: any
  ): Promise<SettlementResult> {
    const order = await FirestorePlatformService.getOrderProjection(orderId);
    if (!order) {
      throw new CommerceError(ErrorCode.ORDER_NOT_FOUND, `Order '${orderId}' not found`, 404);
    }
    const resolvedTenant = requirePaymentTenantId(tenantId);
    this.assertOrderTenant(order, resolvedTenant);

    let paymentId = order.paymentId;
    if (!paymentId && order.checkoutId) {
      const checkout = await FirestorePlatformService.getCheckoutProjection(order.checkoutId);
      paymentId = checkout?.paymentId;
    }

    if (!paymentId) {
      return {
        status: 'VOIDED',
        orderId,
        paymentId: 'none',
        finalAmount: 0,
        authorizedAmount: 0,
        settledAt: new Date().toISOString(),
      };
    }

    const payment = (await FirestorePlatformService.getPaymentProjection(paymentId)) ||
      (await PaymentService.getPayment(paymentId, resolvedTenant).catch(() => null));

    const isCaptured = payment?.status === 'captured' || order.paymentState === 'CAPTURED';

    if (isCaptured) {
      // Already captured: refund
      const refundAmount = payment?.capturedAmount?.amount ?? order.capturedAmount ?? order.finalAmount ?? order.total;
      await PaymentService.refund(paymentId, refundAmount, reason || 'Order cancelled', resolvedTenant);

      const refundResult: SettlementResult = {
        status: 'REFUNDED',
        orderId,
        paymentId,
        finalAmount: 0,
        authorizedAmount: payment?.authorizedAmount?.amount ?? 0,
        capturedAmount: refundAmount,
        reason: reason || 'Order cancelled after capture. Full refund issued.',
        settledAt: new Date().toISOString(),
      };

      await FirestorePlatformService.updateOrderProjectionState(orderId, 'ORDER_CANCELLED', {
        paymentState: 'REFUNDED',
        settlementDetails: refundResult,
      });

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: actor?.uid || 'system:order-cancellation',
        userName: actor?.email || 'System Order Cancellation',
        userRole: 'platformSuperAdmin',
        tenantId,
        action: 'PAYMENT_REFUNDED',
        category: 'Payment',
        details: `Order ${orderId} cancelled. Refund of £${(refundAmount / 100).toFixed(2)} issued on payment ${paymentId}.`,
      });

      return refundResult;
    } else {
      // Authorized only: the provider must confirm the release before any local
      // payment/order state is mutated. The live adapter deliberately returns
      // 501 until Deliverect confirms the partner-specific void contract.
      const providerRelease = await PaymentService.voidAuthorization(
        paymentId,
        reason || 'Order cancelled before capture',
        resolvedTenant
      );
      const authorizedAmount =
        providerRelease.authorizedAmount ??
        payment?.authorizedAmount?.amount ??
        order.authorizedMaximum ??
        order.total;

      const voidResult: SettlementResult = {
        status: 'VOIDED',
        orderId,
        paymentId,
        finalAmount: 0,
        authorizedAmount,
        residualHoldReleased: authorizedAmount,
        reason: reason || 'Order cancelled before capture. Pre-authorization hold released.',
        settledAt: new Date().toISOString(),
      };

      await FirestorePlatformService.updateOrderProjectionState(orderId, 'ORDER_CANCELLED', {
        paymentState: 'VOIDED',
        settlementDetails: voidResult,
      });

      await FirestorePlatformService.addAuditLog(tenantId, {
        userId: actor?.uid || 'system:order-cancellation',
        userName: actor?.email || 'System Order Cancellation',
        userRole: 'platformSuperAdmin',
        tenantId,
        action: 'PAYMENT_AUTHORIZATION_RELEASED',
        category: 'Payment',
        details: `Order ${orderId} cancelled. Pre-authorization hold of £${(authorizedAmount / 100).toFixed(2)} on payment ${paymentId} released.`,
      });

      return voidResult;
    }
  }
}
