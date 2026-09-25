import { describe, expect, it, vi } from 'vitest';
import {
  extractDeliverectWebhookAccountIds,
  resolveDeliverectWebhookTenantHandover,
} from '../../server/deliverect/DeliverectWebhookTenantResolution';

describe('Deliverect webhook tenant handover', () => {
  it('hands a legacy route to the uniquely mapped account tenant', async () => {
    const result = await resolveDeliverectWebhookTenantHandover({
      routeIdentifier: 'test1',
      payload: { accountId: '68517fde1c3ddaa7f6d0275c' },
      resolveByIdentifier: vi.fn().mockResolvedValue('test1'),
      resolveByAccountId: vi.fn().mockResolvedValue('68517fde1c3ddaa7f6d0275c'),
    });

    expect(result).toEqual({
      tenantId: '68517fde1c3ddaa7f6d0275c',
      routeTenantId: 'test1',
      source: 'ACCOUNT',
      accountId: '68517fde1c3ddaa7f6d0275c',
    });
  });

  it('keeps the provisioned route when the provider omits accountId', async () => {
    const resolveByAccountId = vi.fn();
    const result = await resolveDeliverectWebhookTenantHandover({
      routeIdentifier: 'final-tenant',
      payload: { menuId: 'menu-1' },
      resolveByIdentifier: vi.fn().mockResolvedValue('final-tenant'),
      resolveByAccountId,
    });

    expect(result).toEqual({
      tenantId: 'final-tenant',
      routeTenantId: 'final-tenant',
      source: 'ROUTE',
    });
    expect(resolveByAccountId).not.toHaveBeenCalled();
  });

  it('does not guess from an array containing more than one account', async () => {
    const resolveByAccountId = vi.fn();
    const result = await resolveDeliverectWebhookTenantHandover({
      routeIdentifier: 'test1',
      payload: [
        { accountId: 'account-a' },
        { account: { id: 'account-b' } },
      ],
      resolveByIdentifier: vi.fn().mockResolvedValue('test1'),
      resolveByAccountId,
    });

    expect(extractDeliverectWebhookAccountIds([
      { accountId: 'account-a' },
      { account: { id: 'account-b' } },
    ])).toEqual(['account-a', 'account-b']);
    expect(result?.tenantId).toBe('test1');
    expect(result?.source).toBe('ROUTE');
    expect(resolveByAccountId).not.toHaveBeenCalled();
  });
});
