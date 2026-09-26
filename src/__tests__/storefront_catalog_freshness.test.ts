import { describe, expect, it } from 'vitest';
import {
  shouldBlockCatalog,
  shouldShowCatalogSkeleton,
  shouldShowStaleCatalogNotice,
} from '../features/catalog/catalogFreshnessPresentation';

describe('storefront catalogue freshness presentation', () => {
  it('keeps last-known-good products visible during a stale refresh failure', () => {
    const state = {
      error: 'UPSTREAM_ERROR: refresh failed',
      isStale: true,
      visibleProductCount: 12,
    };
    expect(shouldBlockCatalog(state)).toBe(false);
    expect(shouldShowStaleCatalogNotice(state)).toBe(true);
  });

  it('blocks only when there is no usable last-known-good catalogue', () => {
    expect(
      shouldBlockCatalog({
        error: 'UPSTREAM_ERROR',
        isStale: false,
        visibleProductCount: 0,
      })
    ).toBe(true);
    expect(
      shouldBlockCatalog({
        error: 'UPSTREAM_ERROR',
        isStale: true,
        visibleProductCount: 0,
      })
    ).toBe(true);
  });

  it('does not show a stale warning for a healthy catalogue', () => {
    expect(
      shouldShowStaleCatalogNotice({
        error: null,
        isStale: false,
        visibleProductCount: 8,
      })
    ).toBe(false);
  });

  it('never swaps a populated product grid for loading skeletons', () => {
    expect(shouldShowCatalogSkeleton(true, 18, false)).toBe(false);
    expect(shouldShowCatalogSkeleton(true, 0, false)).toBe(true);
  });

  it('can still show search loading independently of the menu grid', () => {
    expect(shouldShowCatalogSkeleton(false, 18, true)).toBe(true);
  });
});
