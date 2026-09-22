import { describe, expect, it } from 'vitest';
import { evaluateDemandProtection } from '../rules/DemandProtectionEngine';
import type { DemandProtectionPolicy } from '../rules/types';

const policy: DemandProtectionPolicy = {
  id: 'ice-spike',
  name: 'Ice cube demand protection',
  enabled: true,
  metric: 'PRODUCT_UNIT_RATE',
  productPlu: 'ICE',
  baselineMinutes: 1440,
  protectionTtlMinutes: 30,
  stages: [
    { threshold: { windowMinutes: 15, minimumSamples: 10, baselineMultiplier: 2 }, actions: [{ type: 'MAX_QUANTITY_PER_ORDER', maximum: 2 }] },
    { threshold: { windowMinutes: 15, minimumSamples: 20, baselineMultiplier: 4 }, actions: [{ type: 'MAX_QUANTITY_PER_ORDER', maximum: 1 }] },
    { threshold: { windowMinutes: 15, minimumSamples: 30, baselineMultiplier: 8, absoluteThreshold: 100 }, actions: [{ type: 'PAUSE_PRODUCT' }] },
  ],
};

describe('DemandProtectionEngine', () => {
  it('does nothing below minimum samples', () => {
    expect(evaluateDemandProtection(policy, { metric: 'PRODUCT_UNIT_RATE', observedValue: 50, baselineValue: 5, sampleCount: 5, observedAt: '2026-09-22T12:00:00.000Z' }).triggered).toBe(false);
  });

  it('selects the highest triggered stage', () => {
    const result = evaluateDemandProtection(policy, { metric: 'PRODUCT_UNIT_RATE', observedValue: 25, baselineValue: 5, sampleCount: 25, observedAt: '2026-09-22T12:00:00.000Z' });
    expect(result.stageIndex).toBe(1);
    expect(result.stage?.actions).toEqual([{ type: 'MAX_QUANTITY_PER_ORDER', maximum: 1 }]);
    expect(result.expiresAt).toBe('2026-09-22T12:30:00.000Z');
  });

  it('supports an absolute emergency threshold', () => {
    const result = evaluateDemandProtection(policy, { metric: 'PRODUCT_UNIT_RATE', observedValue: 101, baselineValue: 100, sampleCount: 35, observedAt: '2026-09-22T12:00:00.000Z' });
    expect(result.stageIndex).toBe(2);
    expect(result.stage?.actions[0]).toEqual({ type: 'PAUSE_PRODUCT' });
  });

  it('does not apply a policy to the wrong signal metric', () => {
    expect(evaluateDemandProtection(policy, { metric: 'ORDER_RATE', observedValue: 1000, baselineValue: 1, sampleCount: 1000, observedAt: '2026-09-22T12:00:00.000Z' }).triggered).toBe(false);
  });

  it('never needs or fabricates stock quantity', () => {
    const signal = { metric: 'PRODUCT_UNIT_RATE' as const, observedValue: 12, baselineValue: 5, sampleCount: 12, observedAt: '2026-09-22T12:00:00.000Z' };
    const result = evaluateDemandProtection(policy, signal);
    expect(result.triggered).toBe(true);
    expect(JSON.stringify(result)).not.toContain('stockQuantity');
  });
});
