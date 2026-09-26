import React, { useState, useEffect, useRef } from 'react';
import {
  defaultAnalyticsClient,
  InsightsDashboardData,
  AnalyticsEvent,
  FunnelStageMetric,
  ProductPerformanceMetric,
  StoryPerformanceMetric,
  SearchQueryMetric,
  RegionalMetric,
} from '../../analytics';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { formatCurrency } from '../../utils/formatters';
import {
  TrendingUp,
  Filter,
  BarChart3,
  Film,
  Search,
  Package,
  MapPin,
  Clock,
  ShieldCheck,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  Percent,
  CheckCircle2,
  DollarSign,
  ChevronRight,
  Download,
  Activity,
  Radio,
  Layers,
} from 'lucide-react';

interface InsightsScreenProps {
  tenantId: string;
}

const formatPercent = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'Unknown' : `${value}%`;

const formatKnownNumber = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'Unknown' : value.toLocaleString();

const formatKnownMoney = (
  value: number | null | undefined,
  currency: string | null | undefined,
): string =>
  value === null || value === undefined || !currency ? 'Unknown' : formatCurrency(value, currency);

export const InsightsScreen: React.FC<InsightsScreenProps> = ({ tenantId }) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'funnel'
    | 'products'
    | 'stories'
    | 'search'
    | 'picking'
    | 'regions'
    | 'abandonment'
    | 'telemetry'
    | 'artie'
  >('overview');

  const [data, setData] = useState<InsightsDashboardData | null>(null);
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const dataRequestRef = useRef(0);
  const eventsRequestRef = useRef(0);

  useEffect(() => {
    loadData();
  }, [tenantId, timeframe]);

  useEffect(() => {
    if (activeTab === 'telemetry') {
      loadRecentEvents();
    }
  }, [activeTab, tenantId]);

  const loadData = async () => {
    const requestId = ++dataRequestRef.current;
    setLoading(true);
    setError('');
    try {
      const res = await defaultAnalyticsClient.getInsights(tenantId, timeframe);
      if (requestId !== dataRequestRef.current) return;
      setData(res);
      if (activeTab === 'telemetry') {
        void loadRecentEvents();
      }
    } catch (err) {
      if (requestId !== dataRequestRef.current) return;
      console.error('Failed to load insights:', err);
      setData(null);
      setError('Insights could not be loaded.');
    } finally {
      if (requestId === dataRequestRef.current) setLoading(false);
    }
  };

  const loadRecentEvents = async () => {
    const requestId = ++eventsRequestRef.current;
    setLoadingEvents(true);
    setEventsError('');
    try {
      const events = await defaultAnalyticsClient.getRecentEvents(tenantId, 50);
      if (requestId !== eventsRequestRef.current) return;
      setRecentEvents(events);
    } catch (err) {
      if (requestId !== eventsRequestRef.current) return;
      console.error('Failed to load recent events:', err);
      setRecentEvents([]);
      setEventsError('Telemetry could not be loaded.');
    } finally {
      if (requestId === eventsRequestRef.current) setLoadingEvents(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      await defaultAdminClient.triggerBrowserDownload('analytics', format, tenantId);
    } catch (err) {
      console.error('Failed to export analytics data:', err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Aggregating privacy-sanitized analytics...</span>
      </div>
    );
  }

  if (!data) {
    return <div className="p-12 text-center"><div role="alert" className="text-sm font-semibold text-rose-700">{error || 'Insights are unavailable.'}</div><button type="button" onClick={loadData} className="mt-3 text-xs font-bold text-indigo-700 underline">Retry</button></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 min-w-0">
      {/* HEADER & TIMEFRAME SELECTOR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span>Insights</span>
            </h1>

          </div>
          <p className="text-xs text-gray-500 mt-1">
            Understand storefront conversion, product performance, search and customer journeys.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-2xs max-w-full overflow-x-auto">
            {(['7d', '30d', '90d'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  timeframe === t
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Last {t === '7d' ? '7 Days' : t === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1" />

          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('csv')}
            className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Export analytics telemetry as CSV"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('json')}
            className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-2xs"
            title="Export analytics telemetry as JSON"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* TOP KPI OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Captured GMV
          </span>
          <p className="text-xl font-black text-gray-900 mt-1">
            {formatKnownMoney(data.totalGrossMerchandiseValue, data.evidence.financialCurrency)}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            {data.evidence.financialStatus === 'AVAILABLE'
              ? `${data.evidence.financialCaptureEvents} verified payment capture${data.evidence.financialCaptureEvents === 1 ? '' : 's'}`
              : data.evidence.financialStatus === 'NO_CAPTURE_EVIDENCE'
                ? 'No verified payment-capture evidence'
                : data.evidence.financialStatus === 'MIXED_CURRENCY'
                  ? 'Mixed currencies — no combined GMV'
                  : 'Incomplete payment amount/currency evidence'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Paid Orders
          </span>
          <p className="text-xl font-black text-gray-900 mt-1">
            {formatKnownNumber(data.totalOrders)}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Avg {formatKnownMoney(data.averageOrderValue, data.evidence.financialCurrency)}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Overall Conversion
          </span>
          <p className="text-xl font-black text-indigo-600 mt-1">
            {formatPercent(data.overallConversionRate)}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Landing to Delivered
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Serviceability
          </span>
          <p className="text-xl font-black text-emerald-600 mt-1">
            {formatPercent(data.serviceabilityRate)}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Coverage in address zones
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Pick Success Rate
          </span>
          <p className="text-xl font-black text-emerald-600 mt-1">
            {formatPercent(data.pickingSuccessRate)}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            Quest fulfillment rate
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Total Sessions
          </span>
          <p className="text-xl font-black text-gray-900 mt-1">
            {data.totalSessions.toLocaleString()}
          </p>
          <span className="text-[10px] text-gray-500 mt-1 block">
            De-identified visitors
          </span>
        </div>
      </div>

      {/* ANALYTICS DATA NOTICE */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-4 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">Storefront analytics</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {data.evidence.status === 'EMPTY' ? 'No event data' : `${data.evidence.eventCount} events · latest ${data.evidence.observedAt ? new Date(data.evidence.observedAt).toLocaleString() : 'unknown'}`}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Event-backed metrics only. Missing evidence is shown as Unknown rather than estimated or treated as healthy. Financial totals use server-only payment-capture events and never browser-submitted order totals.
            </p>
          </div>
        </div>
        
      </div>

      {/* SUB-SECTION TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-gray-200 pb-2 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'funnel', label: 'Conversion Funnel', icon: Filter },
          { id: 'products', label: 'Product Performance', icon: Package },
          { id: 'stories', label: 'Stories Analytics', icon: Film },
          { id: 'search', label: 'Search Queries', icon: Search },
          { id: 'artie', label: 'Altie Conversion', icon: TrendingUp },
          { id: 'picking', label: 'Availability & Picking', icon: ShieldCheck },
          { id: 'regions', label: 'Coarse Regions', icon: MapPin },
          { id: 'abandonment', label: 'Basket Abandonment', icon: ShoppingBag },
          { id: 'telemetry', label: 'Live Telemetry Feed', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {(activeTab === 'overview' || activeTab === 'artie') && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Altie recommendation conversion</h3>
            <p className="text-xs text-gray-500 mt-0.5">Strict attribution from recommendation presentation through acceptance to paid order.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] uppercase font-bold text-gray-500">Presented</div><div className="text-xl font-black">{data.artieRecommendations.presented}</div></div>
            <div className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] uppercase font-bold text-gray-500">Accepted</div><div className="text-xl font-black">{data.artieRecommendations.accepted}</div><div className="text-[10px] text-gray-500">{formatPercent(data.artieRecommendations.presentedToAcceptedRate)} of presented</div></div>
            <div className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] uppercase font-bold text-gray-500">Paid</div><div className="text-xl font-black">{data.artieRecommendations.paid}</div><div className="text-[10px] text-gray-500">{formatPercent(data.artieRecommendations.presentedToPaidRate)} of presented</div></div>
            <div className="rounded-xl bg-gray-50 p-3"><div className="text-[10px] uppercase font-bold text-gray-500">Attributed revenue</div><div className="text-xl font-black">{formatKnownMoney(data.artieRecommendations.attributedRevenue, data.evidence.financialCurrency)}</div><div className="text-[10px] text-gray-500">{formatPercent(data.artieRecommendations.acceptedToPaidRate)} accepted → paid</div></div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: CONVERSION FUNNEL */}
      {(activeTab === 'overview' || activeTab === 'funnel') && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>End-to-End Grocery Conversion Funnel</span>
            </h3>
            <span className="text-xs text-gray-500 font-mono">
              Conversion by journey stage
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {data.funnel.map((f, idx) => (
              <div key={f.stage} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-gray-800">
                    {idx + 1}. {f.label}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-600">
                      {f.visitors.toLocaleString()} visitors
                    </span>
                    <span className="font-bold text-indigo-600 w-16 text-right">
                      {f.overallConversion}% conv
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(f.overallConversion, 2)}%` }}
                  />
                </div>

                {f.dropoffRate > 0 && (
                  <div className="text-[10px] text-gray-400 text-right">
                    Drop-off from previous step: -{(f.dropoffRate || 0).toFixed(1)}%
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT: STORIES ANALYTICS */}
      {(activeTab === 'overview' || activeTab === 'stories') && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-600" />
                <span>Story Drops Performance (Direct vs. Assisted Attribution)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Engagement is event-backed. Purchase attribution remains Unknown until a paid story-attribution event exists.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold border-y border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Story Title</th>
                  <th className="py-2.5 px-3">Impressions</th>
                  <th className="py-2.5 px-3">Unique Viewers</th>
                  <th className="py-2.5 px-3">Opens</th>
                  <th className="py-2.5 px-3">Product Clicks</th>
                  <th className="py-2.5 px-3">Add to Baskets</th>
                  <th className="py-2.5 px-3">Captured Sales</th>
                  <th className="py-2.5 px-3">Direct Conv %</th>
                  <th className="py-2.5 px-3">Assisted Conv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.stories.map((st) => (
                  <tr key={st.storyId} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-bold text-gray-900">
                      {st.title || 'Title unavailable'}
                      {st.tag && (
                        <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                          {st.tag}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {st.impressions.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {formatKnownNumber(st.uniqueViewers)}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {st.opens.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {st.productClicks.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {formatKnownNumber(st.addToBaskets)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600">
                      {formatKnownMoney(st.capturedSales, data.evidence.financialCurrency)}
                    </td>
                    <td className="py-3 px-3 font-bold text-indigo-700">
                      {formatPercent(st.directConversionRate)}
                    </td>
                    <td className="py-3 px-3 font-bold text-purple-700">
                      {formatPercent(st.assistedConversionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: PRODUCTS PERFORMANCE */}
      {(activeTab === 'overview' || activeTab === 'products') && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>Product Performance & Quest Fulfillment Metrics</span>
            </h3>
            <span className="text-xs text-gray-500">
              Shows event-backed demand and picking evidence; unavailable attribution is marked Unknown
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold border-y border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Views</th>
                  <th className="py-2.5 px-3">Add to Basket</th>
                  <th className="py-2.5 px-3">Revenue</th>
                  <th className="py-2.5 px-3">OOS Impr</th>
                  <th className="py-2.5 px-3">Quest Substitutions</th>
                  <th className="py-2.5 px-3">Pick Success</th>
                  <th className="py-2.5 px-3">Est. Lost Rev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.products.map((p) => (
                  <tr key={p.plu} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <div className="font-bold text-gray-900">{p.name || 'Name unavailable'}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{p.plu}</div>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{p.category || 'Unknown'}</td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {p.productViews.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {formatKnownNumber(p.addToBasketCount)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-600">
                      {formatKnownMoney(p.revenue, data.evidence.financialCurrency)}
                    </td>
                    <td className="py-3 px-3 font-mono text-amber-600 font-semibold">
                      {formatKnownNumber(p.outOfStockImpressions)}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {p.questSubstitutions}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        {formatPercent(p.pickSuccessRate)}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-rose-600">
                      {formatKnownMoney(p.estimatedLostRevenue, data.evidence.financialCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SEARCH ANALYTICS */}
      {activeTab === 'search' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              <span>Search Queries & Zero-Result Telemetry</span>
            </h3>
            <span className="text-xs text-gray-500">
              Highlights typo opportunities and unmet catalog demand
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold border-y border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Search Query</th>
                  <th className="py-2.5 px-3">Search Frequency</th>
                  <th className="py-2.5 px-3">Results Count</th>
                  <th className="py-2.5 px-3">Result Clicks</th>
                  <th className="py-2.5 px-3">Add to Baskets</th>
                  <th className="py-2.5 px-3">Result Click %</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.searches.map((s, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-bold text-gray-900 font-mono">
                      "{s.query}"
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">{s.frequency}</td>
                    <td className="py-3 px-3 font-mono text-gray-600">{formatKnownNumber(s.resultsCount)}</td>
                    <td className="py-3 px-3 font-mono text-gray-600">{s.resultClicks}</td>
                    <td className="py-3 px-3 font-mono text-gray-600">{formatKnownNumber(s.addToBasketCount)}</td>
                    <td className="py-3 px-3 font-bold text-indigo-600">{s.conversionRate}%</td>
                    <td className="py-3 px-3">
                      {s.resultsCount === 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Zero Results
                        </span>
                      ) : s.resultsCount === null ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200">
                          Result count unavailable
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                          Results observed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: COARSE REGIONAL ANALYTICS */}
      {activeTab === 'regions' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <span>Coarse Regional Geography (GDPR Privacy-Compliant)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Displays only the coarse region actually observed. City/country are never inferred from a region code.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold border-y border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Coarse Region</th>
                  <th className="py-2.5 px-3">Postcode District</th>
                  <th className="py-2.5 px-3">Sessions</th>
                  <th className="py-2.5 px-3">Serviceability %</th>
                  <th className="py-2.5 px-3">No-Store Rate</th>
                  <th className="py-2.5 px-3">Orders</th>
                  <th className="py-2.5 px-3">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.regions.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3 text-gray-700">{r.region}</td>
                    <td className="py-3 px-3 font-mono font-bold text-gray-900">
                      {r.postcodeDistrict || 'Unknown'}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-600">
                      {r.sessions.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-600">
                      {formatPercent(r.serviceabilityRate)}
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-600">
                      {formatPercent(r.noServiceableStoreRate)}
                    </td>
                    <td className="py-3 px-3 font-mono text-gray-800">{formatKnownNumber(r.ordersCount)}</td>
                    <td className="py-3 px-3 font-mono font-bold text-gray-900">
                      {formatKnownMoney(r.revenue, data.evidence.financialCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: BASKET ABANDONMENT */}
      {activeTab === 'abandonment' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
              <span>Basket Abandonment Telemetry</span>
            </h3>
            <span className="text-xs text-gray-500">
              Customer emails/phones remain in external CRM; telemetry tracks non-PII events only
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-500 font-bold block">Abandoned Baskets</span>
              <p className="text-xl font-black text-gray-900 mt-1">
                {formatKnownNumber(data.abandonedBasket[0]?.abandonedCount)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-500 font-bold block">Recovered Sessions</span>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {formatKnownNumber(data.abandonedBasket[0]?.recoveredCount)} ({formatPercent(data.abandonedBasket[0]?.recoveryRate)})
              </p>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-xs text-gray-500 font-bold block">Average Abandoned Value</span>
              <p className="text-xl font-black text-indigo-600 mt-1">
                {formatKnownMoney(data.abandonedBasket[0]?.averageAbandonedValue, data.evidence.financialCurrency)}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <h4 className="text-xs font-bold text-gray-800 mb-2">Most Frequently Abandoned Items</h4>
            <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
              {data.abandonedBasket[0]?.topAbandonedPlus.map((item) => (
                <div key={item.plu} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                  <div>
                    <span className="font-bold text-gray-900">{item.name}</span>
                    <span className="text-gray-400 font-mono ml-2">({item.plu})</span>
                  </div>
                  <span className="font-mono font-bold text-amber-600">
                    {item.frequency} times in abandoned baskets
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: LIVE TELEMETRY FEED */}
      {activeTab === 'telemetry' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Live De-Identified Website Telemetry Log</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Real-time stream of incoming customer interactions. Strictly sanitized to protect user privacy.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRecentEvents}
              disabled={loadingEvents}
              className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingEvents ? 'animate-spin' : ''}`} />
              <span>Refresh Stream</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500 font-bold border-y border-gray-100">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Session Hash</th>
                  <th className="py-2.5 px-3">Store Context</th>
                  <th className="py-2.5 px-3">Target / PLU / Query</th>
                  <th className="py-2.5 px-3">Coarse Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {eventsError ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-rose-700">
                      {eventsError}
                    </td>
                  </tr>
                ) : recentEvents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No telemetry events recorded yet in this window.
                    </td>
                  </tr>
                ) : (
                  recentEvents.map((evt, idx) => (
                    <tr key={evt.id || idx} className="hover:bg-gray-50/50 font-mono">
                      <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                        {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          evt.type.includes('ORDER')
                            ? 'bg-emerald-100 text-emerald-800'
                            : evt.type.includes('BASKET') || evt.type.includes('CHECKOUT')
                            ? 'bg-indigo-100 text-indigo-800'
                            : evt.type.includes('PRODUCT')
                            ? 'bg-blue-100 text-blue-800'
                            : evt.type.includes('SEARCH')
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {evt.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                        {evt.sessionId ? evt.sessionId.slice(0, 12) : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-700 text-[11px]">
                        {evt.storeId || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-medium text-gray-900 text-[11px]">
                        {evt.productPlu || evt.searchTerm || evt.storyId || evt.orderReferenceHash || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-[11px]">
                        {evt.coarseRegion || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
