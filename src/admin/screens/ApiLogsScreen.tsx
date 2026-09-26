import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  RefreshCw,
  Webhook,
} from 'lucide-react';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';

interface ApiLogsScreenProps {
  tenantId: string;
}

const statusClass = (status: string) => {
  const value = String(status || '').toUpperCase();
  if (['PROCESSED', 'CLOSED', 'SUCCESS', 'HEALTHY'].includes(value)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (['FAILED', 'QUEUE_FAILED', 'OPEN', 'ERROR'].includes(value)) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const ApiLogsScreen: React.FC<ApiLogsScreenProps> = ({ tenantId }) => {
  const [data, setData] = useState<any>(null);
  const [trace, setTrace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tracing, setTracing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!defaultAdminClient.getIntegrationApiLogs) {
        throw new Error('API log diagnostics are not available in this build.');
      }
      setData(await defaultAdminClient.getIntegrationApiLogs(tenantId, 100));
    } catch (err: any) {
      setError(err?.message || 'Unable to load API logs.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runTrace = async () => {
    setTracing(true);
    setTrace(null);
    try {
      setTrace(await defaultAdminClient.traceRequest?.({
        tenantId,
        fulfillmentType: 'delivery',
      }));
    } catch (err: any) {
      setTrace({ error: err?.message || 'Commerce trace failed.' });
    } finally {
      setTracing(false);
    }
  };

  const commerceCircuit = useMemo(() => {
    const circuits = data?.circuits || {};
    const key = Object.keys(circuits).find((candidate) => candidate.endsWith(':commerce'));
    return key ? circuits[key] : null;
  }, [data]);

  if (loading && !data) {
    return <div className="p-6 text-sm text-slate-500">Loading API activity…</div>;
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">API Logs</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Safe operational view of what Deliverect sent us, how it was processed, and whether live Commerce verification is healthy.
            Credentials, bearer tokens, HMAC values and customer data are never shown here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runTrace}
            disabled={tracing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Activity className="h-4 w-4" />
            {tracing ? 'Tracing…' : 'Trace Commerce'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Environment</div>
          <div className="mt-1 font-semibold text-slate-900">{data?.integration?.environment || 'Unknown'}</div>
          <div className="mt-1 text-xs text-slate-500">{data?.integration?.credentialMode || 'unknown'} credentials</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Commerce scope</div>
          <div className="mt-1 flex items-center gap-2 font-semibold text-slate-900">
            {data?.integration?.commerceScopeGranted ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            {data?.integration?.commerceScopeGranted ? 'genericCommerce granted' : 'genericCommerce missing'}
          </div>
          <div className="mt-1 text-xs text-slate-500 break-words">
            {(data?.integration?.grantedScopes || []).join(', ') || 'No scopes returned'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Commerce circuit</div>
          <div className="mt-1">
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(commerceCircuit?.state || 'CLOSED')}`}>
              {commerceCircuit?.state || 'CLOSED'}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {commerceCircuit ? `${commerceCircuit.failures || 0} consecutive failures` : 'No failures recorded'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Account / channels</div>
          <div className="mt-1 truncate font-mono text-xs text-slate-800">{data?.integration?.accountId || 'Not mapped'}</div>
          <div className="mt-1 text-xs text-slate-500">{data?.integration?.allowedChannelLinkIds?.length || 0} assigned channel link(s)</div>
        </div>
      </div>

      {!data?.integration?.commerceScopeGranted && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <div className="font-medium text-amber-900">Commerce access needs attention</div>
              <p className="mt-1 text-sm text-amber-800">
                The current OAuth token does not report the genericCommerce scope. Menu Push data can remain available,
                but live Commerce menu verification may return 403 until the configured credential has Commerce access.
              </p>
            </div>
          </div>
        </div>
      )}

      {trace && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Latest Commerce trace</h2>
          {trace.error ? (
            <p className="mt-2 text-sm text-red-700">{trace.error}</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <div className="text-xs uppercase text-slate-500">Result</div>
                <div className="mt-1 font-medium">{trace.overallStatus || trace.status || 'Unknown'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">HTTP</div>
                <div className="mt-1 font-medium">{trace.stage1Upstream?.httpStatus ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-500">Failure</div>
                <div className="mt-1 font-medium break-words">{trace.exactErrorCode || trace.errorCode || 'None'}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Database className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Menu Push processing</h2>
          <span className="text-xs text-slate-500">{data?.menuPushes?.length || 0} recent</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Menu</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Processed</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.menuPushes || []).map((entry: any) => (
                <tr key={entry.eventId}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.receivedAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(entry.status)}`}>{entry.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.menuIds?.join(', ') || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{entry.channelLinkIds?.join(', ') || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.processedAt)}</td>
                  <td className="max-w-xs px-4 py-3 text-xs text-slate-600 break-words">{entry.error || entry.review?.reason || 'OK'}</td>
                </tr>
              ))}
              {!data?.menuPushes?.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No Menu Push activity recorded for this tenant yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Webhook className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Webhook processing</h2>
          <span className="text-xs text-slate-500">{data?.webhooks?.length || 0} recent</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Verified</th>
                <th className="px-4 py-3">Processing</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.webhooks || []).map((entry: any) => (
                <tr key={entry.webhookEventId}>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.receivedAt)}</td>
                  <td className="px-4 py-3">{entry.eventType || 'Unknown'}</td>
                  <td className="px-4 py-3">{entry.verified ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(entry.processingStatus)}`}>{entry.processingStatus}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{entry.errorCode || '—'}</td>
                </tr>
              ))}
              {!data?.webhooks?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No journaled webhook activity recorded for this tenant yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
