import { describe, expect, it } from 'vitest';
import { evaluateRiskSignals } from '../rules/RiskEngine';
import type { RiskSignal } from '../rules/types';

describe('RiskEngine', () => {
  it('allows a subject with no adverse signals', () => {
    expect(evaluateRiskSignals('t', 'hash', [], 'a', 'now').decision).toBe('ALLOW');
  });

  it('uses multiple signals to escalate intervention without inferring intent', () => {
    const signals: RiskSignal[] = [
      { code: 'ORDER_VELOCITY', severity: 'MEDIUM' },
      { code: 'ADDRESS_ACCOUNT_VELOCITY', severity: 'MEDIUM' },
    ];
    const result = evaluateRiskSignals('t', 'privacy-minimised-ref', signals, 'a', 'now');
    expect(result.decision).toBe('LIMIT');
    expect(result.reasonCodes).toEqual(['ORDER_VELOCITY', 'ADDRESS_ACCOUNT_VELOCITY']);
    expect(result.subjectReference).toBe('privacy-minimised-ref');
  });

  it('routes severe combinations to human review/temporary hold', () => {
    const signals: RiskSignal[] = [
      { code: 'REFUND_CLAIM_VELOCITY', severity: 'HIGH' },
      { code: 'WHOLE_ORDER_CLAIM_RATE', severity: 'HIGH' },
    ];
    const result = evaluateRiskSignals('t', 'hash', signals, 'a', 'now');
    expect(result.decision).toBe('TEMPORARY_HOLD');
    expect(result.requiresHumanReview).toBe(true);
  });
});
