import { CustomDomainConfig, TenantDomainsResponse } from './domainModels';

export const MOCK_DOMAINS: Record<string, TenantDomainsResponse> = {
  'brand-alpha': {
    defaultPlatformDomain: 'chelmsford-grocer.stores.platform.example',
    customDomains: [
      {
        id: 'dom-1',
        tenantId: 'brand-alpha',
        domain: 'shop.chelmsfordgrocer.co.uk',
        isApex: false,
        status: 'ACTIVE',
        primary: true,
        sslCertificate: {
          issuer: "Let's Encrypt Authority X3",
          expiresAt: '2026-11-20T12:00:00Z',
          status: 'valid',
        },
        dnsInstructions: [
          {
            type: 'CNAME',
            host: 'shop',
            target: 'domains.platform.example',
            ttl: '3600',
            purpose: 'ROUTING',
            isConfigured: true,
          },
          {
            type: 'TXT',
            host: '_platform-verify.shop',
            target: 'platform-verification=94d6f13b-alpha-grocer',
            ttl: '3600',
            purpose: 'OWNERSHIP_VERIFICATION',
            isConfigured: true,
          },
        ],
        lastCheckedAt: '2026-03-16T18:00:00Z',
        createdAt: '2026-01-10T10:00:00Z',
        updatedAt: '2026-03-10T11:00:00Z',
      },
      {
        id: 'dom-2',
        tenantId: 'brand-alpha',
        domain: 'chelmsfordgrocer.co.uk',
        isApex: true,
        status: 'AWAITING_DNS',
        primary: false,
        sslCertificate: {
          status: 'pending',
        },
        dnsInstructions: [
          {
            type: 'A',
            host: '@',
            target: '76.76.21.21',
            ttl: '3600',
            purpose: 'APEX_ROUTING',
            isConfigured: false,
          },
          {
            type: 'TXT',
            host: '_platform-verify',
            target: 'platform-verification=94d6f13b-alpha-apex',
            ttl: '3600',
            purpose: 'OWNERSHIP_VERIFICATION',
            isConfigured: false,
          },
        ],
        lastCheckedAt: '2026-03-16T19:30:00Z',
        createdAt: '2026-03-15T09:00:00Z',
        updatedAt: '2026-03-15T09:00:00Z',
      },
    ],
  },
  'brand-beta': {
    defaultPlatformDomain: 'brand-beta.stores.platform.example',
    customDomains: [],
  },
};
