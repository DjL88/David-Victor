import { useState, useEffect } from 'react';
import { Product, ProductAvailabilitySummary } from '../commerce/models';
import { useTenant } from '../tenant/TenantContext';
import { defaultAnalyticsClient } from '../analytics';
import { getRenderableProducts } from '../rules/availabilityRules';
import { applySearchMerchandising, resolveSearchQueryInfo } from '../commerce/searchMerchEngine';

export function useProductSearch(selectedStoreId?: string) {
  const { client } = useTenant();

  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<Product[]>([]);
  const [summaries, setSummaries] = useState<Record<string, ProductAvailabilitySummary>>({});
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    if (!query.trim()) {
      setResults([]);
      setSummaries({});
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const searchInfo = resolveSearchQueryInfo(query);
        const res = await client.searchProducts(searchInfo.normalizedQuery || query, selectedStoreId);
        if (isMounted) {
          const renderable = getRenderableProducts(res.products);
          const merchandised = applySearchMerchandising(renderable, query).map((entry) => entry.product);
          setResults(merchandised);
          if (res.summaries) {
            setSummaries(res.summaries);
          }
          defaultAnalyticsClient.track({
            type: 'SEARCH_PERFORMED',
            searchTerm: query.trim(),
            storeId: selectedStoreId,
            properties: {
              resultsCount: merchandised.length,
              normalizedQuery: searchInfo.normalizedQuery,
              correctedFrom: searchInfo.correctedFrom,
              rewrittenFrom: searchInfo.rewrittenFrom,
            },
          });
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, selectedStoreId, client]);

  return {
    query,
    setQuery,
    results,
    summaries,
    loading,
  };
}
