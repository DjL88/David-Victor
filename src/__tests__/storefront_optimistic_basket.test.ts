import { describe, expect, it } from 'vitest';
import {
  getDisplayedBasketItemCount,
  getDisplayedBasketQuantity,
} from '../hooks/basketOptimisticState';

describe('optimistic basket display state', () => {
  const items = [
    { plu: 'A', quantity: 1 },
    { plu: 'B', quantity: 2 },
  ];

  it('shows optimistic quantities before the authoritative basket catches up', () => {
    expect(getDisplayedBasketQuantity(items, { A: 3 }, 'A')).toBe(3);
    expect(getDisplayedBasketItemCount(items, { A: 3 })).toBe(5);
  });

  it('includes newly added products that are not in the authoritative basket yet', () => {
    expect(getDisplayedBasketQuantity(items, { C: 2 }, 'C')).toBe(2);
    expect(getDisplayedBasketItemCount(items, { C: 2 })).toBe(5);
  });

  it('allows an optimistic zero to remove an item immediately without producing negatives', () => {
    expect(getDisplayedBasketQuantity(items, { B: 0 }, 'B')).toBe(0);
    expect(getDisplayedBasketItemCount(items, { B: 0, C: -4 })).toBe(1);
  });
});
