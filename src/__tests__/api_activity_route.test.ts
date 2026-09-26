import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import { v1Router } from '../../server/api/v1Router';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { ChannelMenuIngestionService } from '../../server/deliverect/ChannelMenuIngestionService';
import { IntegrationContext } from '../../server/deliverect/IntegrationContext';
import { LinkedAccountsAdapter } from '../../server/deliverect/LinkedAccountsAdapter';
import { FirestorePlatformService } from '../../server/firestoreService';

describe('API activity route source isolation', () => {
  let app: express.Application;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    vi.restoreAllMocks();
    setServerRuntimeMode('demo');
    app = express();
    app.use(express.json());
    app.use('/api/v1', v1Router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  const getLogs = (suffix = '') => fetch(
    `${baseUrl}/admin/tenants/brand-alpha/integration/api-logs${suffix}`,
    {
      headers: {
        Authorization: 'Bearer dev_token_tenantAdmin_user123',
        'X-Tenant-ID': 'brand-alpha',
      },
    }
  );

  it('returns readable journals when integration context and mappings fail', async () => {
    vi.spyOn(ChannelMenuIngestionService, 'listRecentIngressPage').mockResolvedValue({
      items: [{
        eventId: 'menu-event-1',
        status: 'FAILED',
        receivedAt: '2026-09-26T12:00:00Z',
        updatedAt: '2026-09-26T12:00:01Z',
        menuIds: ['menu-1'],
        channelLinkIds: ['channel-1'],
        byteSize: 123,
        hasError: true,
      }],
      status: 'AVAILABLE',
      source: 'FIRESTORE',
      observedAt: '2026-09-26T12:01:00Z',
      nextCursor: 'menu-next',
    } as any);
    vi.spyOn(FirestorePlatformService, 'listRecentWebhookEventsPage').mockResolvedValue({
      items: [{
        webhookEventId: 'webhook-1',
        externalEventKey: 'external-1',
        tenantId: 'brand-alpha',
        provider: 'deliverect',
        environment: 'staging',
        receivedAt: '2026-09-26T12:00:00Z',
        verified: true,
        eventType: 'MENU_UPDATE',
        processingStatus: 'PROCESSED',
      }],
      status: 'AVAILABLE',
      source: 'FIRESTORE',
      observedAt: '2026-09-26T12:01:00Z',
      nextCursor: null,
    } as any);
    vi.spyOn(IntegrationContext, 'getContext').mockRejectedValue(
      Object.assign(new Error('Bearer should-never-be-returned'), { code: 'permission-denied' })
    );
    vi.spyOn(LinkedAccountsAdapter.prototype, 'getTenantMappings').mockRejectedValue(
      new Error('upstream credentials private-value')
    );

    const response = await getLogs();
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.menuPushes).toHaveLength(1);
    expect(body.webhooks).toHaveLength(1);
    expect(body.sources.menuPushes.status).toBe('AVAILABLE');
    expect(body.sources.webhooks.status).toBe('AVAILABLE');
    expect(body.sources.integration.status).toBe('UNAVAILABLE');
    expect(body.sources.oauth).toMatchObject({ status: 'UNKNOWN', mode: 'PASSIVE' });
    expect(body.integration).toBeNull();
    expect(body.menuPushes[0]).toMatchObject({
      correlationId: 'menu-event-1',
      stage: 'PROCESSING',
      errorCode: 'MENU_PROCESSING_FAILED',
    });
    expect(JSON.stringify(body)).not.toContain('should-never-be-returned');
    expect(JSON.stringify(body)).not.toContain('private-value');
  });

  it('keeps one available journal visible when the other source is unavailable', async () => {
    vi.spyOn(ChannelMenuIngestionService, 'listRecentIngressPage').mockResolvedValue({
      items: [],
      status: 'UNAVAILABLE',
      source: 'MEMORY',
      observedAt: '2026-09-26T12:01:00Z',
      nextCursor: null,
      errorCode: 'FIRESTORE_READ_FAILED',
    } as any);
    vi.spyOn(FirestorePlatformService, 'listRecentWebhookEventsPage').mockResolvedValue({
      items: [{
        webhookEventId: 'webhook-2',
        externalEventKey: 'external-2',
        tenantId: 'brand-alpha',
        provider: 'deliverect',
        environment: 'staging',
        receivedAt: '2026-09-26T12:00:00Z',
        verified: null,
        eventType: 'ORDER_STATUS',
        processingStatus: 'PENDING',
      }],
      status: 'AVAILABLE',
      source: 'FIRESTORE',
      observedAt: '2026-09-26T12:01:00Z',
      nextCursor: 'webhook-next',
    } as any);
    vi.spyOn(IntegrationContext, 'getContext').mockRejectedValue(new Error('not configured'));
    vi.spyOn(LinkedAccountsAdapter.prototype, 'getTenantMappings').mockRejectedValue(new Error('not configured'));

    const response = await getLogs();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.menuPushes).toEqual([]);
    expect(body.webhooks.map((event: any) => event.webhookEventId)).toEqual(['webhook-2']);
    expect(body.sources.menuPushes).toMatchObject({
      status: 'UNAVAILABLE',
      errorCode: 'FIRESTORE_READ_FAILED',
    });
    expect(body.sources.webhooks).toMatchObject({
      status: 'AVAILABLE',
      nextCursor: 'webhook-next',
    });
  });

  it('does not refresh or read OAuth scopes during passive log browsing', async () => {
    vi.spyOn(ChannelMenuIngestionService, 'listRecentIngressPage').mockResolvedValue({
      items: [], status: 'AVAILABLE', source: 'MEMORY',
      observedAt: '2026-09-26T12:01:00Z', nextCursor: null,
    } as any);
    vi.spyOn(FirestorePlatformService, 'listRecentWebhookEventsPage').mockResolvedValue({
      items: [], status: 'AVAILABLE', source: 'MEMORY',
      observedAt: '2026-09-26T12:01:00Z', nextCursor: null,
    } as any);
    const invalidate = vi.fn();
    const getGrantedScopes = vi.fn();
    vi.spyOn(IntegrationContext, 'getContext').mockResolvedValue({
      environment: 'staging',
      credentialMode: 'platform',
      isConfigured: true,
      deliverectAccountId: 'account-1',
      allowedChannelLinkIds: [],
      tokenManager: {
        invalidateCacheAndWait: invalidate,
        getGrantedScopes,
      },
    } as any);
    vi.spyOn(LinkedAccountsAdapter.prototype, 'getTenantMappings').mockResolvedValue({
      accounts: [], locations: [], stores: [],
    } as any);

    const response = await getLogs();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(invalidate).not.toHaveBeenCalled();
    expect(getGrantedScopes).not.toHaveBeenCalled();
    expect(body.sources.oauth).toMatchObject({ status: 'UNKNOWN', mode: 'PASSIVE' });
    expect(body.integration.commerceScopeGranted).toBeNull();
    expect(body.integration.grantedScopes).toEqual([]);
  });

  it('records an explicit active OAuth observation without making journals depend on it', async () => {
    vi.spyOn(ChannelMenuIngestionService, 'listRecentIngressPage').mockResolvedValue({
      items: [], status: 'AVAILABLE', source: 'MEMORY',
      observedAt: '2026-09-26T12:01:00Z', nextCursor: null,
    } as any);
    vi.spyOn(FirestorePlatformService, 'listRecentWebhookEventsPage').mockResolvedValue({
      items: [], status: 'AVAILABLE', source: 'MEMORY',
      observedAt: '2026-09-26T12:01:00Z', nextCursor: null,
    } as any);
    const invalidate = vi.fn().mockResolvedValue(undefined);
    const getGrantedScopes = vi.fn().mockRejectedValue(
      Object.assign(new Error('oauth bearer secret'), { code: 'permission-denied' })
    );
    vi.spyOn(IntegrationContext, 'getContext').mockResolvedValue({
      environment: 'staging',
      credentialMode: 'platform',
      isConfigured: true,
      tokenManager: { invalidateCacheAndWait: invalidate, getGrantedScopes },
    } as any);
    vi.spyOn(LinkedAccountsAdapter.prototype, 'getTenantMappings').mockResolvedValue({
      accounts: [], locations: [], stores: [],
    } as any);

    const response = await getLogs('?refreshOAuth=true');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(getGrantedScopes).toHaveBeenCalledOnce();
    expect(body.sources.oauth).toMatchObject({
      status: 'UNAVAILABLE',
      mode: 'ACTIVE',
      errorCode: 'PERMISSION_DENIED',
    });
    expect(body.menuPushes).toEqual([]);
    expect(body.webhooks).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('oauth bearer secret');
  });
});
