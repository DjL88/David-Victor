export interface CatalogFreshnessState {
  error?: string | null;
  isStale?: boolean;
  visibleProductCount: number;
}

export function shouldBlockCatalog(state: CatalogFreshnessState): boolean {
  if (!state.error) return false;
  return !(state.isStale && state.visibleProductCount > 0);
}

export function shouldShowStaleCatalogNotice(state: CatalogFreshnessState): boolean {
  return Boolean(state.isStale && state.visibleProductCount > 0);
}

export function shouldShowCatalogSkeleton(
  loading: boolean,
  visibleProductCount: number,
  searchLoading: boolean = false
): boolean {
  if (searchLoading) return true;
  return loading && visibleProductCount === 0;
}
