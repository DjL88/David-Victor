export type DestructiveDeltaDecision = 'ALLOW' | 'REVIEW_REQUIRED';

export interface DestructiveDeltaPolicy {
  enabled: boolean;
  maxRemovedCount?: number;
  maxRemovedPercent?: number;
  maxChangedCount?: number;
  maxChangedPercent?: number;
}

export interface DestructiveDeltaSummary {
  previousCount: number;
  proposedCount: number;
  addedCount: number;
  changedCount: number;
  removedCount: number;
  removedPercent: number;
  changedPercent: number;
  sampleAdded: string[];
  sampleChanged: string[];
  sampleRemoved: string[];
}

export interface DestructiveDeltaAssessment {
  decision: DestructiveDeltaDecision;
  summary: DestructiveDeltaSummary;
  reasons: string[];
}

const percent = (part: number, whole: number) =>
  whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Pure destructive-delta assessment for catalogue/location projections.
 *
 * It deliberately does not apply, delete or approve anything. Ingestion can use
 * this result to place a proposed revision into HOLD / REVIEW_REQUIRED while
 * retaining the previous known-good projection.
 */
export function assessDestructiveDelta<T>(
  previous: Record<string, T>,
  proposed: Record<string, T>,
  policy: DestructiveDeltaPolicy,
  sampleSize = 10
): DestructiveDeltaAssessment {
  const previousKeys = Object.keys(previous).sort();
  const proposedKeys = Object.keys(proposed).sort();
  const previousSet = new Set(previousKeys);
  const proposedSet = new Set(proposedKeys);

  const removed = previousKeys.filter((key) => !proposedSet.has(key));
  const added = proposedKeys.filter((key) => !previousSet.has(key));
  const changed = proposedKeys.filter(
    (key) => previousSet.has(key) && stableJson(previous[key]) !== stableJson(proposed[key])
  );

  const summary: DestructiveDeltaSummary = {
    previousCount: previousKeys.length,
    proposedCount: proposedKeys.length,
    addedCount: added.length,
    changedCount: changed.length,
    removedCount: removed.length,
    removedPercent: percent(removed.length, previousKeys.length),
    changedPercent: percent(changed.length, previousKeys.length),
    sampleAdded: added.slice(0, sampleSize),
    sampleChanged: changed.slice(0, sampleSize),
    sampleRemoved: removed.slice(0, sampleSize),
  };

  if (!policy.enabled) return { decision: 'ALLOW', summary, reasons: [] };

  const reasons: string[] = [];
  if (policy.maxRemovedCount !== undefined && removed.length > policy.maxRemovedCount) {
    reasons.push(`removed count ${removed.length} exceeds ${policy.maxRemovedCount}`);
  }
  if (policy.maxRemovedPercent !== undefined && summary.removedPercent > policy.maxRemovedPercent) {
    reasons.push(`removed percent ${summary.removedPercent} exceeds ${policy.maxRemovedPercent}`);
  }
  if (policy.maxChangedCount !== undefined && changed.length > policy.maxChangedCount) {
    reasons.push(`changed count ${changed.length} exceeds ${policy.maxChangedCount}`);
  }
  if (policy.maxChangedPercent !== undefined && summary.changedPercent > policy.maxChangedPercent) {
    reasons.push(`changed percent ${summary.changedPercent} exceeds ${policy.maxChangedPercent}`);
  }

  return {
    decision: reasons.length ? 'REVIEW_REQUIRED' : 'ALLOW',
    summary,
    reasons,
  };
}
