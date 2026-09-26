import { describe, it, expect, beforeEach } from 'vitest';
import { PilotValidationRunner } from '../../server/pilot/PilotValidationRunner';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Phase 16: deterministic pilot certification', () => {
  beforeEach(() => {
    process.env.APP_MODE = 'demo';
    setServerRuntimeMode('demo');
  });

  it('certifies current quantity-changing substitution and persisted order truth without claiming runtime proof', async () => {
    const runner = new PilotValidationRunner('brand-alpha', 'demo');
    const report = await runner.executeHappyPathPilot();

    expect(report.allStepsPassed).toBe(true);
    expect(report.steps).toHaveLength(10);
    expect(report.tenantId).toBe('brand-alpha');
    expect(report.evidenceScope).toBe('DETERMINISTIC_DEMO');
    expect(report.runtimeVerified).toBe(false);

    expect(report.steps[0].step).toContain('Tenant Resolution');
    expect(report.steps[1].step).toContain('Demo Store Fixture');
    expect(report.steps[1].data?.evidenceSource).toBe('DEMO_FIXTURE');

    expect(report.steps[2].step).toContain('Authorization Ceiling');
    expect(report.authorizedAmount).toEqual({ amount: 240, currency: 'GBP' });
    expect(report.steps[2].data?.candidateReplacementQuantity).toBe(2);

    expect(report.steps[3].step).toContain('Dispatch Boundary');
    expect(report.steps[3].data).toMatchObject({
      dispatchMode: 'NOT_APPLICABLE_COLLECTION',
      liveAvailabilityValidation: 'SUPPORTED_CONTRACT_ONLY',
      liveAssignment: 'UNSUPPORTED',
      liveCancellation: 'UNSUPPORTED',
      runtimeVerified: false,
    });

    expect(report.steps[4].data?.status).toBe('CHECKOUT_PENDING_CONFIRMATION');

    expect(report.steps[5].step).toContain('Store Acceptance');
    expect(report.steps[5].data?.preparing).toBe(false);

    expect(report.steps[6].step).toContain('Quantity-Changing Protected Substitution');
    expect(report.steps[6].data?.replacementQuantity).toBe(2);
    expect(report.steps[6].data?.originalEffectiveLineTotal).toEqual({ amount: 220, currency: 'GBP' });
    expect(report.steps[6].data?.replacementRetailLineTotal).toEqual({ amount: 260, currency: 'GBP' });
    expect(report.steps[6].data?.customerChargeLineTotal).toEqual({ amount: 220, currency: 'GBP' });

    expect(report.steps[7].data?.authoritativeFinalAmount).toBe(220);
    expect(report.steps[8].step).toContain('Settlement Amount Contract');
    expect(report.steps[8].data?.expectedCaptureAmount).toEqual({ amount: 220, currency: 'GBP' });
    expect(report.steps[8].data?.expectedResidualHoldRelease).toEqual({ amount: 20, currency: 'GBP' });
    expect(report.steps[8].data?.providerRuntimeVerified).toBe(false);
    expect(report.capturedAmount).toBeUndefined();
    expect(report.residualHoldReleased).toBeUndefined();

    expect(report.steps[9].step).toContain('Persisted Projection Truth');
    expect(report.steps[9].data).toMatchObject({
      orderStatus: 'PICKED',
      paymentState: 'AUTHORIZED',
      runtimeVerified: false,
    });
    expect(report.steps[9].data?.capturedAmount).toBeUndefined();
  });

  it('fails closed when asked to represent staging runtime evidence', async () => {
    const runner = new PilotValidationRunner('brand-alpha', 'staging');
    const report = await runner.executeHappyPathPilot();

    expect(report.allStepsPassed).toBe(false);
    expect(report.runtimeVerified).toBe(false);
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0].step).toContain('Scope Guard');
    expect(report.steps[0].error).toContain('separate runtime proof');
  });

  it('retains deterministic safety checks only when authoritative suites replace the old synthetic expectations', async () => {
    const runner = new PilotValidationRunner('brand-alpha', 'demo');
    const scenarios = await runner.executeFailureScenarios();

    expect(scenarios).toContain('PAY-CEILING: Reject Arbitrary Percentage Buffer');
    expect(scenarios).toContain('SUB-PRICE: Protect Original Line Total Across Quantity Change');
  });
});
