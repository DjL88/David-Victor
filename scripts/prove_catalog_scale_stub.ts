import { performance } from 'node:perf_hooks';
import {
  projectChannelCatalogs,
  type LocationCatalogPush,
} from '../server/deliverect/ChannelCatalogProjection';
import {
  materializeStorefrontCatalog,
} from '../server/deliverect/CombinedStorefrontCatalog';

export interface CatalogScaleStubProofOptions {
  productCount?: number;
  storeCount?: number;
  searchIterations?: number;
}

export interface CatalogScaleStubProofResult {
  productCount: number;
  storeCount: number;
  sparseOverrideCount: number;
  projectionMs: number;
  selectedStoreMaterializationMs: number;
  searchP95Ms: number;
  storePickerMs: number;
  firestoreReads: number;
  externalRequests: number;
}

function percentile(values: number[], percentileValue: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

/**
 * Synthetic / stub-only pressure proof.
 *
 * This intentionally performs no network or Firestore I/O. It validates that
 * the canonical catalogue + sparse location-overlay model remains bounded at
 * the audit's target cardinality. It is NOT a substitute for deployed p95/VU
 * certification, which must be collected from the real nonprod environment.
 */
export function runCatalogScaleStubProof(
  options: CatalogScaleStubProofOptions = {}
): CatalogScaleStubProofResult {
  const productCount = options.productCount ?? 10_000;
  const storeCount = options.storeCount ?? 800;
  const searchIterations = options.searchIterations ?? 1_000;

  const masterItems = Array.from({ length: productCount }, (_, index) => ({
    plu: `MASTER-${index}`,
    gtin: String(5_000_000_000_000 + index),
    name: `Product ${index}`,
    price: 100 + (index % 500),
    stock: true,
  }));

  const pushes: LocationCatalogPush[] = [
    {
      locationId: 'loc-0',
      channelLinkId: 'ch-0',
      catalogId: 'catalog-master',
      structure: { categories: ['Combined storefront'] },
      items: masterItems,
    },
    ...Array.from({ length: storeCount - 1 }, (_, storeIndex) => {
      const localIndex = storeIndex < 25 ? storeIndex : -1;
      return {
        locationId: `loc-${storeIndex + 1}`,
        channelLinkId: `ch-${storeIndex + 1}`,
        catalogId: 'catalog-master',
        items:
          localIndex >= 0
            ? [
                {
                  ...masterItems[localIndex],
                  plu: `LOCAL-${storeIndex}`,
                  price: masterItems[localIndex].price + 25,
                },
              ]
            : [],
      };
    }),
  ];

  const projectionStart = performance.now();
  const projection = projectChannelCatalogs('loc-0', pushes);
  const projectionMs = performance.now() - projectionStart;

  const materializationStart = performance.now();
  materializeStorefrontCatalog(projection, 'loc-1', {
    status: 'BUSY',
    preparationTimeDelay: 10,
    products: {
      'LOCAL-0': { availability: 'SNOOZED' },
    },
  });
  const selectedStoreMaterializationMs =
    performance.now() - materializationStart;

  const products = Object.values(projection.products);
  const searchTimes: number[] = [];
  for (let iteration = 0; iteration < searchIterations; iteration += 1) {
    const needle = String(iteration % Math.max(1, productCount));
    const started = performance.now();
    products
      .filter(
        (product) =>
          String(product.name || '').includes(needle) ||
          String(product.plu || '').includes(needle)
      )
      .slice(0, 25);
    searchTimes.push(performance.now() - started);
  }

  const stores = Array.from({ length: storeCount }, (_, index) => ({
    id: `loc-${index}`,
    name: `Store ${index}`,
    orderable: index % 17 !== 0,
  }));
  const pickerStarted = performance.now();
  stores
    .filter((store) => store.orderable)
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 25);
  const storePickerMs = performance.now() - pickerStarted;

  return {
    productCount: Object.keys(projection.products).length,
    storeCount,
    sparseOverrideCount: projection.inventoryOverrides.length,
    projectionMs,
    selectedStoreMaterializationMs,
    searchP95Ms: percentile(searchTimes, 95),
    storePickerMs,
    // The synthetic harness stays entirely inside pure projection/materialisation
    // functions. Deployed request read budgets are measured separately.
    firestoreReads: 0,
    externalRequests: 0,
  };
}

if (
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('/prove_catalog_scale_stub.ts')
) {
  const result = runCatalogScaleStubProof();
  console.log(JSON.stringify(result, null, 2));
}
