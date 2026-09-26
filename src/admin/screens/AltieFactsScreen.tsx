import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download, History, Plus, RefreshCw, Save, Send } from 'lucide-react';
import type { AdminUser } from '../../commerce/models';
import {
  AltieFactPackSchema, MAX_ALTIE_FACTS, selectPublishedAltieFacts,
  type AltieFact, type AltieFactsPageData, type AltieFactsRevision,
  type AltieFactsMutation, type AltieBuiltInReference,
} from '../../altie/knowledgeFacts';
import { altieFactsClient, AltieFactsClientError, type AltieFactsClient } from '../altieFactsClient';

interface Props { user: AdminUser; tenantId: string; client?: AltieFactsClient; }
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const field = 'w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900';
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';
const explainError = (error: unknown) => error instanceof AltieFactsClientError
  ? error.message : 'The operation could not be confirmed. Local edits are preserved; reload before retrying.';

export function AltieFactsScreen({ user, tenantId, client = altieFactsClient }: Props) {
  if (user.role !== 'platformSuperAdmin') return <p role="alert">Platform Super Admin access is required.</p>;
  // No former identity's draft, response, preview or export survives a scope change.
  return <FactsWorkspace key={`${user.id}:${user.role}:${tenantId}`} client={client} />;
}

function FactsWorkspace({ client }: { client: AltieFactsClient }) {
  const [data, setData] = useState<AltieFactsPageData | null>(null);
  const [draft, setDraft] = useState<AltieFact[]>([]);
  const [aliasText, setAliasText] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [question, setQuestion] = useState('');
  const [previewRole, setPreviewRole] = useState('tenantAdmin');
  const [history, setHistory] = useState<AltieFactsRevision[] | null>(null);
  const request = useRef({ generation: 0, controller: null as AbortController | null });
  const loaded = useRef(false);

  const begin = useCallback(() => {
    request.current.controller?.abort();
    const controller = new AbortController();
    const generation = ++request.current.generation;
    request.current.controller = controller;
    setBusy(true); setError(''); setNotice('');
    return { signal: controller.signal, active: () => !controller.signal.aborted && generation === request.current.generation };
  }, []);

  const load = useCallback(async () => {
    const operation = begin();
    try {
      const next = await client.load(operation.signal);
      if (!operation.active()) return;
      setData(next); setNeedsReload(false); setHistory(null);
      if (!loaded.current) {
        setDraft(clone(next.state.draft)); setAliasText({}); loaded.current = true;
      } else {
        setNotice('Server revision refreshed. Your local draft is preserved; compare it with the server draft before saving.');
      }
    } catch (failure) {
      if (operation.active()) { setError(explainError(failure)); setNeedsReload(true); }
    } finally { if (operation.active()) setBusy(false); }
  }, [begin, client]);

  useEffect(() => {
    void load();
    return () => { request.current.generation += 1; request.current.controller?.abort(); };
  }, [load]);

  const dirty = Boolean(data && JSON.stringify(draft) !== JSON.stringify(data.state.draft));
  const unpublished = Boolean(data && JSON.stringify(data.state.draft) !== JSON.stringify(data.state.published));
  const blocked = busy || !data || needsReload;

  const edit = (id: string, patch: Partial<AltieFact>) => {
    setDraft((facts) => facts.map((fact) => fact.id === id ? { ...fact, ...patch } : fact));
    setNotice('');
  };

  const add = (reference?: AltieBuiltInReference) => {
    if (draft.length >= MAX_ALTIE_FACTS) return;
    setDraft((facts) => [...facts, {
      id: `note-${crypto.randomUUID()}`, title: reference?.title || 'New fact',
      body: reference?.body || '', category: 'app', audience: reference?.audience || 'superAdmin',
      aliases: reference ? [...reference.aliases].slice(0, 12) : [], source: reference?.source || '', active: true,
    }]);
    setNotice('Added to your local draft only. Review the audience and save before publishing.');
  };

  const mutate = async (action: AltieFactsMutation['action']) => {
    if (!data || blocked) return;
    if (action === 'save-draft' && !AltieFactPackSchema.safeParse(draft).success) {
      setError('Each fact needs a title (3–120 characters), explanation (10–2,000 characters), up to 12 aliases and a clean source. Remove secrets and personal data.');
      return;
    }
    if (action === 'publish' && (dirty || !window.confirm(
      `Publish saved revision ${data.state.revision}? Active facts marked “All tenant operators” become reference material for every tenant. Draft changes do not grant Altie any permissions.`
    ))) return;
    if (action === 'discard-draft' && !window.confirm('Replace the saved and local draft with the currently published facts? Previous saved revisions remain in history.')) return;
    const input: AltieFactsMutation = action === 'save-draft'
      ? { action, expectedRevision: data.state.revision, facts: draft }
      : { action, expectedRevision: data.state.revision };
    const operation = begin();
    try {
      const result = await client.mutate(input, operation.signal);
      if (!operation.active()) return;
      setData({ ...data, state: result.state }); setDraft(clone(result.state.draft));
      setAliasText({}); setHistory(null); setNeedsReload(false);
      setNotice(action === 'publish'
        ? `Published reference revision ${result.state.publishedRevision}. New chat requests can retrieve active facts; Altie permissions are unchanged.`
        : action === 'save-draft' ? `Draft saved as revision ${result.state.revision}. Altie still uses the previously published version.`
        : 'Draft restored from the published reference.');
    } catch (failure) {
      if (operation.active()) { setError(explainError(failure)); setNeedsReload(true); }
    } finally { if (operation.active()) setBusy(false); }
  };

  const showHistory = async () => {
    const operation = begin();
    try { const revisions = await client.history(operation.signal); if (operation.active()) setHistory(revisions); }
    catch (failure) { if (operation.active()) setError(explainError(failure)); }
    finally { if (operation.active()) setBusy(false); }
  };

  const exportReference = async () => {
    const operation = begin();
    try {
      const text = await client.exportReference(operation.signal);
      if (!operation.active()) return;
      const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ltx-altie-reference.md';
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
      setNotice('Exported the bundled and published reference only. Treat this file as private; drafts are excluded.');
    } catch (failure) { if (operation.active()) setError(explainError(failure)); }
    finally { if (operation.active()) setBusy(false); }
  };

  const matches = useMemo(() => selectPublishedAltieFacts(data?.state.published || [], question, previewRole), [data, question, previewRole]);
  const builtInMatches = useMemo(() => selectPublishedAltieFacts((data?.builtIn || []).map((entry) => ({
    ...entry, category: 'app' as const, active: true,
  })), question, previewRole), [data, question, previewRole]);
  const visibleBuiltIn = (data?.builtIn || []).filter((reference) =>
    `${reference.title} ${reference.body} ${reference.aliases.join(' ')}`.toLowerCase().includes(search.toLowerCase()));

  return <section className="mx-auto w-full min-w-0 max-w-5xl space-y-6" aria-label="Altie facts">
    <header className="space-y-2">
      <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900"><BookOpen className="h-6 w-6" aria-hidden="true" /> Altie Facts</h1>
      <p className="text-sm text-slate-600">Platform-wide reference library · Super Admin only · independent of the brand selected in the sidebar.</p>
      <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">Teach Altie how the app operates and what retail terms mean. Facts are reference data, not instructions or permissions. Never add secrets, customer/order details or private tenant configuration. New facts default to Super Admin only.</p>
    </header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={button} disabled={busy} onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Reload server</button>
      <button type="button" className={button} disabled={blocked} onClick={() => void showHistory()}><History className="h-4 w-4" aria-hidden="true" /> Revision history</button>
      <button type="button" className={button} disabled={blocked} onClick={() => void exportReference()}><Download className="h-4 w-4" aria-hidden="true" /> Export published reference</button>
    </div>
    {!data ? <p role="status" className="text-sm text-slate-600">{busy ? 'Loading the reference library…' : 'The reference library is unavailable. Reload to try again.'}</p> : <>
      <p className="text-sm text-slate-600">Saved revision {data.state.revision} · Published revision {data.state.publishedRevision || 'none'} · Bundled pack {data.builtInVersion}</p>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Editable facts and synonyms</h2>
        <p className="text-sm text-slate-600">Save a draft, review it, then explicitly publish. Archiving a fact takes effect after publication. Synonyms improve reference matching only; they do not change product IDs or storefront search rules.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={blocked || draft.length >= MAX_ALTIE_FACTS} onClick={() => add()}><Plus className="h-4 w-4" aria-hidden="true" /> Add fact ({draft.length}/{MAX_ALTIE_FACTS})</button>
          <button type="button" className={button} disabled={blocked || !dirty} onClick={() => void mutate('save-draft')}><Save className="h-4 w-4" aria-hidden="true" /> Save draft</button>
          <button type="button" className={`${button} border-slate-900 bg-slate-900 text-white`} disabled={blocked || dirty || !unpublished} onClick={() => void mutate('publish')}><Send className="h-4 w-4" aria-hidden="true" /> Publish saved draft</button>
          <button type="button" className={button} disabled={blocked || (!dirty && !unpublished)} onClick={() => void mutate('discard-draft')}>Restore published draft</button>
        </div>
        {dirty && <p className="text-sm text-amber-800">Local changes are not saved. Publication is disabled until the draft has been saved and reviewed.</p>}
        <details className="rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium">Compare local, saved and published references</summary>
          <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-3">{[['Local draft', draft], ['Saved draft', data.state.draft], ['Published', data.state.published]].map(([label, facts]) => <div key={String(label)} className="min-w-0"><h3 className="font-medium">{String(label)}</h3>{(facts as AltieFact[]).map((fact) => <p key={fact.id} className="mt-2 break-words text-xs"><strong>{fact.title}</strong> · {fact.audience} · {fact.active ? 'Active' : 'Archived'}<br />{fact.body}<br />Aliases: {fact.aliases.join(', ')}</p>)}</div>)}</div>
          <button type="button" className={`${button} mt-3`} disabled={blocked} onClick={() => { if (window.confirm('Replace local edits with the current saved draft?')) { setDraft(clone(data.state.draft)); setAliasText({}); } }}>Use saved server draft locally</button>
        </details>
        {draft.length === 0 && <p className="text-sm text-slate-500">No editorial facts in this draft. Bundled references remain available below.</p>}
        <fieldset disabled={blocked} className="min-w-0 space-y-3">
          <legend className="sr-only">Draft fact editor</legend>
          {draft.map((fact) => <details key={fact.id} open className="min-w-0 rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer break-words font-medium">{fact.title || 'Untitled fact'} {!fact.active && '(archived in draft)'}</summary>
            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm sm:col-span-2">Title<input className={field} value={fact.title} maxLength={120} onChange={(event) => edit(fact.id, { title: event.target.value })} /></label>
              <label className="text-sm">Category<select className={field} value={fact.category} onChange={(event) => edit(fact.id, { category: event.target.value as AltieFact['category'] })}><option value="app">Application</option><option value="retail">Retail terminology</option><option value="deliverect">Deliverect reference</option><option value="operations">Operations guidance</option></select></label>
              <label className="text-sm">Audience<select className={field} value={fact.audience} onChange={(event) => edit(fact.id, { audience: event.target.value as AltieFact['audience'] })}><option value="superAdmin">Super Admin only</option><option value="operators">All tenant operators</option></select></label>
              {fact.audience === 'operators' && <p className="text-xs text-amber-800 sm:col-span-2">After publication, this fact can inform answers for all tenants. Do not put tenant-specific or private information here.</p>}
              <label className="min-w-0 text-sm sm:col-span-2">Fact or explanation<textarea className={`${field} min-h-32`} value={fact.body} maxLength={2000} onChange={(event) => edit(fact.id, { body: event.target.value })} /><span className="text-xs text-slate-500">{fact.body.length}/2,000 characters · plain reference text</span></label>
              <label className="min-w-0 text-sm sm:col-span-2">Synonyms / matching phrases, separated by commas<input className={field} value={aliasText[fact.id] ?? fact.aliases.join(', ')} onChange={(event) => { const value = event.target.value; setAliasText((previous) => ({ ...previous, [fact.id]: value })); edit(fact.id, { aliases: value.split(',').map((part) => part.trim()).filter(Boolean) }); }} /><span className="text-xs text-slate-500">Up to 12 phrases. These select reference facts, never product identity.</span></label>
              <label className="min-w-0 text-sm sm:col-span-2">Source or reference<input className={field} value={fact.source} maxLength={240} onChange={(event) => edit(fact.id, { source: event.target.value })} /><span className="text-xs text-slate-500">Repository path or clean HTTPS URL. Links are not automatically fetched or certified.</span></label>
              <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={fact.active} onChange={(event) => edit(fact.id, { active: event.target.checked })} /> Active after publication (untick to archive)</label>
            </div>
          </details>)}
        </fieldset>
      </section>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Test reference matching</h2>
        <p className="text-sm text-slate-600">Preview the new bundled pack and published editorial matches only. No AI call, live data lookup or action is performed. Altie also receives his existing page knowledge and safety context.</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="min-w-0 text-sm">Example question<input className={field} value={question} maxLength={500} onChange={(event) => setQuestion(event.target.value)} placeholder="Why has this line disappeared?" /></label><label className="text-sm">Preview as<select className={field} value={previewRole} onChange={(event) => setPreviewRole(event.target.value)}><option value="tenantAdmin">Tenant operator</option><option value="platformSuperAdmin">Super Admin</option></select></label></div>
        {question && <div aria-live="polite" className="space-y-2 text-sm">{[...builtInMatches, ...matches].map((fact) => <p key={fact.id} className="break-words rounded-lg bg-slate-50 p-3"><strong>{fact.title}</strong><br />{fact.body}</p>)}{builtInMatches.length + matches.length === 0 && <p>No matching published reference. Try a configured synonym; drafts are deliberately excluded.</p>}</div>}
      </section>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Bundled app, retail and Deliverect reference</h2>
        <p className="text-sm text-slate-600">Reviewed with the application release. You can copy a reference into an editorial draft, but core behaviour and safety rules remain maintained in code.</p>
        <label className="block text-sm">Find a reference<input className={field} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {visibleBuiltIn.map((reference) => <details key={reference.id} className="min-w-0 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer break-words font-medium">{reference.title}</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm">{reference.body}</p><p className="mt-2 break-words text-xs text-slate-500">{reference.source} · Reviewed {reference.reviewedAt} · {reference.audience}</p><button type="button" className={`${button} mt-3`} disabled={blocked || draft.length >= MAX_ALTIE_FACTS} onClick={() => add(reference)}>Copy to editable draft</button></details>)}
      </section>
      {history && <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-semibold">Latest saved revisions</h2><p className="text-sm text-slate-600">Each saved revision includes an immutable full snapshot and actor audit, committed atomically. Showing the latest 20 summaries; automated rollback is not part of this starter.</p>{history.length ? history.map((revision) => <p key={revision.revision} className="break-words text-sm">Revision {revision.revision} · {revision.action} · {revision.at} · actor {revision.actorId}</p>) : <p className="text-sm">No saved editorial revisions.</p>}</section>}
    </>}
  </section>;
}
