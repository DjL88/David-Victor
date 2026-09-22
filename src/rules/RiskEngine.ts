import type { RiskAssessment, RiskDecision, RiskSignal } from './types';

export interface RiskThresholds {
  stepUpAt: number;
  limitAt: number;
  reviewAt: number;
  holdAt: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  stepUpAt: 20,
  limitAt: 40,
  reviewAt: 60,
  holdAt: 85,
};

const severityWeight: Record<RiskSignal['severity'], number> = { LOW: 10, MEDIUM: 25, HIGH: 45 };

export function evaluateRiskSignals(
  tenantId: string,
  subjectReference: string,
  signals: RiskSignal[],
  assessmentId: string,
  createdAt: string,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS
): RiskAssessment {
  const score = Math.min(100, signals.reduce((sum, signal) => sum + severityWeight[signal.severity], 0));
  let decision: RiskDecision = 'ALLOW';
  if (score >= thresholds.holdAt) decision = 'TEMPORARY_HOLD';
  else if (score >= thresholds.reviewAt) decision = 'MANUAL_REVIEW';
  else if (score >= thresholds.limitAt) decision = 'LIMIT';
  else if (score >= thresholds.stepUpAt) decision = 'STEP_UP';

  return {
    assessmentId,
    tenantId,
    subjectReference,
    signals,
    decision,
    reasonCodes: signals.map(signal => signal.code),
    createdAt,
    requiresHumanReview: decision === 'MANUAL_REVIEW' || decision === 'TEMPORARY_HOLD',
  };
}
