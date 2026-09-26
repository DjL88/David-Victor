// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminUser } from '../../commerce/models';
import { emptyAltieFactsState, type AltieFact, type AltieFactsMutation, type AltieFactsPageData } from '../../altie/knowledgeFacts';

vi.mock('../../commerce/HttpAdminClient', () => ({ defaultAdminClient: { getHeadersAsync: vi.fn() } }));
import { AltieFactsScreen } from './AltieFactsScreen';
import { AltieFactsClientError, type AltieFactsClient } from '../altieFactsClient';

const user = { id: 'super-1', name: 'Super', role: 'platformSuperAdmin', tenantId: 'tenant-a' } as AdminUser;
const note: AltieFact = { id: 'note-one', title: 'Useful fact', body: 'PUBLISHED_NOTE_TEXT for an operator explanation.', aliases: ['marshmallow'], category: 'retail', audience: 'operators', source: '', active: true };
const page = (): AltieFactsPageData => ({ scope: 'PLATFORM', state: { ...emptyAltieFactsState(), draft: [note] }, builtIn: [], builtInVersion: 'test' });
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function makeClient(initial = page()) {
  let server = copy(initial);
  const client = {
    load: vi.fn(async () => copy(server)),
    mutate: vi.fn(async (input: AltieFactsMutation) => {
      if (input.expectedRevision !== server.state.revision) throw new AltieFactsClientError('FACTS_REVISION_CONFLICT');
      const state = { ...copy(server.state), revision: server.state.revision + 1 };
      if (input.action === 'save-draft') state.draft = copy(input.facts);
      if (input.action === 'publish') { state.published = copy(state.draft); state.publishedRevision = state.revision; state.publishedAt = '2026-09-26T12:00:00Z'; }
      if (input.action === 'discard-draft') state.draft = copy(state.published);
      server = { ...server, state };
      return { state, receipt: { revision: state.revision, action: input.action, actorId: user.id, at: '2026-09-26T12:00:00Z', publishedRevision: state.publishedRevision } };
    }),
    history: vi.fn(async () => []),
    exportReference: vi.fn(async () => '# Private reference'),
  };
  return client;
}

let host: HTMLDivElement;
let root: Root;
const btn = (text: string): HTMLButtonElement => {
  const found = Array.from(host.querySelectorAll('button')).find((node) => node.textContent?.trim() === text);
  if (!found) throw new Error(`Button not found: ${text}`);
  return found;
};
const input = (text: string): HTMLInputElement => {
  const label = Array.from(host.querySelectorAll('label')).find((node) => node.textContent?.startsWith(text));
  if (!label) throw new Error(`Label not found: ${text}`);
  return label.querySelector('input')!;
};
const editInput = async (target: HTMLInputElement, value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const render = async (client: AltieFactsClient, actor = user, tenantId = 'tenant-a') => {
  await act(async () => { root.render(<AltieFactsScreen user={actor} tenantId={tenantId} client={client} />); });
};
const click = async (label: string) => { await act(async () => { btn(label).click(); }); };

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(async () => {
  await act(async () => { root.unmount(); }); host.remove(); vi.restoreAllMocks();
});

describe('Altie Facts production component', () => {
  it('does not load or display the library for a non-Super Admin', async () => {
    const client = makeClient();
    await render(client, { ...user, role: 'tenantAdmin' });
    expect(client.load).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Super Admin');
  });

  it('shows unavailable on failed load rather than an editable empty library', async () => {
    const client = makeClient(); client.load.mockRejectedValue(new AltieFactsClientError('FACTS_UNAVAILABLE'));
    await render(client);
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.textContent).not.toContain('No editorial facts in this draft');
    expect(host.querySelector('textarea')).toBeNull();
  });

  it('requires a saved draft and explicit confirmation before publication', async () => {
    const client = makeClient(); await render(client);
    await editInput(input('Title'), 'Edited useful fact');
    expect(btn('Publish saved draft').disabled).toBe(true);
    expect(client.mutate).not.toHaveBeenCalled();
    await click('Save draft');
    expect(client.mutate.mock.calls[0][0]).toMatchObject({ action: 'save-draft', expectedRevision: 0, facts: [expect.objectContaining({ title: 'Edited useful fact' })] });
    expect(host.textContent).toContain('Altie still uses the previously published version');
    expect(btn('Publish saved draft').disabled).toBe(false);
    await click('Publish saved draft');
    expect(window.confirm).toHaveBeenCalled();
    expect(client.mutate.mock.calls[1][0]).toEqual({ action: 'publish', expectedRevision: 1 });
    expect(host.textContent).toContain('Published reference revision 2');
  });

  it('preserves local edits and requires reload after an unconfirmed save', async () => {
    const client = makeClient(); await render(client);
    await editInput(input('Title'), 'Keep this local edit');
    client.mutate.mockRejectedValueOnce(new AltieFactsClientError('FACTS_UNAVAILABLE'));
    await click('Save draft');
    expect(input('Title').value).toBe('Keep this local edit');
    expect(btn('Save draft').disabled).toBe(true);
    expect(host.textContent).not.toContain('Draft saved as revision');
    await click('Reload server');
    expect(input('Title').value).toBe('Keep this local edit');
    expect(host.textContent).toContain('Your local draft is preserved');
  });

  it('drops delayed old-tenant reads when identity scope changes', async () => {
    let resolveOld!: (value: AltieFactsPageData) => void;
    const oldPromise = new Promise<AltieFactsPageData>((resolve) => { resolveOld = resolve; });
    const client = makeClient();
    client.load.mockImplementationOnce(() => oldPromise);
    await render(client, user, 'tenant-a');
    await render(client, user, 'tenant-b');
    const stale = page(); stale.state.draft = [{ ...note, title: 'OLD_SCOPE_SECRET' }];
    await act(async () => { resolveOld(stale); await oldPromise; });
    expect(host.textContent).not.toContain('OLD_SCOPE_SECRET');
    expect(input('Title').value).toBe('Useful fact');
  });

  it('previews published facts only and filters private facts for an operator', async () => {
    const initial = page();
    initial.state.draft = [{ ...note, body: 'DRAFT_ONLY_MARKER explanation.' }];
    initial.state.published = [note, { ...note, id: 'private', title: 'Private reference', body: 'PRIVATE_ONLY_MARKER explanation.', audience: 'superAdmin' }];
    initial.state.publishedRevision = 2; initial.state.revision = 3;
    const client = makeClient(initial); await render(client);
    await editInput(input('Example question'), 'Explain marshmallow');
    const preview = host.querySelector('[aria-live="polite"]')!;
    expect(preview.textContent).toContain('PUBLISHED_NOTE_TEXT');
    expect(preview.textContent).not.toContain('DRAFT_ONLY_MARKER');
    expect(preview.textContent).not.toContain('PRIVATE_ONLY_MARKER');
  });
});
