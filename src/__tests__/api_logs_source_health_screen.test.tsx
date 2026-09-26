// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ getIntegrationApiLogs: vi.fn(), traceRequest: vi.fn() }));
vi.mock('../commerce/HttpAdminClient', () => ({ defaultAdminClient: client }));
import { ApiLogsScreen } from '../admin/screens/ApiLogsScreen';

describe('API Logs source-health UI', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    client.getIntegrationApiLogs.mockReset();
    client.traceRequest.mockReset();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('does not present unavailable or partial history as a confirmed empty result', async () => {
    client.getIntegrationApiLogs.mockResolvedValue({
      tenantId: 'tenant-a',
      generatedAt: '2026-09-26T05:00:00Z',
      menuPushes: [],
      webhooks: [],
      circuits: {},
      integration: { grantedScopes: [], allowedChannelLinkIds: [] },
      sources: {
        menuPushes: { status: 'UNAVAILABLE', source: 'MEMORY', observedAt: '2026-09-26T05:00:00Z', errorCode: 'FIRESTORE_READ_UNAVAILABLE' },
        webhooks: { status: 'PARTIAL', source: 'MEMORY', observedAt: '2026-09-26T05:00:00Z' },
        integration: { status: 'AVAILABLE', source: 'PLATFORM', observedAt: '2026-09-26T05:00:00Z' },
        mappings: { status: 'AVAILABLE', source: 'PLATFORM', observedAt: '2026-09-26T05:00:00Z' },
        oauthScopes: { status: 'UNKNOWN', source: 'NONE', observedAt: '2026-09-26T05:00:00Z' },
      },
      pagination: { menuCursor: null, webhookCursor: null },
    });

    await act(async () => root.render(<ApiLogsScreen tenantId="tenant-a" />));

    expect(container.querySelector('[aria-label="API evidence sources"]')?.textContent).toContain('UNAVAILABLE');
    expect(container.textContent).toContain('Menu Push history is unavailable; no-activity cannot be established.');
    expect(container.textContent).toContain('Only partial webhook history is available');
    expect(container.textContent).not.toContain('No Menu Push entries returned for this tenant.');
  });
});
