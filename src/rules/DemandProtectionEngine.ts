import type { DemandProtectionPolicy, DemandProtectionStage, DemandSignalMetric } from './types';

export interface DemandSignalSnapshot {
  metric: DemandSignalMetric;
  observedValue: number;
  baselineValue: number;
  sampleCount: number;
  observedAt: string;
}

export interface DemandProtectionDecision {
  triggered: boolean;
  stage?: DemandProtectionStage;
  stageIndex?: number;
  reasonCodes: string[];
  expiresAt?: string;
}

/** Pure evaluator: it never mutates stock, availability or catalogue state. */
export function evaluateDemandProtection(
  policy: DemandProtectionPolicy,
  signal: DemandSignalSnapshot
): DemandProtectionDecision {
  if (!policy.enabled || signal.metric !== policy.metric) return { triggered: false, reasonCodes: [] };

  let selected: { stage: DemandProtectionStage; index: number } | undefined;
  policy.stages.forEach((stage, index) => {
    const t = stage.threshold;
    if (signal.sampleCount < t.minimumSamples) return;
    const baselineTriggered = signal.baselineValue > 0 && signal.observedValue >= signal.baselineValue * t.baselineMultiplier;
    const absoluteTriggered = t.absoluteThreshold !== undefined && signal.observedValue >= t.absoluteThreshold;
    if (baselineTriggered || absoluteTriggered) selected = { stage, index };
  });

  if (!selected) return { triggered: false, reasonCodes: [] };
  const expiresAt = new Date(new Date(signal.observedAt).getTime() + policy.protectionTtlMinutes * 60_000).toISOString();
  return {
    triggered: true,
    stage: selected.stage,
    stageIndex: selected.index,
    reasonCodes: ['DEMAND_THRESHOLD_EXCEEDED', `STAGE_${selected.index + 1}`],
    expiresAt,
  };
}
