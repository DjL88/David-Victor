import { describe, expect, it } from 'vitest';
import {
  createDomainVerificationToken,
  domainVerificationRecordName,
  domainVerificationRecordValue,
} from '../../server/domainVerificationService';

describe('custom domain ownership verification', () => {
  it('builds a tenant-neutral TXT challenge record without exposing application secrets', () => {
    const token = createDomainVerificationToken();
    expect(token.length).toBeGreaterThan(20);
    expect(domainVerificationRecordName('Shop.Example.com')).toBe(
      '_bwydi-verification.shop.example.com'
    );
    expect(domainVerificationRecordValue(token)).toBe(
      `bwydi-domain-verification=${token}`
    );
  });

  it('normalizes surrounding dots and rejects a blank hostname', () => {
    expect(domainVerificationRecordName('.shop.example.com.')).toBe(
      '_bwydi-verification.shop.example.com'
    );
    expect(() => domainVerificationRecordName('')).toThrow(/valid hostname/i);
  });
});
