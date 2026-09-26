import { describe, expect, it } from 'vitest';
import {
  decodeApiActivityCursor,
  encodeApiActivityCursor,
  pageMemoryActivity,
  safeApiActivityErrorCode,
} from '../../server/apiActivityJournal';

describe('API activity journal primitives', () => {
  it('orders by received time before limiting and continues from a stable cursor', () => {
    const values = [
      { id: 'a', receivedAt: '2026-09-26T01:00:00Z' },
      { id: 'b', receivedAt: '2026-09-26T03:00:00Z' },
      { id: 'c', receivedAt: '2026-09-26T02:00:00Z' },
    ];

    const first = pageMemoryActivity(values, {
      limit: 2,
      receivedAt: (value) => value.receivedAt,
      id: (value) => value.id,
    });
    expect(first.items.map((value) => value.id)).toEqual(['b', 'c']);
    expect(first.nextCursor).toBeTruthy();

    const second = pageMemoryActivity(values, {
      limit: 2,
      cursor: first.nextCursor,
      receivedAt: (value) => value.receivedAt,
      id: (value) => value.id,
    });
    expect(second.items.map((value) => value.id)).toEqual(['a']);
  });

  it('uses the stable id as a tie-breaker before applying the page limit', () => {
    const values = [
      { id: 'a', receivedAt: '2026-09-26T03:00:00Z' },
      { id: 'c', receivedAt: '2026-09-26T03:00:00Z' },
      { id: 'b', receivedAt: '2026-09-26T03:00:00Z' },
    ];
    const first = pageMemoryActivity(values, {
      limit: 2,
      receivedAt: (value) => value.receivedAt,
      id: (value) => value.id,
    });
    expect(first.items.map((value) => value.id)).toEqual(['c', 'b']);

    const second = pageMemoryActivity(values, {
      limit: 2,
      cursor: first.nextCursor,
      receivedAt: (value) => value.receivedAt,
      id: (value) => value.id,
    });
    expect(second.items.map((value) => value.id)).toEqual(['a']);
  });

  it('rejects malformed cursors and preserves valid cursor identity', () => {
    expect(decodeApiActivityCursor('not-a-valid-cursor')).toBeNull();
    const encoded = encodeApiActivityCursor({
      receivedAt: '2026-09-26T01:00:00Z',
      id: 'event-1',
    });
    expect(decodeApiActivityCursor(encoded)).toEqual({
      receivedAt: '2026-09-26T01:00:00Z',
      id: 'event-1',
    });
  });

  it('returns only normalized structured error codes', () => {
    expect(safeApiActivityErrorCode({ code: 'permission-denied' }, 'FALLBACK')).toBe('PERMISSION_DENIED');
    expect(safeApiActivityErrorCode(new Error('provider unavailable'), 'FALLBACK')).toBe('FALLBACK');
  });
});
