import crypto from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';

export const DOMAIN_VERIFICATION_PREFIX = 'bwydi-domain-verification=';

export function createDomainVerificationToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function domainVerificationRecordName(hostname: string): string {
  const clean = String(hostname || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!clean) throw new Error('A valid hostname is required.');
  return `_bwydi-verification.${clean}`;
}

export function domainVerificationRecordValue(token: string): string {
  return `${DOMAIN_VERIFICATION_PREFIX}${String(token || '').trim()}`;
}

export async function verifyDomainOwnershipTxt(
  hostname: string,
  token: string
): Promise<{
  verified: boolean;
  recordName: string;
  expectedValue: string;
  observedValues: string[];
}> {
  const recordName = domainVerificationRecordName(hostname);
  const expectedValue = domainVerificationRecordValue(token);
  let observedValues: string[] = [];

  try {
    const records = await resolveTxt(recordName);
    observedValues = records
      .map((parts) => parts.join('').trim())
      .filter(Boolean);
  } catch (err: any) {
    const code = String(err?.code || '');
    if (!['ENODATA', 'ENOTFOUND', 'SERVFAIL', 'ETIMEOUT'].includes(code)) throw err;
  }

  return {
    verified: observedValues.includes(expectedValue),
    recordName,
    expectedValue,
    observedValues,
  };
}
