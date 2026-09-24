import { describe, expect, it } from 'vitest';
import { assessDestructiveDelta } from './catalogDegradationGuard';

describe('assessDestructiveDelta', () => {
  const previous = {
    a: { name: 'A', price: 100 },
    b: { name: 'B', price: 200 },
    c: { name: 'C', price: 300 },
    d: { name: 'D', price: 400 },
  };

  it('holds a destructive catalogue revision instead of silently accepting it', () => {
    const result = assessDestructiveDelta(previous, {
      a: previous.a,
      b: { name: 'B', price: 250 },
    }, {
      enabled: true,
      maxRemovedPercent: 25,
      maxChangedPercent: 20,
    });

    expect(result.decision).toBe('REVIEW_REQUIRED');
    expect(result.summary).toMatchObject({
      previousCount: 4,
      proposedCount: 2,
      removedCount: 2,
      removedPercent: 50,
      changedCount: 1,
      changedPercent: 25,
    });
    expect(result.summary.sampleRemoved).toEqual(['c', 'd']);
    expect(result.reasons).toHaveLength(2);
  });

  it('allows safe deltas under configured thresholds', () => {
    const result = assessDestructiveDelta(previous, {
      ...previous,
      e: { name: 'E', price: 500 },
    }, {
      enabled: true,
      maxRemovedPercent: 10,
      maxChangedPercent: 10,
    });
    expect(result.decision).toBe('ALLOW');
    expect(result.summary.addedCount).toBe(1);
  });

  it('is deterministic regardless of object key order', () => {
    const result = assessDestructiveDelta(
      { z: { n: 1 }, a: { n: 2 } },
      { a: { n: 3 }, y: { n: 4 } },
      { enabled: true, maxRemovedCount: 0 }
    );
    expect(result.summary.sampleRemoved).toEqual(['z']);
    expect(result.summary.sampleAdded).toEqual(['y']);
    expect(result.summary.sampleChanged).toEqual(['a']);
  });

  it('can be disabled for controlled rollout without changing the evidence', () => {
    const result = assessDestructiveDelta(previous, {}, {
      enabled: false,
      maxRemovedCount: 0,
    });
    expect(result.decision).toBe('ALLOW');
    expect(result.summary.removedCount).toBe(4);
  });
});
