import { describe, expect, it } from 'vitest';
import { CreateTenantSchema } from '../../server/api/schemas';

describe('Brand provisioning request validation', () => {
  it('accepts blank optional admin/domain fields from the wizard and normalizes them away', () => {
    const parsed = CreateTenantSchema.parse({
      tenantId: 'brand-test',
      brandName: 'Test Brand',
      domain: '',
      adminEmail: '',
      adminName: '',
      headingFontFamily: 'Playfair Display',
      currency: 'GBP',
      country: 'GB',
    });

    expect(parsed.tenantId).toBe('brand-test');
    expect(parsed.adminEmail).toBeUndefined();
    expect(parsed.adminName).toBeUndefined();
    expect(parsed.domain).toBeUndefined();
    expect(parsed.headingFontFamily).toBe('Playfair Display');
  });

  it('returns a specific validation failure for a non-empty invalid admin email', () => {
    const result = CreateTenantSchema.safeParse({
      tenantId: 'brand-test',
      brandName: 'Test Brand',
      adminEmail: 'not-an-email',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['adminEmail']);
      expect(result.error.issues[0]?.message).toContain('valid administrator email');
    }
  });  it('normalizes a valid short order prefix', () => {
    const parsed = CreateTenantSchema.parse({
      tenantId: 'brand-order-prefix',
      brandName: 'LeitchTech',
      orderCodePrefix: 'lt',
    });

    expect(parsed.orderCodePrefix).toBe('LT');
  });

  it('rejects an order prefix outside 2-4 alphanumeric characters', () => {
    const parsed = CreateTenantSchema.safeParse({
      tenantId: 'brand-order-prefix',
      brandName: 'LeitchTech',
      orderCodePrefix: 'L',
    });

    expect(parsed.success).toBe(false);
  });


});
