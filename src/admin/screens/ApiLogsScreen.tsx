import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Webhook } from 'lucide-react';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import {
  getScopeEvidence,
  menuProcessingDetail,
  readApiLogSnapshot,
  readApiLogTrace,
  type ApiLogSnapshot,
  type ApiLogTrace,
} from '../apiLogEvidence';

interface ApiLogsScreenProps { tenantId: string; }

const statusClass = (status: string) => {
  const value = status.toUpperCase();
  if (['PROCESSED', 'CLOSED', 'SUCCESS', 'HEALTHY'].includes(value)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['FAILED', 'QUEUE_FAILED', 'OPEN', 'ERROR'].includes(value)) return 'bg-red-50 text-red-700 border-red-200';
  if (['UNKNOWN', 'NOT OBSERVED'].includes(value)) return 'bg-slate-50 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};
const formatDate = (value?: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};
const displayIdentity = (names: string[], ids: string[]) => (
  <div className="min-w-36">
    <div className="font-medium text-slate-800">{names.join(', ') || 'Name not recorded'}</div>
    <div className="mt-0.5 break-all font-mono text-[11px] text-slate-500">{ids.join(', ') || 'ID not recorded'}</div>
  </div>
);

const sourceEmptyMessage = (
  label: string,
  source: ApiLogSnapshot['sources']['menuPushes'] | undefined
) => {
  if (!source || source.status === 'UNKNOWN') return `${label} activity source has not been observed.`;
  if (source.status === 'UNAVAILABLE') return `${label} activity source is unavailable; an empty result is not confirmed.`;
  if (source.status === 'PARTIAL') return `${label} activity is partial; additional durable history may be unavailable.`;
  return `No ${label} entries were returned by the available source.`;
};

// A new tenant gets a new instance before paint: never render the previous
// tenant's snapshot or diagnostic while its replacement request is pending.
export const ApiLogsScreen: React.FC<ApiLogsScreenProps> = ({ tenantId }) => (
  <TenantApiLogsScreen key={tenantId} tenantId={tenantId} />
);

const TenantApiLogsScreen: React.FC<ApiLogsScreenProps> = ({ tenantId }) => {
  const [data, setData] = useState<ApiLogSnapshot | null>(null);
  const [trace, setTrace] = useState<ApiLogTrace | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracing, setTracing] = useState(false);
  const [error, setError] = useState('');
  const [traceError, setTraceError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const loadGeneration = useRef(0);
  const traceGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError('');
    try {
      if (!defaultAdminClient.getIntegrationApiLogs) throw new Error('API logs unavailable');
      const response = await defaultAdminClient.getIntegrationApiLogs(tenantId, 100);
      if (generation !== loadGeneration.current) return;
      setData(readApiLogSnapshot(response, tenantId));
    } catch {
      if (generation === loadGeneration.current) {
        setError('API logs could not be loaded. Retry or check Connection Status.');
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
    return () => {
      // Ignore responses from unmounted instances and Strict Mode's first run.
      loadGeneration.current += 1;
      traceGeneration.current += 1;
    };
  }, [load]);

  const runTrace = async () => {
    const generation = ++traceGeneration.current;
    setTracing(true);
    setTrace(null);
    setTraceError('');
    try {
      if (!defaultAdminClient.traceRequest) throw new Error('Diagnostics unavailable');
      const response = await defaultAdminClient.traceRequest({ tenantId, fulfillmentType: 'delivery' });
      if (generation !== traceGeneration.current) return;
      setTrace(readApiLogTrace(response, tenantId));
    } catch {
      if (generation === traceGeneration.current) {
        setTraceError('Connection diagnostic unavailable. No live access result has been confirmed.');
      }
    } finally {
      if (generation === traceGeneration.current) setTracing(false);
    }
  };

  const refreshOAuth = async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError('');
    try {
      if (!defaultAdminClient.getIntegrationApiLogs) throw new Error('API logs unavailable');
      const response = await defaultAdminClient.getIntegrationApiLogs(tenantId, 100, true);
      if (generation !== loadGeneration.current) return;
      setData(readApiLogSnapshot(response, tenantId));
    } catch {
      if (generation === loadGeneration.current) {
        setError('OAuth evidence could not be refreshed. The previous snapshot is still shown.');
      }
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  };

  const scopeEvidence = getScopeEvidence(data);
  const commerceCircuit = data?.commerceCircuit;
  const scopeLabel = scopeEvidence === 'REPORTED' ? 'genericCommerce reported'
    : scopeEvidence === 'NOT_REPORTED' ? 'genericCommerce not reported' : 'Scope status unknown';
  const channelIds = data?.integration?.allowedChannelLinkIds;
  const menuPushes = data?.menuPushes || [];
  const filterOptions = useMemo(() => {
    const values = (selector: (entry: typeof menuPushes[number]) => string[]) =>
      Array.from(new Set(menuPushes.flatMap(selector))).filter(Boolean).sort();
    return {
      statuses: values((entry) => [entry.status]),
      accounts: values((entry) => [...entry.accountNames, ...entry.accountIds]),
      channels: values((entry) => [...entry.channelNames, ...entry.channelLinkIds]),
      locations: values((entry) => [...entry.locationNames, ...entry.locationIds]),
    };
  }, [menuPushes]);
  const filteredMenuPushes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return menuPushes.filter((entry) => {
      const allValues = [
        entry.eventId, entry.status,
        ...entry.menuNames, ...entry.menuIds,
        ...entry.accountNames, ...entry.accountIds,
        ...entry.channelNames, ...entry.channelLinkIds,
        ...entry.locationNames, ...entry.locationIds,
      ];
      if (needle && !allValues.some((value) => value.toLowerCase().includes(needle))) return false;
      if (statusFilter && entry.status !== statusFilter) return false;
      if (accountFilter && ![...entry.accountNames, ...entry.accountIds].includes(accountFilter)) return false;
      if (channelFilter && ![...entry.channelNames, ...entry.channelLinkIds].includes(channelFilter)) return false;
      if (locationFilter && ![...entry.locationNames, ...entry.locationIds].includes(locationFilter)) return false;
      return true;
    });
  }, [menuPushes, query, statusFilter, accountFilter, channelFilter, locationFilter]);

  if (loading && !data) return <div role="status" className="p-6 text-sm text-slate-500">Loading API activity…</div>;

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">API Logs</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Recorded Menu Push and webhook processing metadata for the selected tenant. This is not a complete request/response capture.
          </p>
          {data && <p className="mt-1 text-xs text-slate-500">Snapshot: {formatDate(data.generatedAt)}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refreshOAuth()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh OAuth evidence
          </button>
          <button type="button" onClick={runTrace} disabled={tracing || !defaultAdminClient.traceRequest}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Activity className="h-4 w-4" aria-hidden="true" />
            {tracing ? 'Checking…' : 'Run connection diagnostic'}
          </button>
          <button type="button" onClick={() => void load()} disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh
          </button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>{error}</p>
        {data && <p className="mt-1">Showing the last successful snapshot for this tenant; it may be out of date.</p>}
      </div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Environment</div>
          <div className="mt-1 font-semibold text-slate-900">{data?.integration?.environment || 'Unknown'}</div>
          <div className="mt-1 text-xs text-slate-500">{data?.integration?.credentialMode ? `${data.integration.credentialMode} credentials` : 'Credential mode not observed'}</div>
          <div className="mt-1 break-all text-xs text-slate-500">Callbacks: {data?.integration?.publicBaseUrl || 'Not observed'}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Commerce scope evidence</div>
          <div className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
            {scopeEvidence === 'REPORTED' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />}
            {scopeLabel}
          </div>
          <div className="mt-1 text-xs text-slate-500 break-words">{(data?.integration?.grantedScopes || []).join(', ') || 'No scope evidence returned; missing permission is not established.'}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Commerce circuit</div>
          <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(commerceCircuit?.state || 'Not observed')}`}>
            {commerceCircuit?.state || 'Not observed'}
          </span>
          <div className="mt-1 text-xs text-slate-500">{commerceCircuit?.failures != null ? `${commerceCircuit.failures} consecutive failures` : 'Failure count not observed'}</div>
          <p className="mt-1 text-xs text-slate-500">Process-local circuit state is not proof that live menu access is healthy.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Account / channels</div>
          <div className="mt-1 text-sm font-medium text-slate-800">{data?.integration?.accountName || 'Account name not observed'}</div>
          <div className="mt-0.5 break-all font-mono text-xs text-slate-600">{data?.integration?.accountId || (data?.integration ? 'Not mapped' : 'Not observed')}</div>
          <div className="mt-1 text-xs text-slate-500">Channel: {data?.integration?.channelName || 'Not observed'}</div>
          <div className="mt-1 text-xs text-slate-500">{channelIds ? `${channelIds.length} assigned channel link(s)` : 'Channel assignments not observed'}</div>
        </div>
      </div>

      {scopeEvidence === 'NOT_REPORTED' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        genericCommerce was not included in the returned scope list. Compare this with an actual Commerce response before changing credentials. A listed scope alone also does not prove access to the mapped account or channel.
      </div>}

      {(trace || traceError) && <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Connection diagnostic">
        <h2 className="font-semibold text-slate-900">Latest connection diagnostic</h2>
        <p className="mt-1 text-xs text-slate-500">Reported by the server diagnostic; not a saved API request/response capture.</p>
        {traceError ? <p role="alert" className="mt-2 text-sm text-red-700">{traceError}</p> : trace && <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div><div className="text-xs uppercase text-slate-500">Reported result</div><div className="mt-1 font-medium">{trace.result}</div></div>
          <div><div className="text-xs uppercase text-slate-500">Reported HTTP</div><div className="mt-1 font-medium">{trace.httpStatus ?? 'Not reported'}</div></div>
          <div><div className="text-xs uppercase text-slate-500">Reported error code</div><div className="mt-1 break-words font-medium">{trace.failureCode || 'Not reported'}</div></div>
        </div>}
      </section>}

      <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Database className="h-4 w-4 text-slate-500" aria-hidden="true" /><h2 className="font-semibold text-slate-900">Menu Push processing</h2>
          {data && <span className="text-xs text-slate-500">{filteredMenuPushes.length} shown / {data.menuPushes.length} loaded · source {data.sources.menuPushes.status.toLowerCase()}</span>}
        </div>
        <div className="grid gap-2 border-b border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Menu Push filters">
          <label className="text-xs font-medium text-slate-600">Search
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, ID or event"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
          </label>
          {([
            ['Status', statusFilter, setStatusFilter, filterOptions.statuses],
            ['Account', accountFilter, setAccountFilter, filterOptions.accounts],
            ['Channel', channelFilter, setChannelFilter, filterOptions.channels],
            ['Location', locationFilter, setLocationFilter, filterOptions.locations],
          ] as Array<[string, string, React.Dispatch<React.SetStateAction<string>>, string[]]>).map(([label, value, setter, options]) => (
            <label key={label} className="text-xs font-medium text-slate-600">{label}
              <select value={value} onChange={(event) => setter(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900">
                <option value="">All {label.toLowerCase()}s</option>
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="overflow-x-auto" role="region" aria-label="Menu Push activity" tabIndex={0}>
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
              {['Received', 'Status', 'Menu', 'Account', 'Channel', 'Location', 'Processed', 'Detail'].map((label) => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMenuPushes.map((entry) => <tr key={entry.eventId}>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.receivedAt)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(entry.status)}`}>{entry.status}</span></td>
                <td className="px-4 py-3 text-xs">{displayIdentity(entry.menuNames, entry.menuIds)}</td>
                <td className="px-4 py-3 text-xs">{displayIdentity(entry.accountNames, entry.accountIds)}</td>
                <td className="px-4 py-3 text-xs">{displayIdentity(entry.channelNames, entry.channelLinkIds)}</td>
                <td className="px-4 py-3 text-xs">{displayIdentity(entry.locationNames, entry.locationIds)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.processedAt)}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-slate-600 break-words">
                  <p>{menuProcessingDetail(entry)}</p>
                  <details className="mt-1"><summary className="cursor-pointer underline">Event reference</summary><p className="mt-1 break-all font-mono">{entry.eventId}</p></details>
                </td>
              </tr>)}
              {filteredMenuPushes.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">{data?.menuPushes.length ? 'No Menu Push entries match the current filters.' : data ? sourceEmptyMessage('Menu Push', data.sources.menuPushes) : 'Menu Push activity has not been loaded.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Webhook className="h-4 w-4 text-slate-500" aria-hidden="true" /><h2 className="font-semibold text-slate-900">Webhook processing</h2>
          {data && <span className="text-xs text-slate-500">{data.webhooks.length} loaded · source {data.sources.webhooks.status.toLowerCase()}</span>}
        </div>
        <div className="overflow-x-auto" role="region" aria-label="Webhook activity" tabIndex={0}>
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
              {['Received', 'Type', 'Verified', 'Processing', 'Error'].map((label) => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.webhooks || []).map((entry) => <tr key={entry.webhookEventId}>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.receivedAt)}</td><td className="px-4 py-3">{entry.eventType}</td>
                <td className="px-4 py-3">{entry.verified === true ? 'Yes' : entry.verified === false ? 'No' : 'Not recorded'}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(entry.processingStatus)}`}>{entry.processingStatus}</span></td>
                <td className="px-4 py-3 text-xs text-slate-600">{entry.errorCode || 'Not recorded'}</td>
              </tr>)}
              {!data?.webhooks.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">{data ? sourceEmptyMessage('Webhook', data.sources.webhooks) : 'Webhook activity has not been loaded.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
