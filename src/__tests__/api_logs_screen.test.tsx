// @vitest-environment jsdom
import React, { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({ getIntegrationApiLogs: vi.fn(), traceRequest: vi.fn() }));
vi.mock('../commerce/HttpAdminClient', () => ({ defaultAdminClient: client }));
import { ApiLogsScreen } from '../admin/screens/ApiLogsScreen';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}
const snapshot = (tenantId: string, accountId = tenantId) => ({
  tenantId, generatedAt: '2026-09-26T04:00:00Z', menuPushes: [], webhooks: [], circuits: {},
  sources: {
    menuPushes: { status: 'AVAILABLE', source: 'FIRESTORE', observedAt: '2026-09-26T04:00:00Z' },
    webhooks: { status: 'AVAILABLE', source: 'FIRESTORE', observedAt: '2026-09-26T04:00:00Z' },
    integration: { status: 'AVAILABLE', observedAt: '2026-09-26T04:00:00Z' },
    oauth: { status: 'UNKNOWN', mode: 'PASSIVE', observedAt: '2026-09-26T04:00:00Z' },
  },
  integration: { accountId, grantedScopes: [], commerceScopeGranted: null, allowedChannelLinkIds: [] },
});

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
  await act(async () => { root.unmount(); });
  container.remove();
});
const render = async (tenantId: string) => {
  await act(async () => { root.render(<ApiLogsScreen tenantId={tenantId} />); });
};
const click = async (label: string) => {
  const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.trim() === label);
  expect(button, `Button ${label}`).toBeTruthy();
  await act(async () => { button!.click(); });
};

describe('API Logs real component', () => {
  it('shows unknown rather than missing scope, closed circuit or empty history after a load failure', async () => {
    client.getIntegrationApiLogs.mockRejectedValue(new Error('Bearer private-token'));
    await render('tenant-a');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    expect(container.textContent).toContain('Scope status unknown');
    expect(container.textContent).toContain('Not observed');
    expect(container.textContent).toContain('Menu Push activity has not been loaded');
    expect(container.textContent).not.toContain('genericCommerce missing');
    expect(container.textContent).not.toContain('CLOSED');
    expect(container.textContent).not.toContain('private-token');
  });

  it('labels unavailable and partial journal sources instead of claiming empty history', async () => {
    client.getIntegrationApiLogs.mockResolvedValue({
      ...snapshot('tenant-a'),
      sources: {
        ...snapshot('tenant-a').sources,
        menuPushes: { status: 'UNAVAILABLE', source: 'MEMORY', observedAt: '2026-09-26T04:01:00Z', errorCode: 'FIRESTORE_READ_FAILED' },
        webhooks: { status: 'PARTIAL', source: 'MEMORY', observedAt: '2026-09-26T04:01:00Z', errorCode: 'FIRESTORE_READ_FAILED' },
      },
    });
    await render('tenant-a');
    expect(container.textContent).toContain('Menu Push activity source is unavailable; an empty result is not confirmed.');
    expect(container.textContent).toContain('Webhook activity is partial; additional durable history may be unavailable.');
    expect(container.textContent).not.toContain('No Menu Push entries returned for this tenant.');
    expect(container.textContent).not.toContain('No webhook entries returned for this tenant.');
  });

  it('hides the old snapshot immediately on tenant switch, then ignores its delayed response', async () => {
    const late = deferred<unknown>();
    client.getIntegrationApiLogs.mockImplementation((tenant: string) => tenant === 'tenant-a' ? late.promise : Promise.resolve(snapshot('tenant-b', 'account-B')));
    await render('tenant-a');
    await render('tenant-b');
    expect(container.textContent).toContain('account-B');
    await act(async () => { late.resolve(snapshot('tenant-a', 'account-A-private')); });
    expect(container.textContent).toContain('account-B');
    expect(container.textContent).not.toContain('account-A-private');
  });

  it('does not retain an already loaded old tenant snapshot while the new tenant loads', async () => {
    const next = deferred<unknown>();
    client.getIntegrationApiLogs.mockImplementation((tenant: string) => tenant === 'tenant-a' ? Promise.resolve(snapshot(tenant, 'account-A-private')) : next.promise);
    await render('tenant-a');
    expect(container.textContent).toContain('account-A-private');
    await render('tenant-b');
    expect(container.textContent).toContain('Loading API activity');
    expect(container.textContent).not.toContain('account-A-private');
    await act(async () => { next.resolve(snapshot('tenant-b', 'account-B')); });
    expect(container.textContent).toContain('account-B');
  });

  it('rejects a returned snapshot for a different tenant', async () => {
    client.getIntegrationApiLogs.mockResolvedValue(snapshot('tenant-b', 'foreign-account-private'));
    await render('tenant-a');
    expect(container.textContent).toContain('could not be loaded');
    expect(container.textContent).not.toContain('foreign-account-private');
  });

  it('ignores a late diagnostic from the previous tenant', async () => {
    const lateTrace = deferred<unknown>();
    client.getIntegrationApiLogs.mockImplementation((tenant: string) => Promise.resolve(snapshot(tenant)));
    client.traceRequest.mockReturnValue(lateTrace.promise);
    await render('tenant-a');
    await click('Run connection diagnostic');
    await render('tenant-b');
    await act(async () => { lateTrace.resolve({ tenantId: 'tenant-a', overallStatus: 'PRIVATE_TENANT_A_RESULT', stage1Upstream: { httpStatus: 200 } }); });
    expect(container.textContent).not.toContain('PRIVATE_TENANT_A_RESULT');
    expect(container.querySelector('[aria-label="Connection diagnostic"]')).toBeNull();
  });

  it('labels a retained same-tenant snapshot as stale when refresh fails', async () => {
    client.getIntegrationApiLogs.mockResolvedValueOnce(snapshot('tenant-a', 'saved-account')).mockRejectedValueOnce(new Error('offline'));
    await render('tenant-a');
    await click('Refresh');
    expect(container.textContent).toContain('saved-account');
    expect(container.textContent).toContain('last successful snapshot for this tenant');
  });

  it('rejects a diagnostic with missing tenant evidence instead of displaying success', async () => {
    client.getIntegrationApiLogs.mockResolvedValue(snapshot('tenant-a'));
    client.traceRequest.mockResolvedValue({ overallStatus: 'UNVERIFIED_SUCCESS', stage1Upstream: { httpStatus: 200 } });
    await render('tenant-a');
    await click('Run connection diagnostic');
    expect(container.textContent).toContain('No live access result has been confirmed');
    expect(container.textContent).not.toContain('UNVERIFIED_SUCCESS');
  });

  it('keeps the latest result under Strict Mode when its discarded first request resolves last', async () => {
    const discarded = deferred<unknown>();
    client.getIntegrationApiLogs.mockReturnValueOnce(discarded.promise).mockResolvedValue(snapshot('tenant-a', 'current-account'));
    await act(async () => { root.render(<StrictMode><ApiLogsScreen tenantId="tenant-a" /></StrictMode>); });
    expect(container.textContent).toContain('current-account');
    await act(async () => { discarded.resolve(snapshot('tenant-a', 'discarded-account')); });
    expect(container.textContent).not.toContain('discarded-account');
    expect(container.textContent).toContain('current-account');
  });

  it('shows enriched Menu Push identities and filters by location', async () => {
    client.getIntegrationApiLogs.mockResolvedValue({
      ...snapshot('tenant-a'),
      menuPushes: [{
        eventId: 'event-1', status: 'PROCESSED', receivedAt: '2026-09-26T04:00:00Z',
        menuIds: ['menu-1'], menuNames: ['Market Lane'],
        accountIds: ['account-1'], accountNames: ['Test Retailer'],
        channelLinkIds: ['channel-1'], channelNames: ['LeitchTech'],
        locationIds: ['location-1'], locationNames: ["Ewan's Store"],
      }],
    });
    await render('tenant-a');
    expect(container.textContent).toContain('Market Lane');
    expect(container.textContent).toContain("Ewan's Store");
    const search = container.querySelector('input[placeholder="Name, ID or event"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'no-match');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('No Menu Push entries match the current filters.');
  });
});
