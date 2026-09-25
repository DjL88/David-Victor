import { describe, expect, it } from 'vitest';
import { normalizeAppHostingDomain } from './appHostingDomainService';

describe('AppHostingDomainService', () => {
  it('returns the exact provider-supplied DNS changes', () => {
    process.env.FIREBASE_PROJECT_ID = 'leitch-tech-nonprod';
    process.env.APP_HOSTING_BACKEND_ID = 'leitch-store-staging';
    process.env.APP_HOSTING_LOCATION = 'europe-west4';

    const result = normalizeAppHostingDomain('test1.leitch.shop', {
      name: 'projects/leitch-tech-nonprod/locations/europe-west4/backends/leitch-store-staging/domains/test1.leitch.shop',
      customDomainStatus: {
        hostState: 'HOST_UNHOSTED',
        ownershipState: 'OWNERSHIP_MISSING',
        certState: 'CERT_PREPARING',
        requiredDnsUpdates: [{
          domainName: 'test1.leitch.shop.',
          desired: [{
            domainName: 'test1.leitch.shop.',
            records: [
              { domainName: 'test1.leitch.shop.', type: 'A', rdata: '203.0.113.10', requiredAction: 'ADD' },
              { domainName: 'test1.leitch.shop.', type: 'TXT', rdata: 'hosting-site=example', requiredAction: 'ADD' },
            ],
          }],
        }],
      },
    });

    expect(result.active).toBe(false);
    expect(result.requiredDnsRecords).toEqual([
      { domainName: 'test1.leitch.shop.', type: 'A', rdata: '203.0.113.10', action: 'ADD' },
      { domainName: 'test1.leitch.shop.', type: 'TXT', rdata: 'hosting-site=example', action: 'ADD' },
    ]);
  });

  it('only reports live when host, ownership and certificate are active', () => {
    process.env.FIREBASE_PROJECT_ID = 'leitch-tech-nonprod';
    process.env.APP_HOSTING_BACKEND_ID = 'leitch-store-staging';

    const result = normalizeAppHostingDomain('test1.leitch.shop', {
      customDomainStatus: {
        hostState: 'HOST_ACTIVE',
        ownershipState: 'OWNERSHIP_ACTIVE',
        certState: 'CERT_ACTIVE',
      },
    });

    expect(result.active).toBe(true);
  });
});
