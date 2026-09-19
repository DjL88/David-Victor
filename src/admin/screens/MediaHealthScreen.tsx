import React, { useState } from 'react';
import { MediaHealth, MediaHealthSummary } from '../../commerce/mediaHealthModels';
import { MOCK_MEDIA_HEALTH_ASSETS, getMediaHealthSummary } from '../../commerce/mediaHealthData';
import {
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Film,
  Package,
  Layers,
} from 'lucide-react';

interface MediaHealthScreenProps {
  tenantId: string;
}

export const MediaHealthScreen: React.FC<MediaHealthScreenProps> = ({ tenantId }) => {
  const [assets, setAssets] = useState<MediaHealth[]>(
    MOCK_MEDIA_HEALTH_ASSETS[tenantId] || MOCK_MEDIA_HEALTH_ASSETS['brand-alpha']
  );
  const [filter, setFilter] = useState<'all' | 'healthy' | 'failing' | 'product' | 'story' | 'cms'>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const summary = getMediaHealthSummary(assets);

  const handleRecheckAll = async () => {
    setIsScanning(true);
    setScanMessage('Auditing all upstream CDN image headers & HTTP response codes...');
    await new Promise((r) => setTimeout(r, 1200));

    // Update timestamps and simulate probe
    setAssets((prev) =>
      prev.map((a) => ({
        ...a,
        lastCheckedAt: new Date().toISOString(),
      }))
    );
    setIsScanning(false);
    setScanMessage('Audit complete. 1 broken CDN link and 1 unreachable media gateway flagged.');
    setTimeout(() => setScanMessage(null), 4000);
  };

  const filteredAssets = assets.filter((a) => {
    if (filter === 'healthy') return a.status === 'healthy';
    if (filter === 'failing') return a.status === 'failing' || a.status === 'unreachable';
    if (filter === 'product') return a.assetType === 'product';
    if (filter === 'story') return a.assetType === 'story';
    if (filter === 'cms') return a.assetType === 'cms';
    return true;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-indigo-600" />
              <span>Media Health & Upstream CDN Resilience</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
              Demo Simulation
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Proactively detects broken product pictures, failing CMS assets, and unavailable Story videos before shoppers do.
          </p>
        </div>

        <button
          type="button"
          disabled={isScanning}
          onClick={handleRecheckAll}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Probing Assets...' : 'Re-check All Media'}</span>
        </button>
      </div>

      {scanMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-indigo-600" />
          <span>{scanMessage}</span>
        </div>
      )}

      {/* SUMMARY KPI METRICS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Total Media Assets
          </span>
          <p className="text-2xl font-black text-gray-900 mt-1">{summary.totalAssets}</p>
          <span className="text-[10px] text-gray-400 mt-1 block">Catalog, Stories & CMS</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Healthy & Cached
          </span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{summary.healthyCount}</p>
          <span className="text-[10px] text-emerald-700 mt-1 block">HTTP 200 OK</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Failing or Expired
          </span>
          <p className="text-2xl font-black text-rose-600 mt-1">{summary.failingCount}</p>
          <span className="text-[10px] text-rose-700 mt-1 block">Branded fallback active</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-2xs">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
            Placeholder Usage
          </span>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {((summary.failingCount / Math.max(summary.totalAssets, 1)) * 100).toFixed(0)}%
          </p>
          <span className="text-[10px] text-amber-700 mt-1 block">Fallback coverage rate</span>
        </div>
      </div>

      {/* FILTER BUTTONS */}
      <div className="flex items-center gap-1.5 border-b border-gray-200 pb-2">
        {[
          { id: 'all', label: 'All Assets' },
          { id: 'failing', label: `Failing (${summary.failingCount})` },
          { id: 'healthy', label: `Healthy (${summary.healthyCount})` },
          { id: 'product', label: 'Products' },
          { id: 'story', label: 'Stories' },
          { id: 'cms', label: 'CMS Pages' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filter === f.id
                ? 'bg-gray-900 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* MEDIA ASSETS TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500 font-bold border-b border-gray-200">
            <tr>
              <th className="py-3 px-4">Asset Reference</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">URL / Host</th>
              <th className="py-3 px-4">Status & Code</th>
              <th className="py-3 px-4">Failure Reason / Health Info</th>
              <th className="py-3 px-4">Last Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredAssets.map((asset) => {
              const isHealthy = asset.status === 'healthy';
              return (
                <tr key={asset.id} className="hover:bg-gray-50/60">
                  <td className="py-3 px-4">
                    <div className="font-bold text-gray-900">{asset.referenceName}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{asset.referenceId}</div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 uppercase">
                      {asset.assetType}
                    </span>
                  </td>

                  <td className="py-3 px-4 max-w-xs truncate font-mono text-[11px] text-gray-600">
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline flex items-center gap-1"
                    >
                      <span className="truncate">{asset.url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 text-gray-400" />
                    </a>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit ${
                        isHealthy
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {isHealthy ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertTriangle className="w-3 h-3" />
                      )}
                      <span>
                        {asset.status.toUpperCase()} ({asset.httpStatus})
                      </span>
                    </span>
                  </td>

                  <td className="py-3 px-4 text-xs">
                    {asset.failureReason ? (
                      <span className="text-rose-700 font-medium">{asset.failureReason}</span>
                    ) : (
                      <span className="text-gray-500 font-mono text-[11px]">
                        Content-Type: {asset.contentType || 'image/jpeg'}
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">
                    {new Date(asset.lastCheckedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
