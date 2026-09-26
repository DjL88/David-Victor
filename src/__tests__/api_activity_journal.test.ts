import { describe, expect, it, vi } from 'vitest';
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

  it('preserves known diagnostic aliases and the internal caller fallback', () => {
    expect(safeApiActivityErrorCode({ code: 'permission-denied' }, 'FALLBACK')).toBe('PERMISSION_DENIED');
    expect(safeApiActivityErrorCode({ code: ' unavailable ' }, 'FIRESTORE_READ_FAILED')).toBe('UNAVAILABLE');
    expect(safeApiActivityErrorCode(new Error('provider unavailable'), 'FALLBACK')).toBe('FALLBACK');
  });

  it.each([
    { label: 'valid-looking secret', code: 'TOKEN_SYNTHETIC_CUSTOMER_123' },
    { label: 'bearer text', code: 'Bearer synthetic-token-only' },
    { label: 'customer email', code: 'customer@example.test' },
    { label: 'provider URL', code: 'https://provider.example.test/?token=synthetic' },
    { label: 'known code with customer suffix', code: 'PERMISSION_DENIED_CUSTOMER_123' },
    { label: 'known code with secret suffix', code: 'FIRESTORE_READ_FAILED_SECRET' },
    { label: 'unknown provider code', code: 'UnknownProviderSpecificCode' },
    { label: 'prototype key', code: '__proto__' },
    { label: 'constructor key', code: 'constructor' },
    { label: 'oversized code', code: 'X'.repeat(100_000) },
  ])('does not publish untrusted $label', ({ code }) => {
    const result = safeApiActivityErrorCode(
      { code, message: 'synthetic customer payload', stack: 'synthetic token' },
      'FIRESTORE_READ_FAILED'
    );
    expect(result).toBe('FIRESTORE_READ_FAILED');
  });

  it.each([
    { label: 'null', code: null },
    { label: 'undefined', code: undefined },
    { label: 'number', code: 7 },
    { label: 'symbol', code: Symbol('synthetic') },
    { label: 'array', code: ['PERMISSION_DENIED'] },
  ])('rejects a $label error code without coercion', ({ code }) => {
    expect(safeApiActivityErrorCode({ code }, 'FIRESTORE_READ_FAILED')).toBe('FIRESTORE_READ_FAILED');
  });

  it('does not invoke provider toString methods or expose thrown getter text', () => {
    const toString = vi.fn(() => 'PERMISSION_DENIED');
    expect(safeApiActivityErrorCode({ code: { toString } }, 'FIRESTORE_READ_FAILED')).toBe('FIRESTORE_READ_FAILED');
    expect(toString).not.toHaveBeenCalled();

    const malformed = Object.defineProperty({}, 'code', {
      get() { throw new Error('synthetic-secret-in-getter'); },
    });
    expect(safeApiActivityErrorCode(malformed, 'FIRESTORE_READ_FAILED')).toBe('FIRESTORE_READ_FAILED');
  });

  it('ignores raw error bodies and hostile property access while degrading safely', () => {
    const hostile = new Proxy({}, {
      get() { throw new Error('synthetic-secret-in-proxy'); },
    });
    for (const value of [null, undefined, 'PERMISSION_DENIED', new Error('synthetic-token'), hostile]) {
      expect(safeApiActivityErrorCode(value, 'FIRESTORE_READ_FAILED')).toBe('FIRESTORE_READ_FAILED');
    }
  });
});
