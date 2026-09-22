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

function productMatches(product: any, query: string): boolean {
  const needle = normalise(query);
  if (!needle) return false;
  return [
    product?.id,
    product?.plu,
    product?.name,
    product?.barcode,
    product?.gtin,
    product?.sku,
  ].some((value) => normalise(value).includes(needle));
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
        const query = String(args.input?.query || args.input?.plu || args.input?.productId || '').trim();
        if (!query) {
          throw Object.assign(new Error('A product name, PLU, barcode or product ID is required.'), {
            code: 'ADMIN_ACTION_INPUT_REQUIRED',
            statusCode: 400,
          });
        }
        const adapter = await getDeliverectAdapterAsync(args.tenantId);
        const search = await adapter.searchProducts(query, undefined, { limit: 50 });
        evidence.push({ source: 'deliverect.searchProducts', ok: true });
        const matches = (search?.products || []).filter((p: any) => productMatches(p, query));
        result = {
          query,
          matches: matches.map((p: any) => ({
            id: p.id,
            plu: p.plu,
            name: p.name,
            price: p.price,
            active: p.active,
            snoozed: p.snoozed,
            imagePresent: Boolean(p.imageUrl || p.image),
            categoryIds: p.categoryIds || p.categories || [],
          })),
          findings: matches.length === 0
            ? ['Product was not returned by the tenant catalogue search. Check upstream ranging/catalogue assignment first.']
            : matches.flatMap((p: any) => [
                p.active === false ? 'Product is marked inactive.' : null,
                p.snoozed === true ? 'Product is snoozed.' : null,
                p.price == null ? 'Product has no normalized price.' : null,
                !(p.imageUrl || p.image) ? 'Product has no image.' : null,
              ].filter(Boolean)),
        };
        break;
      }

      case 'stores.inspect': {
        const stores = await FirestorePlatformService.getStores(args.tenantId);
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
