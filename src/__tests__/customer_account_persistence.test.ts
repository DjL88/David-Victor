import { beforeEach, describe, expect, it } from 'vitest';
import { CustomerAccountService, normalizeFavouritePlus, normalizeSavedAddresses } from '../../server/customerAccountService';

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

  it('normalizes and de-duplicates saved delivery addresses', () => {
    expect(
      normalizeSavedAddresses([
        { line1: ' 10 High Street ', city: 'Birmingham', postalCode: 'B1 1AA', country: 'GB' },
        { street: '10 High Street', city: 'Birmingham', postcode: 'B1 1AA', country: 'GB' },
        { line1: '', city: '', country: 'GB' },
      ])
    ).toEqual([
      {
        line1: '10 High Street',
        street: '10 High Street',
        city: 'Birmingham',
        postalCode: 'B1 1AA',
        postcode: 'B1 1AA',
        country: 'GB',
      },
    ]);
  });

  it('persists saved addresses without crossing tenant or customer boundaries', async () => {
    await CustomerAccountService.saveAddresses('brand-alpha', 'customer-a', [
      { line1: '1 Alpha Road', city: 'Birmingham', postalCode: 'B1 1AA', country: 'GB' },
    ]);
    await CustomerAccountService.saveAddresses('brand-beta', 'customer-a', [
      { line1: '2 Beta Road', city: 'London', postalCode: 'E1 1AA', country: 'GB' },
    ]);

    await expect(CustomerAccountService.getProfile('brand-alpha', 'customer-a')).resolves.toMatchObject({
      savedAddresses: [{ line1: '1 Alpha Road' }],
    });
    await expect(CustomerAccountService.getProfile('brand-beta', 'customer-a')).resolves.toMatchObject({
      savedAddresses: [{ line1: '2 Beta Road' }],
    });
  });
});
