import React, { useState, useEffect, useMemo } from 'react';
import type { SearchOptimisationConfig } from '../../commerce/searchMerchModels';
import { DEFAULT_SEARCH_CONFIG, setActiveSearchConfig } from '../../commerce/searchMerchEngine';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import {
  buildSearchMerchEntityOptions,
  resolveSearchMerchTargetName,
  type SearchMerchEntityOptions,
} from '../searchMerchEntityOptions';
import {
  Search,
  ArrowRight,
  Pin,
  TrendingUp,
  Ban,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

interface SearchMerchScreenProps {
  tenantId: string;
}

type LoadState = 'loading' | 'ready' | 'empty' | 'error';

const createEmptySearchConfig = (tenantId: string): SearchOptimisationConfig => ({
  ...DEFAULT_SEARCH_CONFIG,
  tenantId,
  typoAliases: [],
  synonyms: [],
  queryRewrites: [],
  pinnedProducts: [],
  boostRules: [],
  excludedProductPlus: [],
});

const EMPTY_ENTITY_OPTIONS: SearchMerchEntityOptions = {
  products: [],
  categories: [],
  brands: [],
};

export const SearchMerchScreen: React.FC<SearchMerchScreenProps> = ({ tenantId }) => {
  const commerceClient = useMemo(() => getCommerceClient(tenantId), [tenantId]);
  const [config, setConfig] = useState<SearchOptimisationConfig>(() => createEmptySearchConfig(tenantId));
  const [activeTab, setActiveTab] = useState<'typos' | 'synonyms' | 'rewrites' | 'pins' | 'boosts' | 'exclusions'>('typos');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [configLoadState, setConfigLoadState] = useState<LoadState>('loading');
  const [configLoadError, setConfigLoadError] = useState<string | null>(null);
  const [catalogLoadState, setCatalogLoadState] = useState<LoadState>('loading');
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null);
  const [entityOptions, setEntityOptions] = useState<SearchMerchEntityOptions>(EMPTY_ENTITY_OPTIONS);

  useEffect(() => {
    let isMounted = true;
    const freshConfig = createEmptySearchConfig(tenantId);
    setConfig(freshConfig);
    setActiveSearchConfig(freshConfig);
    setSaveSuccess(false);
    setSaveError(null);
    setConfigLoadError(null);
    setConfigLoadState('loading');

    Promise.resolve(defaultAdminClient.getSearchConfig?.(tenantId))
      .then((remote: SearchOptimisationConfig | null | undefined) => {
        if (!isMounted) return;
        if (!remote) throw new Error('Search configuration returned no data.');
        const scopedConfig = { ...remote, tenantId };
        setConfig(scopedConfig);
        setActiveSearchConfig(scopedConfig);
        setConfigLoadState('ready');
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setConfig(createEmptySearchConfig(tenantId));
        setConfigLoadError(err?.message || 'Search configuration could not be loaded.');
        setConfigLoadState('error');
      });

    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  useEffect(() => {
    let isMounted = true;
    setEntityOptions(EMPTY_ENTITY_OPTIONS);
    setCatalogLoadError(null);
    setCatalogLoadState('loading');

    commerceClient
      .getRootCatalog()
      .then((catalog) => {
        if (!isMounted) return;
        const next = buildSearchMerchEntityOptions(catalog.products || [], catalog.categories || []);
        setEntityOptions(next);
        setCatalogLoadState(
          next.products.length > 0 || next.categories.length > 0 || next.brands.length > 0
            ? 'ready'
            : 'empty',
        );
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setEntityOptions(EMPTY_ENTITY_OPTIONS);
        setCatalogLoadError(err?.message || 'Live catalogue suggestions could not be loaded.');
        setCatalogLoadState('error');
      });

    return () => {
      isMounted = false;
    };
  }, [commerceClient, tenantId]);

  // New item draft states
  const [newTypo, setNewTypo] = useState({ typo: '', resolvesTo: '' });
  const [newSynonym, setNewSynonym] = useState({ term: '', synonyms: '' });
  const [newRewrite, setNewRewrite] = useState({ incomingQuery: '', rewrittenQuery: '' });
  const [newPin, setNewPin] = useState({ query: '', productPlu: '', position: 1 });
  const [newBoost, setNewBoost] = useState({
    type: 'product' as const,
    targetId: '',
    targetName: '',
    boostMultiplier: 1.5,
  });
  const [newExclusionPlu, setNewExclusionPlu] = useState('');

  useEffect(() => {
    setNewTypo({ typo: '', resolvesTo: '' });
    setNewSynonym({ term: '', synonyms: '' });
    setNewRewrite({ incomingQuery: '', rewrittenQuery: '' });
    setNewPin({ query: '', productPlu: '', position: 1 });
    setNewBoost({ type: 'product', targetId: '', targetName: '', boostMultiplier: 1.5 });
    setNewExclusionPlu('');
  }, [tenantId]);

  const handleSave = async () => {
    if (configLoadState !== 'ready') {
      setSaveError('Search rules are not loaded for this tenant yet, so saving is disabled.');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const scopedConfig = {
        ...config,
        tenantId,
        updatedAt: new Date().toISOString(),
      };
      setActiveSearchConfig(scopedConfig);
      if (defaultAdminClient.updateSearchConfig) {
        await defaultAdminClient.updateSearchConfig(tenantId, scopedConfig);
      } else {
        throw new Error('Search configuration updates are not available in this Admin client.');
      }
      setConfig(scopedConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save search config to BFF');
    } finally {
      setIsSaving(false);
    }
  };

  // Add typo alias
  const addTypo = () => {
    if (!newTypo.typo.trim() || !newTypo.resolvesTo.trim()) return;
    setConfig((prev) => ({
      ...prev,
      typoAliases: [
        ...prev.typoAliases,
        {
          id: `typo_${Date.now()}`,
          typo: newTypo.typo.trim(),
          resolvesTo: newTypo.resolvesTo.trim(),
          isActive: true,
        },
      ],
    }));
    setNewTypo({ typo: '', resolvesTo: '' });
  };

  const removeTypo = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      typoAliases: prev.typoAliases.filter((t) => t.id !== id),
    }));
  };

  // Add Synonym
  const addSynonym = () => {
    if (!newSynonym.term.trim() || !newSynonym.synonyms.trim()) return;
    const synList = newSynonym.synonyms
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setConfig((prev) => ({
      ...prev,
      synonyms: [
        ...prev.synonyms,
        {
          id: `syn_${Date.now()}`,
          term: newSynonym.term.trim(),
          synonyms: synList,
          isActive: true,
        },
      ],
    }));
    setNewSynonym({ term: '', synonyms: '' });
  };

  const removeSynonym = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      synonyms: prev.synonyms.filter((s) => s.id !== id),
    }));
  };

  // Add Rewrite
  const addRewrite = () => {
    if (!newRewrite.incomingQuery.trim() || !newRewrite.rewrittenQuery.trim()) return;
    setConfig((prev) => ({
      ...prev,
      queryRewrites: [
        ...prev.queryRewrites,
        {
          id: `qr_${Date.now()}`,
          incomingQuery: newRewrite.incomingQuery.trim(),
          rewrittenQuery: newRewrite.rewrittenQuery.trim(),
          isActive: true,
        },
      ],
    }));
    setNewRewrite({ incomingQuery: '', rewrittenQuery: '' });
  };

  const removeRewrite = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      queryRewrites: prev.queryRewrites.filter((r) => r.id !== id),
    }));
  };

  // Add Pin
  const addPin = () => {
    if (!newPin.query.trim() || !newPin.productPlu.trim()) return;
    setConfig((prev) => ({
      ...prev,
      pinnedProducts: [
        ...prev.pinnedProducts,
        {
          id: `pin_${Date.now()}`,
          query: newPin.query.trim(),
          productPlu: newPin.productPlu.trim(),
          position: Number(newPin.position) || 1,
          isActive: true,
        },
      ],
    }));
    setNewPin({ query: '', productPlu: '', position: 1 });
  };

  const removePin = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      pinnedProducts: prev.pinnedProducts.filter((p) => p.id !== id),
    }));
  };

  // Add Boost
  const addBoost = () => {
    if (!newBoost.targetId.trim()) return;
    const resolvedTargetName = resolveSearchMerchTargetName(
      newBoost.type,
      newBoost.targetId,
      entityOptions,
    );
    setConfig((prev) => ({
      ...prev,
      boostRules: [
        ...prev.boostRules,
        {
          id: `boost_${Date.now()}`,
          type: newBoost.type,
          targetId: newBoost.targetId.trim(),
          targetName: newBoost.targetName.trim() || resolvedTargetName || newBoost.targetId.trim(),
          boostMultiplier: Number(newBoost.boostMultiplier) || 1.5,
          isActive: true,
        },
      ],
    }));
    setNewBoost({ type: 'product', targetId: '', targetName: '', boostMultiplier: 1.5 });
  };

  const removeBoost = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      boostRules: prev.boostRules.filter((b) => b.id !== id),
    }));
  };

  // Add Exclusion
  const addExclusion = () => {
    if (!newExclusionPlu.trim()) return;
    setConfig((prev) => ({
      ...prev,
      excludedProductPlus: [...prev.excludedProductPlus, newExclusionPlu.trim()],
    }));
    setNewExclusionPlu('');
  };

  const removeExclusion = (plu: string) => {
    setConfig((prev) => ({
      ...prev,
      excludedProductPlus: prev.excludedProductPlus.filter((p) => p !== plu),
    }));
  };

  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-6 p-4 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Search className="w-5 h-5 text-indigo-600" />
            <span>Search & Recommendations</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Improve search relevance, synonyms, rewrites and product/category ranking without changing the provider-managed catalogue.
          </p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
          {saveError && (
            <span className="text-xs font-bold text-red-700 flex items-center gap-1 bg-red-50 px-3 py-1.5 rounded-xl border border-red-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {saveError}
            </span>
          )}
          {saveSuccess && (
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              Search configuration saved
            </span>
          )}
          <button
            type="button"
            disabled={isSaving || configLoadState !== 'ready'}
            onClick={handleSave}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isSaving || configLoadState === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isSaving ? 'Deploying...' : configLoadState === 'loading' ? 'Loading rules…' : 'Deploy Search Rules'}</span>
          </button>
        </div>
      </div>

      {configLoadState === 'loading' && (
        <div aria-live="polite" className="rounded-xl border border-gray-200 bg-white p-3.5 text-xs font-semibold text-gray-600">
          Loading saved search rules for this tenant…
        </div>
      )}
      {configLoadState === 'error' && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
          Search rules for this tenant are unavailable: {configLoadError || 'Unknown error'}. Existing settings have not been replaced; saving stays disabled until a successful reload.
        </div>
      )}

      {catalogLoadState === 'loading' && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-xs font-semibold text-gray-600" aria-live="polite">
          Loading live product, category and brand suggestions…
        </div>
      )}
      {catalogLoadState === 'error' && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          Live catalogue suggestions are unavailable: {catalogLoadError || 'Unknown error'}. You can still enter exact PLUs, category IDs or brand names manually.
        </div>
      )}
      {catalogLoadState === 'empty' && (
        <div role="status" className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs font-semibold text-gray-600">
          This tenant currently has no catalogue suggestions. Manual values remain available.
        </div>
      )}

      <datalist id="search-merch-product-options">
        {entityOptions.products.map((option) => (
          <option key={option.value} value={option.value}>{option.label}{option.description ? ` · ${option.description}` : ''}</option>
        ))}
      </datalist>
      <datalist id="search-merch-category-options">
        {entityOptions.categories.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </datalist>
      <datalist id="search-merch-brand-options">
        {entityOptions.brands.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </datalist>
      <p id="search-merch-catalog-help" className="sr-only">
        Catalogue-backed fields provide tenant-scoped suggestions. Exact manual values are still accepted when a known option is not listed.
      </p>

      {/* ARCHITECTURE INTEGRITY NOTICE */}
      <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80 flex items-center gap-3 text-xs text-indigo-900">
        <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
        <span>
          <strong className="font-bold">Catalogue Immutability: </strong>
          All search rules operate strictly on ranking scores and token expansion. Core Deliverect PLUs, descriptions, and category hierarchies remain pristine.
        </span>
      </div>

      {configLoadState === 'ready' && (
      <fieldset className="min-w-0 space-y-6">
      {/* TABS */}
      <div className="flex w-full items-center gap-1.5 overflow-x-auto border-b border-gray-200 pb-2">
        {[
          { id: 'typos', label: 'Typo Aliases', count: config.typoAliases.length },
          { id: 'synonyms', label: 'Synonyms', count: config.synonyms.length },
          { id: 'rewrites', label: 'Query Rewrites', count: config.queryRewrites.length },
          { id: 'pins', label: 'Pinned Products', count: config.pinnedProducts.length },
          { id: 'boosts', label: 'Product & Brand Boosts', count: config.boostRules.length },
          { id: 'exclusions', label: 'Excluded Products', count: config.excludedProductPlus.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-gray-900 text-white shadow-xs'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* TYPO ALIASES */}
      {activeTab === 'typos' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">Typo Aliases</h3>
            <span className="text-xs text-gray-500">Maps common misspellings directly to correct catalog terms</span>
          </div>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Typo (e.g. choclit)"
              value={newTypo.typo}
              onChange={(e) => setNewTypo({ ...newTypo, typo: e.target.value })}
              className="w-full min-w-0 flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            />
            <ArrowRight className="w-4 h-4 rotate-90 self-center text-gray-400 sm:rotate-0" />
            <input
              type="text"
              placeholder="Resolves to (e.g. chocolate)"
              value={newTypo.resolvesTo}
              onChange={(e) => setNewTypo({ ...newTypo, resolvesTo: e.target.value })}
              className="w-full min-w-0 flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            />
            <button
              type="button"
              onClick={addTypo}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Alias</span>
            </button>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {config.typoAliases.map((t) => (
              <div key={t.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-rose-600">"{t.typo}"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-mono font-bold text-emerald-700">"{t.resolvesTo}"</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeTypo(t.id)}
                  className="p-1 text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SYNONYMS */}
      {activeTab === 'synonyms' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">Search Synonyms</h3>
            <span className="text-xs text-gray-500">Expands matching tokens for colloquial terms</span>
          </div>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Base term (e.g. soda)"
              value={newSynonym.term}
              onChange={(e) => setNewSynonym({ ...newSynonym, term: e.target.value })}
              className="w-full min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white sm:w-1/3"
            />
            <input
              type="text"
              placeholder="Comma-separated synonyms (e.g. pop, cola, carbonated drink)"
              value={newSynonym.synonyms}
              onChange={(e) => setNewSynonym({ ...newSynonym, synonyms: e.target.value })}
              className="w-full min-w-0 flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            />
            <button
              type="button"
              onClick={addSynonym}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Synonyms</span>
            </button>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {config.synonyms.map((s) => (
              <div key={s.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">"{s.term}"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-600 font-mono">
                    [{s.synonyms.join(', ')}]
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeSynonym(s.id)}
                  className="p-1 text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QUERY REWRITES */}
      {activeTab === 'rewrites' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900">Query Rewrites</h3>
            <span className="text-xs text-gray-500">Maps concept queries to specific multi-item searches</span>
          </div>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Incoming query (e.g. breakfast essentials)"
              value={newRewrite.incomingQuery}
              onChange={(e) => setNewRewrite({ ...newRewrite, incomingQuery: e.target.value })}
              className="w-full min-w-0 flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            />
            <ArrowRight className="w-4 h-4 rotate-90 self-center text-gray-400 sm:rotate-0" />
            <input
              type="text"
              placeholder="Rewritten query (e.g. bread eggs milk butter)"
              value={newRewrite.rewrittenQuery}
              onChange={(e) => setNewRewrite({ ...newRewrite, rewrittenQuery: e.target.value })}
              className="w-full min-w-0 flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            />
            <button
              type="button"
              onClick={addRewrite}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Rewrite</span>
            </button>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {config.queryRewrites.map((r) => (
              <div key={r.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-indigo-900">"{r.incomingQuery}"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-mono text-gray-700">"{r.rewrittenQuery}"</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeRewrite(r.id)}
                  className="p-1 text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PINNED PRODUCTS */}
      {activeTab === 'pins' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Pin className="w-4 h-4 text-indigo-600" />
              <span>Pinned Search Products</span>
            </h3>
            <span className="text-xs text-gray-500">Locks sponsored or signature items to top search positions</span>
          </div>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Query (e.g. chocolate)"
              value={newPin.query}
              onChange={(e) => setNewPin({ ...newPin, query: e.target.value })}
              className="w-full min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white sm:w-1/3"
            />
            <input
              type="text"
              placeholder="Product PLU (e.g. PLU-ART-001)"
              value={newPin.productPlu}
              onChange={(e) => setNewPin({ ...newPin, productPlu: e.target.value })}
              className="w-full min-w-0 flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-mono"
              list="search-merch-product-options"
              autoComplete="off"
              aria-describedby="search-merch-catalog-help"
            />
            <input
              type="number"
              placeholder="Pos"
              value={newPin.position}
              onChange={(e) => setNewPin({ ...newPin, position: Number(e.target.value) })}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white sm:w-16"
              min="1"
              max="5"
            />
            <button
              type="button"
              onClick={addPin}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pin Item</span>
            </button>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {config.pinnedProducts.map((p) => (
              <div key={p.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    Pos #{p.position}
                  </span>
                  <span className="font-bold text-gray-900">Query: "{p.query}"</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-mono text-gray-700">{p.productPlu}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removePin(p.id)}
                  className="p-1 text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOOST RULES */}
      {activeTab === 'boosts' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Product, Category & Brand Boost Rules</span>
            </h3>
            <span className="text-xs text-gray-500">Multiplies ranking relevance score (e.g. 1.5x boost, 0.5x demote)</span>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={newBoost.type}
              onChange={(e) => setNewBoost({
                ...newBoost,
                type: e.target.value as 'product' | 'category' | 'brand',
                targetId: '',
                targetName: '',
              })}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            >
              <option value="category">Category Boost</option>
              <option value="product">Product Boost</option>
              <option value="brand">Brand Boost</option>
            </select>

            <input
              type="text"
              placeholder="Target ID (e.g. Bakery or PLU)"
              value={newBoost.targetId}
              onChange={(e) => {
                const targetId = e.target.value;
                const resolved = resolveSearchMerchTargetName(newBoost.type, targetId, entityOptions);
                setNewBoost({
                  ...newBoost,
                  targetId,
                  targetName: resolved || newBoost.targetName,
                });
              }}
              className="min-w-0 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-mono"
              list={
                newBoost.type === 'product'
                  ? 'search-merch-product-options'
                  : newBoost.type === 'category'
                    ? 'search-merch-category-options'
                    : 'search-merch-brand-options'
              }
              autoComplete="off"
              aria-describedby="search-merch-catalog-help"
            />

            <input
              type="text"
              placeholder="Display Name"
              value={newBoost.targetName}
              onChange={(e) => setNewBoost({ ...newBoost, targetName: e.target.value })}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            />

            <input
              type="number"
              step="0.1"
              placeholder="Multiplier (e.g. 1.5)"
              value={newBoost.boostMultiplier}
              onChange={(e) => setNewBoost({ ...newBoost, boostMultiplier: Number(e.target.value) })}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
            />

            <button
              type="button"
              onClick={addBoost}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Apply Boost</span>
            </button>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {config.boostRules.map((b) => (
              <div key={b.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase">
                    {b.type}
                  </span>
                  <span className="font-bold text-gray-900">{b.targetName}</span>
                  <span className="text-gray-400 font-mono">({b.targetId})</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] ${
                      b.boostMultiplier >= 1
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {b.boostMultiplier}x Multiplier
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeBoost(b.id)}
                  className="p-1 text-gray-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EXCLUSIONS */}
      {activeTab === 'exclusions' && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Ban className="w-4 h-4 text-rose-600" />
              <span>Excluded Search Products</span>
            </h3>
            <span className="text-xs text-gray-500">Completely hides listed PLUs from all search queries</span>
          </div>

          <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:flex-row sm:items-center">
            <input
              type="text"
              placeholder="Product PLU to exclude (e.g. PLU-OLD-ITEM)"
              value={newExclusionPlu}
              onChange={(e) => setNewExclusionPlu(e.target.value)}
              className="w-full min-w-0 flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-mono"
              list="search-merch-product-options"
              autoComplete="off"
              aria-describedby="search-merch-catalog-help"
            />
            <button
              type="button"
              onClick={addExclusion}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Exclude PLU</span>
            </button>
          </div>

          <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
            {config.excludedProductPlus.length === 0 ? (
              <div className="p-4 sm:p-6 text-center text-xs text-gray-400">No products excluded from search.</div>
            ) : (
              config.excludedProductPlus.map((plu) => (
                <div key={plu} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-white">
                  <span className="font-mono font-bold text-rose-700">{plu}</span>
                  <button
                    type="button"
                    onClick={() => removeExclusion(plu)}
                    className="p-1 text-gray-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      </fieldset>
      )}
    </div>
  );
};
