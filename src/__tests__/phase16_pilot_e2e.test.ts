import { describe, it, expect, beforeEach } from 'vitest';
import { PilotValidationRunner } from '../../server/pilot/PilotValidationRunner';
import { MetricsService } from '../../server/metricsService';
import { circuitBreakers } from '../../server/circuitBreaker';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Phase 16: Simulated demo pilot (not live certification)', () => {
  beforeEach(() => {
    process.env.APP_MODE = 'demo';
    setServerRuntimeMode('demo');
    MetricsService.reset();
  });

  it('rejects simulated evidence in a live environment', async () => {
    await expect(new PilotValidationRunner('brand-alpha', 'staging').executeHappyPathPilot()).rejects.toThrow('cannot certify');
    setServerRuntimeMode('staging');
    await expect(new PilotValidationRunner('brand-alpha', 'demo').executeHappyPathPilot()).rejects.toThrow('cannot certify');
    await expect(new PilotValidationRunner('brand-alpha', 'demo').executeFailureScenarios()).rejects.toThrow('demo mode');
  });

  it('successfully executes the end-to-end happy path pilot flow across all 10 milestones', async () => {
    const runner = new PilotValidationRunner('brand-alpha', 'demo');
    const report = await runner.executeHappyPathPilot();

    const failedStep = report.steps.find((s) => !s.success);
    expect(failedStep).toBeUndefined();
    expect(report.allStepsPassed).toBe(true);
    expect(report.steps.length).toBe(10);
    expect(report.tenantId).toBe('brand-alpha');

    // Step 1: Tenant Resolution
    expect(report.steps[0].step).toContain('Tenant Resolution');
    expect(report.steps[0].success).toBe(true);

    // Step 2: Store Discovery
    expect(report.steps[1].step).toContain('Store Discovery');
    expect(report.steps[1].data?.channelLinkId).toBe('chl-covent-garden');

    // Step 3: Basket Ingestion
    expect(report.steps[2].step).toContain('Authoritative Basket');
    expect(report.steps[2].data?.unitPrice).toEqual({ amount: 220, currency: 'GBP' });

    // Step 4: Dispatch Serviceability
    expect(report.steps[3].step).toContain('Dispatch Serviceability');
    expect(report.steps[3].data?.deliveryServiceable).toBe(true);

    // Step 5: Payment Authorization with Customer-Approved Ceiling
    expect(report.steps[4].step).toContain('Payment Authorization');
    expect(report.authorizedAmount).toEqual({ amount: 240, currency: 'GBP' });

    // Step 6: Async Checkout Submission
    expect(report.steps[5].step).toContain('Async Checkout');
    expect(report.steps[5].data?.initialStatus).toBe('CHECKOUT_PENDING_CONFIRMATION');

    // Step 7: Upstream Acceptance Webhook
    expect(report.steps[6].step).toContain('Store Acceptance');

    // Step 8: Quest Picking Amendment & Best Match Substitution
    expect(report.steps[7].step).toContain('Quest Picking Amendment');
    expect(report.steps[7].data?.substitutionType).toBe('BEST_MATCH');
    expect(report.steps[7].data?.billedPrice).toContain('guaranteed lower');

    // Step 9: Final Payment Settlement & Residual Hold Release
    expect(report.steps[8].step).toContain('Final Payment Settlement');
    expect(report.capturedAmount).toEqual({ amount: 220, currency: 'GBP' });
    expect(report.residualHoldReleased).toEqual({ amount: 20, currency: 'GBP' });

    // Step 10: Observability Audit
    expect(report.steps[9].step).toContain('Observability & Telemetry');
    expect(report.steps[9].data?.circuitBreakersHealthy).toBe(true);
  });

  it('proves defense against failure scenarios (tampered webhooks, excess amounts, duplicates)', async () => {
    const runner = new PilotValidationRunner('brand-alpha', 'demo');
    const scenarios = await runner.executeFailureScenarios();

    expect(scenarios).toContain('WH-01: Reject Tampered Webhook HMAC');
    expect(scenarios).toContain('PAY-08: Block Final Amount Exceeding Customer-Approved Ceiling');
    expect(scenarios).toContain('WH-02: Idempotent Webhook Deduplication');
  });
});
