import { beforeEach, describe, expect, it } from 'vitest';
import { CustomerAccountService, normalizeFavouritePlus } from '../../server/customerAccountService';

describe('customer account persistence', () => {
  beforeEach(() => {
    CustomerAccountService.resetForTest();
  });

  it('normalizes, deduplicates and trims favourite PLUs', () => {
    expect(normalizeFavouritePlus([' PLU-1 ', 'PLU-1', '', 'PLU-2', 7])).toEqual([
      'PLU-1',
      'PLU-2',
    ]);
  });

  it('keeps customer favourites isolated by tenant and customer identity', async () => {
    await CustomerAccountService.saveFavourites('brand-alpha', 'customer-a', ['A-1']);
    await CustomerAccountService.saveFavourites('brand-alpha', 'customer-b', ['B-1']);
    await CustomerAccountService.saveFavourites('brand-beta', 'customer-a', ['BA-1']);

    await expect(CustomerAccountService.getProfile('brand-alpha', 'customer-a')).resolves.toMatchObject({
      favouritePlus: ['A-1'],
    });
    await expect(CustomerAccountService.getProfile('brand-alpha', 'customer-b')).resolves.toMatchObject({
      favouritePlus: ['B-1'],
    });
    await expect(CustomerAccountService.getProfile('brand-beta', 'customer-a')).resolves.toMatchObject({
      favouritePlus: ['BA-1'],
    });
  });
});
