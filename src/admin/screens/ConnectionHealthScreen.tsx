import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Store,
  MapPin,
  Layers,
  ArrowRight,
  ShieldCheck,
  Eye,
  Sliders,
  Sparkles,
  Info,
  Clock,
  Radio,
} from 'lucide-react';
import { defaultAdminClient } from '../../commerce/AdminClient';
import { DEFAULT_TENANT_ID } from '../../tenant/constants';
import {
  ConnectionHealthData,
  ConnectionTraceResult,
  ConnectionTraceFailureType,
} from '../../commerce/models';

interface ConnectionHealthScreenProps {
  tenantId?: string;
}

export const ConnectionHealthScreen: React.FC<ConnectionHealthScreenProps> = ({ tenantId = DEFAULT_TENANT_ID }) => {
  const [health, setHealth] = useState<ConnectionHealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogueReviews, setCatalogueReviews] = useState<any[]>([]);
  const [approvingReviewId, setApprovingReviewId] = useState<string | null>(null);

  // Request Trace State
  const [traceResult, setTraceResult] = useState<ConnectionTraceResult | null>(null);
  const [tracing, setTracing] = useState<boolean>(false);
  const [traceFailureType, setTraceFailureType] = useState<ConnectionTraceFailureType | 'NONE'>('NONE');
  const [selectedFulfillment, setSelectedFulfillment] = useState<'delivery' | 'pickup'>('delivery');

  useEffect(() => {
    loadHealth();
  }, [tenantId]);

  const loadHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      if (defaultAdminClient.getConnectionHealth) {
        const data = await defaultAdminClient.getConnectionHealth(tenantId);
        setHealth(data);
      }
      if (defaultAdminClient.listHeldCatalogueReviews) {
        const held = await defaultAdminClient.listHeldCatalogueReviews(tenantId);
        setCatalogueReviews(held.reviews || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve connection health');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCatalogueReview = async (eventId: string) => {
    if (!defaultAdminClient.approveHeldCatalogueReview) return;
    setApprovingReviewId(eventId);
    setError(null);
    try {
      await defaultAdminClient.approveHeldCatalogueReview(tenantId, eventId);
      await loadHealth();
    } catch (err: any) {
      setError(err.message || 'Failed to approve catalogue change');
    } finally {
      setApprovingReviewId(null);
    }
  };

  const handleRunTrace = async (forcedType?: ConnectionTraceFailureType | 'NONE') => {
    setTracing(true);
    const targetType = forcedType !== undefined ? forcedType : traceFailureType;
    try {
      if (defaultAdminClient.traceRequest) {
        const result = await defaultAdminClient.traceRequest({
          tenantId,
          fulfillmentType: selectedFulfillment,
          forceFailureType: targetType === 'NONE' ? undefined : targetType,
        });
        setTraceResult(result);
      }
    } catch (err: any) {
      setError(err.message || 'Trace request execution failed');
    } finally {
      setTracing(false);
    }
  };

  return (
    <div className="space-y-6 text-gray-900">
      {catalogueReviews.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-xs" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-amber-950">
                  {catalogueReviews.length} catalogue change{catalogueReviews.length === 1 ? '' : 's'} need review
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wide rounded-full bg-amber-200 text-amber-900 px-2 py-0.5">
                  Storefront protected
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1">
                Deliverect reported the Menu Push as failed and the previous catalogue remains live until you approve the change.
              </p>
              <div className="mt-3 space-y-2">
                {catalogueReviews.map((item) => (
                  <div key={item.eventId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 p-3">
                    <div className="text-xs text-gray-700">
                      <span className="font-bold text-gray-900">{item.review.removedProductCount} products removed</span>
                      <span className="text-gray-500"> ({item.review.removedPercent}% of {item.review.previousProductCount})</span>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Received {new Date(item.receivedAt).toLocaleString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApproveCatalogueReview(item.eventId)}
                      disabled={approvingReviewId === item.eventId}
                      className="shrink-0 px-3 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {approvingReviewId === item.eventId ? 'Applying…' : 'Approve change'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER & METADATA BAR */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-gray-900 tracking-tight">
                  Connection Status
                </h1>
                {health && (
                  <span
                    className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      health.runtimeMode === 'production'
                        ? 'bg-emerald-100 text-emerald-800'
                        : health.runtimeMode === 'staging'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    Mode: {health.runtimeMode}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                See whether storefront data is flowing correctly from Deliverect through the BFF to the customer UI, with request tracing available for deeper diagnosis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="refresh-health-btn"
              onClick={loadHealth}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Health</span>
            </button>
            <button
              type="button"
              id="run-quick-trace-btn"
              onClick={() => handleRunTrace('NONE')}
              disabled={tracing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
            >
              <Radio className={`w-3.5 h-3.5 ${tracing ? 'animate-pulse' : ''}`} />
              <span>Run Live Trace</span>
            </button>
          </div>
        </div>

        {/* TOP STATUS PILLS */}
        {health && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100 text-xs">
            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-medium uppercase">Resolved Tenant & Host</span>
              <span className="font-bold text-gray-900 truncate block mt-0.5">
                {health.resolvedTenant.name} ({health.resolvedTenant.tenantId})
              </span>
              <span className="text-[11px] text-gray-500 truncate block">{health.hostname}</span>
            </div>

            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-medium uppercase">Deliverect Environment</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.deliverect.connectionState === 'HEALTHY' ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                />
                <span className="font-bold text-gray-900 capitalize">
                  {health.deliverect.environment} ({health.deliverect.status})
                </span>
              </div>
              <span className="text-[11px] text-gray-500 font-mono truncate block">
                {health.deliverect.accountId || 'No Account Mapped'}
              </span>
            </div>

            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-medium uppercase">Last Catalog Sync</span>
              <span className="font-bold text-gray-900 block mt-0.5">
                {health.sync.lastSuccessfulSync
                  ? new Date(health.sync.lastSuccessfulSync).toLocaleTimeString()
                  : 'Never Synced'}
              </span>
              <span className="text-[11px] text-gray-500 truncate block">
                {health.sync.lastSuccessfulSync
                  ? new Date(health.sync.lastSuccessfulSync).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>

            <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100">
              <span className="text-emerald-700 block text-[10px] font-medium uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Security Guarantee
              </span>
              <span className="font-bold text-emerald-900 block mt-0.5">Credentials Redacted</span>
              <span className="text-[11px] text-emerald-700 block">Zero Customer PII Exposed</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* OVERVIEW STATS GRID */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium uppercase">Physical Locations</span>
              <MapPin className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-extrabold text-gray-900">
              {health.counts.physicalLocationsCount}
            </div>
            <span className="text-[10px] text-gray-500">Discovered from account</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium uppercase">Commerce Stores</span>
              <Store className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-extrabold text-gray-900">
              {health.counts.commerceStoresCount}
            </div>
            <span className="text-[10px] text-gray-500">Channel Links</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium uppercase">Raw Products</span>
              <Database className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-extrabold text-indigo-900">
              {health.products.rawProductCount}
            </div>
            <span className="text-[10px] text-gray-500">Upstream payload</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium uppercase">BFF Parsed</span>
              <Layers className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-xl font-extrabold text-purple-900">
              {health.products.parsedProductCount}
            </div>
            <span className="text-[10px] text-gray-500">Normalized products</span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium uppercase">Snoozed / Out</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-amber-900">
              {health.products.snoozedCount}
            </div>
            <span className="text-[10px] text-gray-500">OUT_OF_STOCK</span>
          </div>

          <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/30 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-700 mb-1">
              <span className="text-[11px] font-bold uppercase">Renderable Cards</span>
              <Eye className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-900">
              {health.products.renderableProductCount}
            </div>
            <span className="text-[10px] text-emerald-700">Passed all filters</span>
          </div>
        </div>
      )}

      {/* CHOSEN MENUS INSPECTOR */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Chosen Root Menu (Store Agnostic)
              </h3>
            </div>
            {health.menus.rootMenu ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Menu Name</span>
                  <span className="font-bold text-gray-900">{health.menus.rootMenu.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Menu ID</span>
                  <span className="font-mono text-gray-700">{health.menus.rootMenu.id}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Products in Menu</span>
                  <span className="font-bold text-gray-900">{health.menus.rootMenu.productCount} items</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-2">No root menu resolved.</p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-2xs">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Chosen Store Menu (Authoritative Store Context)
              </h3>
            </div>
            {health.menus.storeMenu ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Menu Name</span>
                  <span className="font-bold text-gray-900">{health.menus.storeMenu.name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Store / ChannelLink</span>
                  <span className="font-mono text-gray-700">{health.menus.storeMenu.channelLinkId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-500">Fulfillment Mode</span>
                  <span className="font-bold capitalize text-emerald-800">{health.menus.storeMenu.fulfillmentType}</span>
                </div>
                <div className="text-[11px] text-gray-500 pt-1">
                  <em>{health.menus.storeMenu.selectionReason}</em>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-2">No store menu resolved or store unselected.</p>
            )}
          </div>
        </div>
      )}

      {/* ANOMALY DETECTION BANNER */}
      {health && health.products.parsedProductCount > 0 && health.products.renderableProductCount === 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Anomaly Alert: Zero Renderable Cards</span>
            <p className="mt-0.5">
              The BFF parsed {health.products.parsedProductCount} products from Deliverect, but 0 cards can be rendered in the storefront.
              All items are either snoozed ({health.products.snoozedCount} OUT_OF_STOCK) or inactive ({health.products.inactiveCount}).
              The system correctly reports <code className="font-mono font-bold">RENDER_FILTERED</code> rather than claiming false success.
            </p>
          </div>
        </div>
      )}

      {/* 5-STAGE REQUEST TRACE CONTROLLER */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-gray-900 text-white text-[10px] font-black uppercase">
                Interactive Telemetry
              </span>
              <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
                Trace One Real Request Across the Full Stack
              </h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Follow a single request from Upstream response → BFF normalization → HTTP client → Hook state → Visible cards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Fulfillment Type"
              value={selectedFulfillment}
              onChange={(e) => setSelectedFulfillment(e.target.value as any)}
              className="text-xs bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 font-medium"
            >
              <option value="delivery">Delivery Menu</option>
              <option value="pickup">Pickup Menu</option>
            </select>

            <button
              type="button"
              onClick={() => handleRunTrace(traceFailureType)}
              disabled={tracing}
              className="px-4 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {tracing ? 'Tracing Stack...' : 'Execute Trace'}
            </button>
          </div>
        </div>

        {/* FORCED FAILURE TEST CHOOSER */}
        <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-gray-500" />
              Trace Simulation & Forced Failure Modes:
            </span>
            <span className="text-[11px] text-gray-500">
              Demonstrates both clean success and distinct failure paths
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <button
              type="button"
              onClick={() => {
                setTraceFailureType('NONE');
                handleRunTrace('NONE');
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                traceFailureType === 'NONE'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              Live Success
            </button>

            <button
              type="button"
              onClick={() => {
                setTraceFailureType('NOT_CONFIGURED');
                handleRunTrace('NOT_CONFIGURED');
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                traceFailureType === 'NOT_CONFIGURED'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              NOT_CONFIGURED
            </button>

            <button
              type="button"
              onClick={() => {
                setTraceFailureType('PERMISSION_DENIED');
                handleRunTrace('PERMISSION_DENIED');
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                traceFailureType === 'PERMISSION_DENIED'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              PERMISSION_DENIED
            </button>

            <button
              type="button"
              onClick={() => {
                setTraceFailureType('UPSTREAM_ERROR');
                handleRunTrace('UPSTREAM_ERROR');
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                traceFailureType === 'UPSTREAM_ERROR'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              UPSTREAM_ERROR
            </button>

            <button
              type="button"
              onClick={() => {
                setTraceFailureType('EMPTY_VALID_RESPONSE');
                handleRunTrace('EMPTY_VALID_RESPONSE');
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                traceFailureType === 'EMPTY_VALID_RESPONSE'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              EMPTY_VALID (200 OK)
            </button>

            <button
              type="button"
              onClick={() => {
                setTraceFailureType('UNMAPPED_LOCATION');
                handleRunTrace('UNMAPPED_LOCATION');
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                traceFailureType === 'UNMAPPED_LOCATION'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                  : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
              }`}
            >
              UNMAPPED_LOCATION
            </button>

            <button
              type="button"
              onClick={() => {
                setTraceFailureType('RENDER_FILTERED');
                handleRunTrace('RENDER_FILTERED');
              }}
              className={`px-2.5 py-2 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${
                traceFailureType === 'RENDER_FILTERED'
                  ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                  : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
              }`}
            >
              RENDER_FILTERED
            </button>
          </div>
        </div>

        {/* 5-STAGE PIPELINE VISUALIZER */}
        {traceResult && (
          <div className="space-y-4 pt-2">
            {/* OVERALL TRACE STATUS BANNER */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                traceResult.overallStatus === 'SUCCESS'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : traceResult.overallStatus === 'ZERO_RENDERABLE_WARNING'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-rose-50 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {traceResult.overallStatus === 'SUCCESS' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : traceResult.overallStatus === 'ZERO_RENDERABLE_WARNING' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm">
                      Trace Result: {traceResult.overallStatus}
                    </span>
                    {traceResult.exactErrorCode && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-black/10">
                        Code: {traceResult.exactErrorCode}
                      </span>
                    )}
                    {traceResult.exactFailureStage && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/10">
                        Stage: {traceResult.exactFailureStage}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 text-gray-700">
                    {traceResult.errorMessage || traceResult.stage5Cards.explanation}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono text-gray-400 hidden sm:block">
                ID: {traceResult.traceId}
              </span>
            </div>

            {/* STAGE CARDS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {/* STAGE 1: UPSTREAM */}
              <div
                className={`rounded-2xl p-3.5 border transition-all ${
                  traceResult.stage1Upstream.status === 'SUCCESS'
                    ? 'bg-white border-gray-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">Stage 1</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      traceResult.stage1Upstream.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {traceResult.stage1Upstream.status}
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-2">Upstream Response</h4>
                <div className="space-y-1 text-[11px] text-gray-600">
                  <div className="flex justify-between">
                    <span>HTTP Code:</span>
                    <span className="font-mono font-bold">{traceResult.stage1Upstream.httpStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency:</span>
                    <span className="font-mono">{traceResult.stage1Upstream.latencyMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Raw Products:</span>
                    <span className="font-bold text-gray-900">{traceResult.stage1Upstream.rawProductsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payload:</span>
                    <span className="font-mono text-[10px]">{traceResult.stage1Upstream.payloadSizeBytes} B</span>
                  </div>
                </div>
              </div>

              {/* STAGE 2: BFF NORMALIZATION */}
              <div
                className={`rounded-2xl p-3.5 border transition-all ${
                  traceResult.stage2Bff.status === 'SUCCESS'
                    ? 'bg-white border-gray-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">Stage 2</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      traceResult.stage2Bff.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {traceResult.stage2Bff.status}
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-2">BFF Normalization</h4>
                <div className="space-y-1 text-[11px] text-gray-600">
                  <div className="flex justify-between">
                    <span>Parsed Items:</span>
                    <span className="font-bold text-gray-900">{traceResult.stage2Bff.parsedProductsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active / Inactive:</span>
                    <span>{traceResult.stage2Bff.activeCount} / {traceResult.stage2Bff.inactiveCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Snoozed:</span>
                    <span className="font-bold text-amber-700">{traceResult.stage2Bff.snoozedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span className="font-mono">{traceResult.stage2Bff.latencyMs} ms</span>
                  </div>
                </div>
              </div>

              {/* STAGE 3: HTTP CLIENT */}
              <div
                className={`rounded-2xl p-3.5 border transition-all ${
                  traceResult.stage3HttpClient.status === 'SUCCESS'
                    ? 'bg-white border-gray-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">Stage 3</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      traceResult.stage3HttpClient.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {traceResult.stage3HttpClient.status}
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-2">HTTP Client</h4>
                <div className="space-y-1 text-[11px] text-gray-600">
                  <div className="flex justify-between">
                    <span>HTTP Status:</span>
                    <span className="font-mono font-bold">{traceResult.stage3HttpClient.httpStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Roundtrip:</span>
                    <span className="font-mono">{traceResult.stage3HttpClient.roundtripLatencyMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivered Items:</span>
                    <span className="font-bold text-gray-900">{traceResult.stage3HttpClient.receivedProductsCount}</span>
                  </div>
                </div>
              </div>

              {/* STAGE 4: HOOK (useCatalog) */}
              <div
                className={`rounded-2xl p-3.5 border transition-all ${
                  traceResult.stage4Hook.status === 'SUCCESS'
                    ? 'bg-white border-gray-200'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">Stage 4</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      traceResult.stage4Hook.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {traceResult.stage4Hook.status}
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-2">React Hook</h4>
                <div className="space-y-1 text-[11px] text-gray-600">
                  <div className="flex justify-between">
                    <span>Hook:</span>
                    <span className="font-mono text-indigo-700 font-bold">{traceResult.stage4Hook.hookName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>State Products:</span>
                    <span className="font-bold text-gray-900">{traceResult.stage4Hook.productsInState}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>State Categories:</span>
                    <span>{traceResult.stage4Hook.categoriesInState}</span>
                  </div>
                </div>
              </div>

              {/* STAGE 5: VISIBLE CARDS */}
              <div
                className={`rounded-2xl p-3.5 border transition-all ${
                  traceResult.stage5Cards.status === 'SUCCESS'
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : traceResult.stage5Cards.status === 'ANOMALY_ZERO_RENDERABLE'
                    ? 'bg-amber-50/80 border-amber-300'
                    : 'bg-rose-50/70 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-gray-400">Stage 5</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      traceResult.stage5Cards.status === 'SUCCESS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : traceResult.stage5Cards.status === 'ANOMALY_ZERO_RENDERABLE'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {traceResult.stage5Cards.status === 'ANOMALY_ZERO_RENDERABLE' ? 'ZERO CARDS' : traceResult.stage5Cards.status}
                  </span>
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-2">Visible Cards</h4>
                <div className="space-y-1 text-[11px] text-gray-600">
                  <div className="flex justify-between">
                    <span>Renderable:</span>
                    <span className="font-extrabold text-emerald-900">{traceResult.stage5Cards.renderableProductsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cards Visible:</span>
                    <span className="font-extrabold text-gray-900">{traceResult.stage5Cards.visibleCardCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dropped by rule:</span>
                    <span className="text-rose-700 font-bold">{traceResult.stage5Cards.filterDropCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STAGE 5 ANOMALY CALLOUT */}
            {traceResult.stage5Cards.zeroRenderableWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                <span className="font-bold block mb-1">
                  ⚠️ Anomaly Confirmed: HTTP 200 returned with 0 visible cards rendered
                </span>
                <p>
                  {traceResult.stage5Cards.explanation}
                </p>
                {Object.keys(traceResult.stage5Cards.filterDropReasons).length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] font-semibold">Drop Breakdown:</span>
                    {Object.entries(traceResult.stage5Cards.filterDropReasons).map(([reason, count]) => (
                      <span key={reason} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px]">
                        {reason}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
