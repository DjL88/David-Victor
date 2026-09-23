import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clipboard, Clock3, ExternalLink, ServerCog } from 'lucide-react';
import {
  buildDeliverectChannelEndpoints,
  DELIVERECT_CHANNEL_SETUP_STEPS,
} from '../../commerce/deliverectChannelSetup';

interface Props {
  tenantId: string;
}

export const DeliverectChannelSetupGuide: React.FC<Props> = ({ tenantId }) => {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const endpoints = useMemo(
    () => buildDeliverectChannelEndpoints(origin, tenantId),
    [origin, tenantId]
  );

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
            Configure the channel link in this order. URLs are generated for this brand so they can be copied directly into Deliverect.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Setup order</h4>
          <ol className="space-y-2">
            {DELIVERECT_CHANNEL_SETUP_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-xs text-gray-300">
                <span className="w-5 h-5 rounded-full bg-gray-800 text-gray-200 flex items-center justify-center shrink-0 text-[10px] font-bold">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
            Registration and activation may be initiated from Deliverect itself. After Save, use the three-dot menu → Register → Activate.
          </div>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Endpoint checklist</h4>
          <div className="space-y-3">
            {endpoints.map((endpoint) => (
              <div key={endpoint.key} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-medium text-gray-200">{endpoint.label}</span>
                  {endpoint.readiness === 'READY' ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> Ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                      <Clock3 className="w-3 h-3" /> Contract pending
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={endpoint.url}
                    className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-[11px] text-gray-300"
                  />
                  <button
                    type="button"
                    onClick={() => copy(endpoint.key, endpoint.url)}
                    className="px-3 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:text-white"
                    title="Copy URL"
                  >
                    {copied === endpoint.key ? <CheckCircle2 className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                  </button>
                </div>
                {endpoint.note && (
                  <p className="mt-2 text-[10px] leading-4 text-gray-500">{endpoint.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-gray-500">
        <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Do not paste URLs marked “Contract pending” into Deliverect yet. They are reserved so the final Channel payload contract can be enabled without changing the setup model.
        </span>
      </div>
    </div>
  );
};
