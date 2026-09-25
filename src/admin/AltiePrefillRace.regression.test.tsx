// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../commerce/models';

const adminClient = vi.hoisted(() => ({
  setActiveAdminUser: vi.fn(),
  listAllTenants: vi.fn(async () => []),
  getOperationalReadiness: vi.fn(async () => ({ issueCount: 0 })),
  getBranding: vi.fn(async (tenantId: string) => ({ tenantId, brandName: 'Synthetic tenant' })),
}));

vi.mock('../commerce/HttpAdminClient', () => ({ defaultAdminClient: adminClient }));
vi.mock('../tenant/TenantContext', () => ({ useTenant: () => ({ appMode: 'staging' }) }));
vi.mock('./screens/CatalogAdminScreen', () => ({ CatalogAdminScreen: () => <div>Catalog</div> }));
vi.mock('./screens/BrandingScreen', () => ({ BrandingScreen: () => <div>Branding</div> }));

vi.mock('./AdminAssistantDrawer', async () => {
  const { useAdminWorkspace } = await import('./AdminWorkspaceContext');
  return {
    AdminAssistantDrawer: ({ open }: { open: boolean }) => {
      const workspace = useAdminWorkspace();
      if (!open) return null;
      return (
        <button
          type="button"
          aria-label="Schedule evaluator prefill"
          onClick={() => workspace.navigateTo('branding', 'branding-primary-colour', {
            prefill: { primaryColour: '#112233' },
          })}
        >
          Schedule prefill
        </button>
      );
    },
  };
});

import { AdminLayout } from './AdminLayout';

const actor = {
  id: 'synthetic-admin-a',
  name: 'Synthetic Admin',
  role: 'tenantAdmin',
  tenantId: 'tenant-a',
} as AdminUser;

let host: HTMLDivElement;
let root: Root | null;

function clickLabel(label: string) {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!button) throw new Error(`Missing button ${label}`);
  act(() => button.click());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  host.remove();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Altie delayed prefill trust boundary', () => {
  it('does not fire a queued prefill after the workspace unmounts', async () => {
    const delivered: unknown[] = [];
    const listener = (event: Event) => delivered.push((event as CustomEvent).detail);
    window.addEventListener('admin-ai-prefill', listener);

    await act(async () => {
      root!.render(<AdminLayout initialUser={actor} onExitAdmin={() => undefined} />);
      await Promise.resolve();
    });

    clickLabel('Ask Altie');
    clickLabel('Schedule evaluator prefill');

    act(() => root?.unmount());
    root = null;
    act(() => vi.advanceTimersByTime(500));

    window.removeEventListener('admin-ai-prefill', listener);
    expect(delivered).toEqual([]);
  });
});
