// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../commerce/models';
import type { AdminTab } from './AdminLayout';
import { AdminWorkspaceProvider, useAdminWorkspace } from './AdminWorkspaceContext';

const actor = { id: 'admin-a', name: 'Synthetic Admin', role: 'tenantAdmin', tenantId: 'tenant-a' } as AdminUser;
let host: HTMLDivElement;
let root: Root;
let workspace: ReturnType<typeof useAdminWorkspace>;
const navigate = vi.fn();

function Probe() {
  workspace = useAdminWorkspace();
  const [draft, setDraft] = useState('');
  return <main>
    <input aria-label="Synthetic unsaved draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
    <button type="button" onClick={() => setDraft('tenant-a draft')}>Set synthetic draft</button>
    <div data-admin-ai-target="catalog-filter">Filter</div>
    <div data-admin-ai-target={'odd"] [data-other="target'}>Literal target</div>
  </main>;
}

function render(tenantId = 'tenant-a', user = actor, section: AdminTab = 'catalog', onNavigate: typeof navigate | undefined = navigate) {
  act(() => root.render(<AdminWorkspaceProvider tenantId={tenantId} actor={user} section={section} onNavigate={onNavigate}><Probe /></AdminWorkspaceProvider>));
}

function seedContext() {
  act(() => {
    workspace.setScope({ locationId: 'location-a' });
    workspace.setResource({ type: 'product', id: 'product-a' });
    workspace.setFilters({ plu: 'SYNTHETIC-A' });
    host.querySelector('button')!.click();
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  navigate.mockReset();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 10, y: 20, left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40, toJSON: () => ({}),
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Altie workspace identity', () => {
  it.each([
    ['tenant', 'tenant-b', actor],
    ['user', 'tenant-a', { ...actor, id: 'admin-b' }],
    ['role', 'tenant-a', { ...actor, role: 'platformSuperAdmin' } as AdminUser],
    ['actor tenant', 'tenant-a', { ...actor, tenantId: 'tenant-b' }],
  ])('discards selected context and descendant drafts on %s change', (_reason, tenant, user) => {
    render();
    seedContext();
    expect(workspace.resource?.id).toBe('product-a');
    expect(host.querySelector('input')!.value).toBe('tenant-a draft');
    render(tenant as string, user as AdminUser);
    expect(workspace.scope).toEqual({});
    expect(workspace.resource).toBeUndefined();
    expect(workspace.filters).toBeUndefined();
    expect(host.querySelector('input')!.value).toBe('');
  });

  it('preserves useful location context across pages within the same identity', () => {
    render();
    seedContext();
    render('tenant-a', actor, 'stores');
    expect(workspace.scope.locationId).toBe('location-a');
  });
});

describe('Altie visible first-destination guidance', () => {
  it('points at a real control without clicking or submitting it', () => {
    render();
    const click = vi.fn();
    const submit = vi.fn();
    host.querySelector('[data-admin-ai-target]')!.addEventListener('click', click);
    host.addEventListener('submit', submit);
    act(() => workspace.navigateTo('catalog', 'catalog-filter'));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('catalog', 'catalog-filter', undefined);
    expect(host.querySelector('[data-altie-guide-pointer]')).not.toBeNull();
    expect(host.textContent).toContain('Guidance only');
    expect(host.textContent).toContain('This pointer does not click or save.');
    expect(click).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it('treats a target as a literal attribute value, not a CSS selector', () => {
    render();
    act(() => workspace.navigateTo('catalog', 'odd"] [data-other="target'));
    expect(host.querySelector('[data-altie-guide-pointer]')).not.toBeNull();
  });

  it('shows an honest fallback when the target never appears', () => {
    vi.useFakeTimers();
    render();
    act(() => workspace.navigateTo('catalog', 'not-a-real-control'));
    expect(host.querySelector('[data-altie-guide-pointer]')).toBeNull();
    act(() => vi.advanceTimersByTime(4001));
    expect(host.textContent).toContain('I cannot locate that control');
    expect(host.textContent).not.toContain('Successfully saved');
  });

  it('hides the pointer without pretending to cancel backend work', () => {
    render();
    act(() => workspace.navigateTo('catalog', 'catalog-filter'));
    const hide = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Hide pointer')!;
    act(() => hide.click());
    expect(host.querySelector('[data-altie-guide-pointer]')).toBeNull();
    expect(host.textContent).toContain('Show pointer');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('dismisses with Escape and cleans up a pending lookup on identity change', () => {
    vi.useFakeTimers();
    render();
    act(() => workspace.navigateTo('catalog', 'not-a-real-control'));
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(host.querySelector('[aria-label="Altie guidance"]')).toBeNull();
    act(() => workspace.navigateTo('catalog', 'not-a-real-control'));
    render('tenant-b');
    act(() => vi.runAllTimers());
    expect(host.querySelector('[aria-label="Altie guidance"]')).toBeNull();
  });

  it('does not claim navigation when there is no navigation capability', () => {
    act(() => root.render(<AdminWorkspaceProvider tenantId="tenant-a" actor={actor} section="catalog"><Probe /></AdminWorkspaceProvider>));
    act(() => workspace.navigateTo('catalog', 'catalog-filter'));
    expect(host.querySelector('[aria-label="Altie guidance"]')).toBeNull();
  });
});
