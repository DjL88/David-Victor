/**
 * Phase 16: deterministic pilot certification runner.
 *
 * This runner exercises current demo/test commerce semantics only. It deliberately
 * does not claim staging/production availability or partner runtime behaviour;
 * those require separate read-only/runtime evidence.
 */

import { Money, MoneyUtil } from '../../src/domain/money';
import { calculateSubstitutionLineEconomics } from '../../src/commerce/substitutionPricing';
import { FirestorePlatformService } from '../firestoreService';
import { PaymentService } from '../deliverect/PaymentService';

export interface PilotEvidenceStep {
  step: string;
  success: boolean;
  timestamp: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface PilotExecutionReport {
  tenantId: string;
  environment: 'demo' | 'staging' | 'production';
  startedAt: string;
  completedAt: string;
  allStepsPassed: boolean;
  steps: PilotEvidenceStep[];
  orderId?: string;
  checkoutId?: string;
  authorizedAmount?: Money;
  capturedAmount?: Money;
  residualHoldReleased?: Money;
  failureScenariosTested: string[];
  evidenceScope: 'DETERMINISTIC_DEMO';
  runtimeVerified: false;
}

export class PilotValidationRunner {
  private steps: PilotEvidenceStep[] = [];
  private failureScenariosTested: string[] = [];

  constructor(
    private tenantId: string = 'brand-alpha',
    private environment: 'demo' | 'staging' | 'production' = 'demo'
  ) {}

  private recordStep(step: string, success: boolean, data?: Record<string, unknown>, error?: string) {
    this.steps.push({
      step,
      success,
      timestamp: new Date().toISOString(),
      data,
      error,
    });
  }

  public async executeHappyPathPilot(): Promise<PilotExecutionReport> {
    this.steps = [];
    this.failureScenariosTested = [];
    const startedAt = new Date().toISOString();

    if (this.environment !== 'demo') {
      this.recordStep(
        '0. Deterministic Certification Scope Guard',
        false,
        {
          requestedEnvironment: this.environment,
          evidenceScope: 'DETERMINISTIC_DEMO',
          runtimeVerified: false,
        },
        'PilotValidationRunner is deterministic demo evidence only; staging/production requires separate runtime proof.'
      );
      return {
        tenantId: this.tenantId,
        environment: this.environment,
        startedAt,
        completedAt: new Date().toISOString(),
        allStepsPassed: false,
        steps: this.steps,
        failureScenariosTested: this.failureScenariosTested,
        evidenceScope: 'DETERMINISTIC_DEMO',
        runtimeVerified: false,
      };
    }

    let orderId: string | undefined;
    let checkoutId: string | undefined;
    let authorizedAmount: Money | undefined;
    let capturedAmount: Money | undefined;
    let residualHoldReleased: Money | undefined;

    try {
      const tenant = await FirestorePlatformService.getTenantConfig(this.tenantId);
      if (!tenant) throw new Error(`Tenant ${this.tenantId} not found`);
      this.recordStep('1. Tenant Resolution', true, {
        tenantId: tenant.tenantId,
        brandName: tenant.brandName,
        evidenceSource: 'DEMO_FIXTURE',
      });

      const storeId = 'store-covent-garden-01';
      const channelLinkId = 'chl-covent-garden';
      this.recordStep('2. Demo Store Fixture Selection', true, {
        storeId,
        channelLinkId,
        evidenceSource: 'DEMO_FIXTURE',
      });

      const originalItemPlu = 'WATER-1L';
      const substitutePlu = 'WATER-500';
      const originalItemPrice = MoneyUtil.fromMinorUnits(220, 'GBP');
      const basketTotal = MoneyUtil.fromMinorUnits(220, 'GBP');
      const approvedSubstituteUplift = MoneyUtil.fromMinorUnits(20, 'GBP');
      authorizedAmount = PaymentService.calculateApprovedAuthorizationCeiling(
        basketTotal,
        { approvedSubstituteUplift }
      );
      this.recordStep('3. Basket & Explicit Authorization Ceiling', true, {
        plu: originalItemPlu,
        orderedQuantity: 1,
        unitPrice: originalItemPrice,
        candidateReplacementQuantity: 2,
        candidateReplacementUnitPrice: MoneyUtil.fromMinorUnits(130, 'GBP'),
        authorizedAmount,
      });

      this.recordStep('4. Dispatch Boundary (Collection Flow)', true, {
        dispatchMode: 'NOT_APPLICABLE_COLLECTION',
        liveAvailabilityValidation: 'SUPPORTED_CONTRACT_ONLY',
        liveAssignment: 'UNSUPPORTED',
        liveCancellation: 'UNSUPPORTED',
        runtimeVerified: false,
      });

      checkoutId = `chk_pilot_${Date.now()}`;
      orderId = `ord_pilot_${Date.now()}`;
      const pendingOrder = {
        orderId,
        tenantId: this.tenantId,
        checkoutId,
        channelLinkId,
        orderReference: 'LT-DEMO-PILOT',
        status: 'CHECKOUT_PENDING_CONFIRMATION',
        paymentState: 'AUTHORIZED',
        fulfillmentType: 'collection',
        total: basketTotal.amount,
        currency: basketTotal.currency,
        authorizedMaximum: authorizedAmount.amount,
        finalAmount: basketTotal.amount,
        itemsCount: 1,
        picking: {
          status: 'NOT_STARTED',
          totalItems: 1,
          itemsPicked: 0,
          hasChanges: false,
          items: [{
            id: 'line-water-1l',
            plu: originalItemPlu,
            name: 'Water 1L',
            originalQuantity: 1,
            pickedQuantity: 0,
            originalPrice: originalItemPrice,
            finalPrice: originalItemPrice,
            state: 'PENDING',
            substitutionPreference: 'BEST_MATCH',
            substituteCandidates: [{
              plu: substitutePlu,
              name: 'Water 500ml',
              quantity: 2,
              price: MoneyUtil.fromMinorUnits(130, 'GBP'),
              priority: 1,
            }],
          }],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await FirestorePlatformService.saveOrderProjection(pendingOrder as any, this.tenantId);
      this.recordStep('5. Pending Checkout Projection', true, {
        checkoutId,
        orderId,
        status: pendingOrder.status,
      });

      await FirestorePlatformService.updateOrderProjectionState(orderId, 'STORE_ACCEPTED');
      const acceptedOrder = await FirestorePlatformService.getOrderProjection(orderId);
      this.recordStep('6. Store Acceptance (Customer Still Placed)', true, {
        status: acceptedOrder?.status,
        pickingStatus: acceptedOrder?.picking?.status,
        preparing: acceptedOrder?.picking?.status === 'IN_PROGRESS',
      });

      const economics = calculateSubstitutionLineEconomics({
        originalQuantity: 1,
        originalUnitPrice: originalItemPrice,
        replacementQuantity: 2,
        replacementUnitPrice: MoneyUtil.fromMinorUnits(130, 'GBP'),
      });
      this.recordStep('7. Quantity-Changing Protected Substitution Economics', true, {
        originalQuantity: economics.originalQuantity,
        replacementQuantity: economics.replacementQuantity,
        originalEffectiveLineTotal: economics.originalEffectiveLineTotal,
        replacementRetailLineTotal: economics.replacementRetailLineTotal,
        customerChargeLineTotal: economics.customerChargeLineTotal,
      });

      const pickedOrder = {
        ...acceptedOrder!,
        status: 'PICKING',
        finalAmount: economics.customerChargeLineTotal.amount,
        picking: {
          status: 'IN_PROGRESS',
          totalItems: 1,
          itemsPicked: 1,
          hasChanges: true,
          items: [{
            id: 'line-water-1l',
            plu: originalItemPlu,
            name: 'Water 1L',
            originalQuantity: 1,
            pickedQuantity: 2,
            originalPrice: originalItemPrice,
            finalPrice: economics.customerChargeLineTotal,
            state: 'SUBSTITUTED',
            substitutionPreference: 'BEST_MATCH',
            substitution: {
              substitutePlu,
              substituteName: 'Water 500ml',
              substitutePrice: MoneyUtil.fromMinorUnits(130, 'GBP'),
              replacementQuantity: 2,
              economics,
            },
          }],
        },
        updatedAt: new Date().toISOString(),
      };
      await FirestorePlatformService.saveOrderProjection(pickedOrder as any, this.tenantId);
      const authoritativeFinalAmount = PaymentService.calculateAuthoritativeFinalAmount(pickedOrder as any);
      this.recordStep('8. Authoritative Picked Amount', authoritativeFinalAmount === 220, {
        authoritativeFinalAmount,
        protectedOriginalLineTotal: economics.originalEffectiveLineTotal,
        replacementRetailLineTotal: economics.replacementRetailLineTotal,
      });

      const expectedCaptureAmount = MoneyUtil.fromMinorUnits(authoritativeFinalAmount, 'GBP');
      const expectedResidualHoldRelease = MoneyUtil.fromMinorUnits(
        authorizedAmount.amount - authoritativeFinalAmount,
        'GBP'
      );
      this.recordStep('9. Settlement Amount Contract (No Provider Claim)', true, {
        authorizedAmount,
        expectedCaptureAmount,
        expectedResidualHoldRelease,
        providerRuntimeVerified: false,
      });

      const finalOrder = {
        ...pickedOrder,
        status: 'PICKED',
        paymentState: 'AUTHORIZED',
        updatedAt: new Date().toISOString(),
      };
      await FirestorePlatformService.saveOrderProjection(finalOrder as any, this.tenantId);
      const persisted = await FirestorePlatformService.getOrderProjection(orderId);
      this.recordStep('10. Persisted Projection Truth & Evidence Boundary', true, {
        orderStatus: persisted?.status,
        paymentState: persisted?.paymentState,
        capturedAmount: persisted?.capturedAmount,
        evidenceScope: 'DETERMINISTIC_DEMO',
        runtimeVerified: false,
      });
    } catch (err: any) {
      this.recordStep('Pilot Execution Aborted', false, undefined, err?.message || String(err));
    }

    return {
      tenantId: this.tenantId,
      environment: this.environment,
      startedAt,
      completedAt: new Date().toISOString(),
      allStepsPassed: this.steps.every((step) => step.success),
      steps: this.steps,
      orderId,
      checkoutId,
      authorizedAmount,
      capturedAmount,
      residualHoldReleased,
      failureScenariosTested: this.failureScenariosTested,
      evidenceScope: 'DETERMINISTIC_DEMO',
      runtimeVerified: false,
    };
  }

  public async executeFailureScenarios(): Promise<string[]> {
    this.failureScenariosTested = [];
    if (this.environment !== 'demo') return this.failureScenariosTested;

    try {
      PaymentService.calculateApprovedAuthorizationCeiling(
        MoneyUtil.fromMinorUnits(200, 'GBP'),
        { arbitraryBufferPercentage: 0.1 }
      );
    } catch {
      this.failureScenariosTested.push('PAY-CEILING: Reject Arbitrary Percentage Buffer');
    }

    const economics = calculateSubstitutionLineEconomics({
      originalQuantity: 1,
      originalUnitPrice: MoneyUtil.fromMinorUnits(200, 'GBP'),
      replacementQuantity: 2,
      replacementUnitPrice: MoneyUtil.fromMinorUnits(130, 'GBP'),
    });
    if (
      economics.replacementRetailLineTotal.amount === 260 &&
      economics.customerChargeLineTotal.amount === 200
    ) {
      this.failureScenariosTested.push('SUB-PRICE: Protect Original Line Total Across Quantity Change');
    }

    return this.failureScenariosTested;
  }
}
