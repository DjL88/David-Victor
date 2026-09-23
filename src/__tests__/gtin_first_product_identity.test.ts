import { describe, expect, it } from 'vitest';
import { productIdentityKey, productsShareIdentity } from '../../server/deliverect/DeliverectApiClient';

describe('GTIN-first product identity', () => {
  it('matches the same GTIN even when PLUs differ between accounts or locations', () => {
    const accountA = { plu: 'A-PLU', gtin: ['05012345678901'] } as any;
    const accountB = { plu: 'B-PLU', gtin: '05012345678901' } as any;

    expect(productIdentityKey(accountA)).toBe('gtin:05012345678901');
    expect(productIdentityKey(accountB)).toBe('gtin:05012345678901');
    expect(productsShareIdentity(accountA, accountB)).toBe(true);
  });

  it('falls back to PLU when neither product has a GTIN', () => {
    expect(productsShareIdentity(
      { plu: 'COMMON-PLU' } as any,
      { plu: 'COMMON-PLU' } as any
    )).toBe(true);
    expect(productsShareIdentity(
      { plu: 'PLU-A' } as any,
      { plu: 'PLU-B' } as any
    )).toBe(false);
  });

  it('does not merge a GTIN product with a PLU-only product just because their PLUs match', () => {
    expect(productsShareIdentity(
      { plu: '123', gtin: '05012345678901' } as any,
      { plu: '123' } as any
    )).toBe(false);
  });
});
