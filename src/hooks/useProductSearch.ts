import { useState, useEffect } from 'react';
import { Product, ProductAvailabilitySummary } from '../commerce/models';
import { useTenant } from '../tenant/TenantContext';
import { defaultAnalyticsClient } from '../analytics';
import { getRenderableProducts } from '../rules/availabilityRules';

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
        const res = await client.searchProducts(query, selectedStoreId);
        if (isMounted) {
          const renderable = getRenderableProducts(res.products);
          setResults(renderable);
          if (res.summaries) {
            setSummaries(res.summaries);
          }
          defaultAnalyticsClient.track({
            type: 'SEARCH_PERFORMED',
            searchTerm: query.trim(),
            storeId: selectedStoreId,
            properties: { resultsCount: renderable.length },
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
