import { describe, expect, it } from 'vitest';
import {
  isCurrentTenantRequest,
  resolveDomainLifecycle,
} from '../admin/domainLifecycle';

describe('Sprint 4 CMS/domain truth', () => {
  it('keeps requested, claimed, verified, HTTPS and live evidence distinct', () => {
    expect(resolveDomainLifecycle({ hostname: 'shop.example.com' })).toEqual({
      requested: true,
      claimed: false,
      verified: false,
      httpsReady: false,
      live: false,
    });

    expect(resolveDomainLifecycle({
      hostname: 'shop.example.com',
      domainId: 'domain-1',
      status: 'pending',
    })).toEqual({
      requested: true,
      claimed: true,
      verified: false,
      httpsReady: false,
      live: false,
    });

    expect(resolveDomainLifecycle({
      hostname: 'shop.example.com',
      domainId: 'domain-1',
      status: 'verified',
      tlsStatus: 'pending',
    })).toEqual({
      requested: true,
      claimed: true,
      verified: true,
      httpsReady: false,
      live: false,
    });

    expect(resolveDomainLifecycle({
      hostname: 'shop.example.com',
      domainId: 'domain-1',
      status: 'verified',
      tlsStatus: 'ready',
    })).toEqual({
      requested: true,
      claimed: true,
      verified: true,
      httpsReady: true,
      live: false,
    });

    expect(resolveDomainLifecycle({
      hostname: 'shop.example.com',
      domainId: 'domain-1',
      status: 'active',
      tlsStatus: 'ready',
    })).toEqual({
      requested: true,
      claimed: true,
      verified: true,
      httpsReady: true,
      live: true,
    });
  });

  it('never infers HTTPS or live routing from ownership verification alone', () => {
    expect(resolveDomainLifecycle({
      hostname: 'shop.example.com',
      domainId: 'domain-1',
      status: 'pending',
      ownershipVerifiedAt: '2026-09-26T14:00:00Z',
      tlsStatus: 'pending',
    })).toMatchObject({
      claimed: true,
      verified: true,
      httpsReady: false,
      live: false,
    });
  });

  it('does not treat an unrequested blank hostname as lifecycle progress', () => {
    expect(resolveDomainLifecycle({ hostname: '   ' })).toEqual({
      requested: false,
      claimed: false,
      verified: false,
      httpsReady: false,
      live: false,
    });
  });

  it('rejects late async results from the previous tenant context', () => {
    expect(isCurrentTenantRequest('tenant-b', 'tenant-a')).toBe(false);
    expect(isCurrentTenantRequest('tenant-b', 'tenant-b')).toBe(true);
  });
});
