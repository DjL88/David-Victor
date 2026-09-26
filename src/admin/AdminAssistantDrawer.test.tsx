// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  chatWithAssistant: vi.fn(),
  createAssistantChangeSet: vi.fn(),
  runAssistantAction: vi.fn(),
}));

const workspace = vi.hoisted(() => ({
  tenantId: 'tenant-a',
  section: 'branding',
  actor: {
    id: 'admin-1',
    name: 'Admin',
    role: 'tenantAdmin',
    tenantId: 'tenant-a',
  },
  scope: {},
  resource: undefined,
  filters: undefined,
  setScope: vi.fn(),
  setResource: vi.fn(),
  setFilters: vi.fn(),
  navigateTo: vi.fn(),
}));

vi.mock('./AdminWorkspaceContext', () => ({
  useAdminWorkspace: () => workspace,
}));

vi.mock('../commerce/HttpAdminClient', () => ({
  defaultAdminClient: client,
}));

import { AdminAssistantDrawer } from './AdminAssistantDrawer';

let container: HTMLDivElement;
let root: Root;

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function button(label: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim().includes(label)
  ) as HTMLButtonElement | undefined;
  expect(match, `Button ${label} should exist`).toBeTruthy();
  return match!;
}

describe('AdminAssistantDrawer trusted proposal flow', () => {
  beforeEach(() => {
    client.chatWithAssistant.mockReset();
    client.createAssistantChangeSet.mockReset();
    client.runAssistantAction.mockReset();
    workspace.navigateTo.mockReset();

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('turns server proposal intent into a review-only ChangeSet without approving or applying it', async () => {
    client.chatWithAssistant.mockResolvedValue({
      message: 'I can prepare that branding change for review.',
      provider: 'local-agent',
      suggestions: [],
      navigation: null,
      proposalIntent: {
        actionName: 'branding.proposeUpdate',
        input: {
          primaryColour: '#112233',
          copyOverrides: {
            'en-GB': {
              basket: 'Basket',
              checkout: 'Checkout',
            },
          },
        },
        mode: 'PROPOSE_ONLY',
        requiresReview: true,
      },
    });
    client.createAssistantChangeSet.mockResolvedValue({
      changeSet: {
        id: 'cs-review-1',
        tenantId: 'tenant-a',
        status: 'APPROVAL_REQUIRED',
        diff: {
          primaryColour: { before: '#000000', after: '#112233' },
        },
        warnings: [],
        affectedResources: [{ type: 'tenantBranding', id: 'tenant-a' }],
      },
      mode: 'PROPOSAL_ONLY',
      autonomousExecutionEnabled: false,
    });

    await act(async () => {
      root.render(<AdminAssistantDrawer open onClose={vi.fn()} />);
    });

    await act(async () => {
      button('What can I customise for this brand?').click();
      await flush();
    });

    expect(container.textContent).toContain('Review proposal');
    expect(container.textContent).toContain('does not approve or apply anything');

    await act(async () => {
      button('Review proposal').click();
      await flush();
    });

    expect(client.createAssistantChangeSet).toHaveBeenCalledTimes(1);
    expect(client.createAssistantChangeSet).toHaveBeenCalledWith(
      'tenant-a',
      expect.objectContaining({
        actions: [{
          actionName: 'branding.proposeUpdate',
          input: expect.objectContaining({ primaryColour: '#112233' }),
        }],
      })
    );
    expect(container.textContent).toContain('Proposal ready for review');
    expect(container.textContent).toContain('APPROVAL_REQUIRED');
    expect(container.textContent).toContain('cs-review-1');
    expect(container.textContent).toContain('nothing has been approved or applied');
    expect(Array.from(container.querySelectorAll('button')).some(
      (candidate) => /approve|apply/i.test(candidate.textContent || '')
    )).toBe(false);
  });

  it('does not expose raw proposal failure text or claim a write occurred', async () => {
    client.chatWithAssistant.mockResolvedValue({
      message: 'I can prepare that branding change for review.',
      provider: 'local-agent',
      suggestions: [],
      navigation: null,
      proposalIntent: {
        actionName: 'branding.proposeUpdate',
        input: { primaryColour: '#112233' },
        mode: 'PROPOSE_ONLY',
        requiresReview: true,
      },
    });
    client.createAssistantChangeSet.mockRejectedValue(
      new Error('Bearer private-provider-detail')
    );

    await act(async () => {
      root.render(<AdminAssistantDrawer open onClose={vi.fn()} />);
      await flush();
    });
    await act(async () => {
      button('What can I customise for this brand?').click();
      await flush();
    });
    await act(async () => {
      button('Review proposal').click();
      await flush();
    });

    expect(container.textContent).toContain('Nothing was approved or applied');
    expect(container.textContent).not.toContain('private-provider-detail');
  });
});
