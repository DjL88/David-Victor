import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Clock3, ExternalLink, ServerCog } from 'lucide-react';
import {
  buildDeliverectChannelEndpoints,
  DELIVERECT_CHANNEL_SETUP_STEPS,
  resolveDeliverectCallbackOrigin,
} from '../../commerce/deliverectChannelSetup';

interface Props {
  tenantId: string;
}

export const DeliverectChannelSetupGuide: React.FC<Props> = ({ tenantId }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const origin = resolveDeliverectCallbackOrigin(
    (import.meta as any).env?.VITE_CHANNEL_PUBLIC_BASE_URL,
    runtimeOrigin
  );
  const endpoints = useMemo(
    () => buildDeliverectChannelEndpoints(origin, tenantId),
    [origin, tenantId]
  );
  const readyEndpoints = endpoints.filter((endpoint) => endpoint.readiness === 'READY');
  const pendingEndpoints = endpoints.filter((endpoint) => endpoint.readiness === 'PENDING_CONTRACT');
  const groups = [
    {
      title: 'Registration',
      description: 'Use these when registering the channel link.',
      keys: ['storeProvisioning', 'channelRegistration'],
    },
    {
      title: 'Catalog & availability',
      description: 'Callbacks used for menu, stock availability and store operations.',
      keys: ['menuUpdate', 'snooze', 'busyMode', 'prepTime'],
    },
    {
      title: 'Orders & picking',
      description: 'Callbacks used after an order is placed.',
      keys: ['orderStatus', 'pickingStatus', 'amendments', 'substitutions'],
    },
  ].map((group) => ({
    ...group,
    endpoints: readyEndpoints.filter((endpoint) => group.keys.includes(endpoint.key)),
  }));

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      // Browser clipboard permissions can be disabled; the URL remains selectable.
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center shrink-0">
          <ServerCog className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Deliverect Channel provisioning</h3>
          <p className="text-xs text-gray-400 mt-1">
            Configure the channel link in this order. Every tenant uses the stable LT ingress domain; the tenant identifier in each path keeps callbacks isolated.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
        <h4 className="text-sm font-semibold text-emerald-200">Copy only the URLs shown below</h4>
        <p className="mt-1 text-xs text-emerald-100/70">
          They are grouped by the matching Deliverect setup section. Endpoints whose provider contract is not confirmed are hidden from the copy-ready list.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Setup order</h4>
          <ol className="space-y-2">
            {DELIVERECT_CHANNEL_SETUP_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-xs text-gray-300">
                <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-200 flex items-center justify-center shrink-0 text-[10px] font-bold">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.title} className="bg-gray-950 border border-gray-800 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-white">{group.title}</h4>
              <p className="mt-1 mb-3 text-[11px] text-gray-500">{group.description}</p>
              <div className="space-y-3">
                {group.endpoints.map((endpoint) => (
                  <div key={endpoint.key} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-gray-200">{endpoint.label}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 className="w-3 h-3" /> Ready</span>
                    </div>
                    <div className="flex gap-2">
                      <input readOnly value={endpoint.url} aria-label={endpoint.label}
                        className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-[11px] text-gray-300" />
                      <button type="button" onClick={() => copy(endpoint.key, endpoint.url)}
                        className="px-3 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:text-white"
                        title={`Copy ${endpoint.label}`}>
                        {copied === endpoint.key ? <CheckCircle2 className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                      </button>
                    </div>
                    {endpoint.note && <p className="mt-2 text-[10px] leading-4 text-gray-500">{endpoint.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pendingEndpoints.length > 0 && (
        <details className="rounded-xl border border-gray-800 bg-gray-950">
          <summary className="cursor-pointer p-4 text-xs font-semibold text-gray-400">
            Reserved endpoints — do not configure ({pendingEndpoints.length})
          </summary>
          <div className="space-y-2 border-t border-gray-800 p-4">
            {pendingEndpoints.map((endpoint) => (
              <div key={endpoint.key} className="flex items-start gap-2 text-[11px] text-gray-500">
                <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span><strong className="text-gray-400">{endpoint.label}:</strong> {endpoint.note || 'Provider contract pending.'}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex items-start gap-2 text-[11px] text-gray-500">
        <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Existing callback routes remain supported for compatibility. Only the copy-ready URLs above should be entered during a new Deliverect setup.
        </span>
      </div>
    </div>
  );
};
