import { getDeliverectAdapterAsync } from '../deliverect';
import { FirestorePlatformService } from '../firestoreService';
import { MediaHealthService } from '../mediaHealthService';
import { connectionHealthService } from '../deliverect/ConnectionHealthService';
import { assertAssistantActionAllowed, buildReadOnlyActionPlan, AdminActionPlan } from './adminActionRegistry';
import type { AdminRole } from '../../src/commerce/models';

export interface AdminAssistantActor {
  uid: string;
  role: AdminRole;
  tenantId: string;
}

export interface AdminAssistantActionResult {
  plan: AdminActionPlan;
  result: unknown;
  evidence: Array<{ source: string; ok: boolean; note?: string }>;
  generatedAt: string;
}

function normalise(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function singulariseToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('sses')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function normaliseSearchText(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => normaliseSearchText(item)).join(' ');
  return normalise(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productMatches(product: any, query: string): boolean {
  const needle = normaliseSearchText(query);
  if (!needle) return false;

  const fields = [
    product?.id,
    product?.plu,
    product?.canonicalPlu,
    product?.name,
    product?.description,
    product?.barcode,
    product?.gtin,
    product?.gtins,
    product?.sku,
  ].map(normaliseSearchText).filter(Boolean);

  if (fields.some((field) => field.includes(needle))) return true;

  const queryTokens = needle.split(' ').map(singulariseToken).filter(Boolean);
  return fields.some((field) => {
    const fieldTokens = field.split(' ').map(singulariseToken).filter(Boolean);
    return queryTokens.every((token) =>
      fieldTokens.some((fieldToken) => fieldToken === token || fieldToken.includes(token) || token.includes(fieldToken))
    );
  });
}

function isStoreProductInStock(product: any): boolean {
  if (!product || product.active === false || product.snoozed === true || product.isSnoozed === true) return false;
  if (product.stockStatus === 'OUT_OF_STOCK' || product.inStock === false || product.stockQuantity === 0) return false;
  return product.stockStatus === 'IN_STOCK' || product.inStock === true || Number(product.stockQuantity) > 0;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  if (values.length === 0) return [];
  const results: R[] = new Array(values.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

export class AdminAssistantActionService {
  static async executeReadOnly(args: {
    actor: AdminAssistantActor;
    tenantId: string;
    actionName: string;
    input?: Record<string, unknown>;
  }): Promise<AdminAssistantActionResult> {
    const action = assertAssistantActionAllowed(args.actor.role, args.actionName);
    if (action.risk !== 'READ') {
      throw Object.assign(new Error('Only read-only assistant actions can execute in foundation mode.'), {
        code: 'ADMIN_ACTION_WRITE_BLOCKED',
        statusCode: 403,
      });
    }

    const plan = buildReadOnlyActionPlan({
      action,
      tenantId: args.tenantId,
      actorId: args.actor.uid,
      input: args.input,
    });

    const input = plan.input;
    let result: unknown;
    const evidence: Array<{ source: string; ok: boolean; note?: string }> = [];

    switch (args.actionName) {
      case 'catalog.inspect': {
        const adapter = await getDeliverectAdapterAsync(args.tenantId);
        const [root, search] = await Promise.all([
          adapter.getRootCatalog().catch((err: any) => {
            evidence.push({ source: 'deliverect.rootCatalog', ok: false, note: err?.message || 'Root catalogue failed' });
            return null;
          }),
          adapter.searchProducts('', undefined, { limit: 200 }).catch((err: any) => {
            evidence.push({ source: 'deliverect.searchProducts', ok: false, note: err?.message || 'Product search failed' });
            return null;
          }),
        ]);
        if (root) evidence.push({ source: 'deliverect.rootCatalog', ok: true });
        if (search) evidence.push({ source: 'deliverect.searchProducts', ok: true });
        const products = search?.products || root?.products || [];
        result = {
          productCount: products.length,
          categoryCount: root?.categories?.length || 0,
          sample: products.slice(0, 10).map((p: any) => ({
            id: p.id,
            plu: p.plu,
            name: p.name,
            price: p.price,
            active: p.active,
            snoozed: p.snoozed,
            imagePresent: Boolean(p.imageUrl || p.image),
          })),
        };
        break;
      }

      case 'catalog.diagnoseVisibility': {
        const query = String(input.query || input.plu || input.productId || '').trim();
        if (!query) {
          throw Object.assign(new Error('A product name, PLU, barcode or product ID is required.'), {
            code: 'ADMIN_ACTION_INPUT_REQUIRED',
            statusCode: 400,
          });
        }

        const adapter = await getDeliverectAdapterAsync(args.tenantId);
        let search = await adapter.searchProducts(query, undefined, { limit: 100 });
        evidence.push({ source: 'deliverect.searchProducts', ok: true, note: `query=${query}` });

        let matches = (search?.products || []).filter((p: any) => productMatches(p, query));

        if (matches.length === 0) {
          const broad = await adapter.searchProducts('', undefined, { limit: 2000 });
          evidence.push({ source: 'deliverect.searchProducts', ok: true, note: 'broad fallback' });
          matches = (broad?.products || []).filter((p: any) => productMatches(p, query)).slice(0, 20);
          search = broad;
        }

        const includeLocations = input.includeLocations === true;
        const firstMatch = matches[0];
        let locationAvailability: any[] = [];

        if (includeLocations && firstMatch) {
          const stores = (await adapter.getStores()).slice(0, 50);
          evidence.push({
            source: 'deliverect.stores',
            ok: true,
            note: `checked ${stores.length} tenant locations`,
          });

          locationAvailability = await mapWithConcurrency(stores, 5, async (store: any) => {
            try {
              const storeSearch = await adapter.searchProducts(firstMatch.plu || firstMatch.id, store.id, { limit: 20 });
              const storeProduct = (storeSearch?.products || []).find(
                (product: any) =>
                  normalise(product?.plu) === normalise(firstMatch.plu) ||
                  normalise(product?.id) === normalise(firstMatch.id)
              );
              const storeSummary = storeSearch?.summaries?.[firstMatch.plu];
              const inStock = storeSummary
                ? Number(storeSummary.availableStoreCount || 0) > 0
                : Boolean(storeProduct && isStoreProductInStock(storeProduct));
              return {
                id: store.id,
                name: store.name,
                ranged: Boolean(storeProduct),
                inStock,
                active: storeProduct?.active,
                stockStatus: storeProduct?.stockStatus,
                stockQuantity: storeProduct?.stockQuantity,
                price: storeProduct?.price,
              };
            } catch (err: any) {
              return {
                id: store.id,
                name: store.name,
                ranged: false,
                inStock: false,
                error: err?.message || 'Location catalogue unavailable',
              };
            }
          });
        }

        const summaries = search?.summaries || {};
        result = {
          query,
          matches: matches.map((p: any, index: number) => ({
            id: p.id,
            plu: p.plu,
            name: p.name,
            price: p.price,
            active: p.active,
            snoozed: p.snoozed,
            stockStatus: p.stockStatus,
            stockQuantity: p.stockQuantity,
            inStock: p.inStock,
            imagePresent: Boolean(p.imageUrl || p.image),
            categoryIds: p.categoryIds || p.categories || [],
            availabilitySummary: summaries[p.plu],
            locationAvailability: index === 0 && includeLocations ? locationAvailability : undefined,
          })),
          findings: matches.length === 0
            ? ['Product was not returned by the tenant catalogue search after direct and broad matching. Check the PLU/name and tenant catalogue scope.']
            : matches.flatMap((p: any) => [
                p.active === false ? 'Product is marked inactive.' : null,
                p.snoozed === true ? 'Product is snoozed.' : null,
                p.stockStatus === 'OUT_OF_STOCK' || p.inStock === false ? 'Product is out of stock.' : null,
                p.stockStatus === 'IN_STOCK' || p.inStock === true ? 'Product is in stock.' : null,
                p.stockQuantity != null ? `Reported stock quantity: ${p.stockQuantity}.` : null,
                p.price == null ? 'Product has no normalized price.' : null,
                !(p.imageUrl || p.image) ? 'Product has no image.' : null,
              ].filter(Boolean)),
        };
        break;
      }

      case 'stores.inspect': {
        const stores = await FirestorePlatformService.getTenantStores(args.tenantId);
        evidence.push({ source: 'firestore.stores', ok: true });
        result = {
          storeCount: stores.length,
          stores: stores.map((store: any) => ({
            id: store.id,
            name: store.name,
            active: store.active,
            address: store.address,
            openingHours: store.openingHours,
            deliveryRadius: store.deliveryRadius,
          })),
        };
        break;
      }

      case 'rules.inspect': {
        const rules = await FirestorePlatformService.getTenantRules(args.tenantId);
        evidence.push({ source: 'firestore.searchRules', ok: true });
        result = {
          ruleCount: rules.length,
          activeCount: rules.filter((rule: any) => rule.enabled !== false).length,
          disabledCount: rules.filter((rule: any) => rule.enabled === false).length,
          rules: rules.map((rule: any) => ({
            id: rule.id,
            name: rule.name,
            enabled: rule.enabled !== false,
            priority: rule.priority,
            countries: rule.countries || [],
            matchConditions: rule.matchConditions || [],
            actions: rule.actions || [],
          })),
        };
        break;
      }

      case 'integrations.diagnose': {
        const health = await connectionHealthService.getConnectionHealth(args.tenantId);
        evidence.push({ source: 'connectionHealth', ok: true });
        result = health;
        break;
      }

      default:
        throw Object.assign(new Error('No deterministic executor exists for this assistant action.'), {
          code: 'ADMIN_ACTION_EXECUTOR_MISSING',
          statusCode: 501,
        });
    }

    return { plan, result, evidence, generatedAt: new Date().toISOString() };
  }

  static async mediaHealth(tenantId: string): Promise<unknown> {
    return MediaHealthService.scanTenantMediaHealth(tenantId, false);
  }
}
