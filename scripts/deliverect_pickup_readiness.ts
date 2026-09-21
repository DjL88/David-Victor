/**
 * Read-only Deliverect Commerce pickup readiness probe.
 *
 * Uses only verified Commerce read endpoints to identify a real staging store,
 * pickup-compatible menu, and orderable PLU for the collection-order smoke test.
 *
 * Usage:
 *   npx tsx scripts/deliverect_pickup_readiness.ts --account=<accountId>
 *
 * Optional:
 *   --store=<channelLinkId>     Restrict to one store
 *   --limit=5                   Max stores to inspect (default 10)
 */

import 'dotenv/config';
import { OAuthTokenManager } from '../server/deliverect/OAuthTokenManager';

type AnyObject = Record<string, any>;

function argsToMap(argv: string[]): Map<string, string | true> {
  const map = new Map<string, string | true>();
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) map.set(body, true);
    else map.set(body.slice(0, eq), body.slice(eq + 1));
  }
  return map;
}

function required(args: Map<string, string | true>, key: string): string {
  const value = args.get(key);
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required --${key}=... argument`);
  }
  return value.trim();
}

function arrayFromEnvelope(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?._items)) return payload._items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function getJson(url: string, token: string): Promise<any> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const text = await response.text();
  let body: any = text;
  if (text) {
    try { body = JSON.parse(text); } catch { /* retain text */ }
  }
  if (!response.ok) {
    throw new Error(`GET ${url} -> HTTP ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }
  return body;
}

function getChannelLinkId(store: AnyObject): string {
  return String(store.channelLinkId || store.storeId || store.id || store._id || '');
}

function isPickupCompatibleMenu(menu: AnyObject): boolean {
  const menuType = Number(menu.menuType);
  return menuType === 0 || menuType === 2;
}

function sampleOrderableProducts(menu: AnyObject, max = 5): Array<{
  plu: string;
  name: string;
  price: number | undefined;
  multiMax?: number;
  snoozed?: boolean;
}> {
  const rawProducts = menu?.products;
  const products: AnyObject[] = Array.isArray(rawProducts)
    ? rawProducts
    : rawProducts && typeof rawProducts === 'object'
      ? Object.values(rawProducts)
      : [];

  return products
    .filter((product) => {
      const plu = String(product?.plu || '').trim();
      if (!plu) return false;
      if (plu.includes('#')) return false;
      if (product?.snoozed === true) return false;
      if (product?.visible === false) return false;
      const productType = Number(product?.productType ?? 1);
      return productType === 1;
    })
    .slice(0, max)
    .map((product) => ({
      plu: String(product.plu),
      name: String(product.name || product.plu),
      price: Number.isInteger(product.price) ? product.price : undefined,
      multiMax: Number.isInteger(product.multiMax) ? product.multiMax : undefined,
      snoozed: product.snoozed,
    }));
}

async function main() {
  const args = argsToMap(process.argv.slice(2));
  const accountId = required(args, 'account');
  const requestedStore = typeof args.get('store') === 'string' ? String(args.get('store')) : undefined;
  const limitRaw = typeof args.get('limit') === 'string' ? Number(args.get('limit')) : 10;
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10;

  const environment = String(process.env.DELIVERECT_ENV || 'staging').toLowerCase();
  if (environment === 'production') {
    throw new Error('This readiness probe is intentionally staging-only. Set DELIVERECT_ENV=staging.');
  }

  const tokenManager = OAuthTokenManager.getInstance({ environment: 'staging' });
  const token = await tokenManager.getAccessToken();
  const baseUrl = tokenManager.config.baseUrl.replace(/\/$/, '');

  const storesUrl = `${baseUrl}/commerce/${encodeURIComponent(accountId)}/stores?fulfillmentType=pickup&page=1&size=100`;
  const storesPayload = await getJson(storesUrl, token);
  let stores = arrayFromEnvelope(storesPayload);

  if (requestedStore) {
    stores = stores.filter((store) => getChannelLinkId(store) === requestedStore);
  }
  stores = stores.slice(0, limit);

  if (stores.length === 0) {
    console.log('No pickup-capable Commerce stores were returned for this account/filter.');
    process.exitCode = 2;
    return;
  }

  console.log(`Found ${stores.length} pickup-capable store(s) to inspect.\n`);

  let candidateCount = 0;
  for (const store of stores) {
    const channelLinkId = getChannelLinkId(store);
    if (!channelLinkId) continue;

    const storeName = String(store.name || store.locationName || channelLinkId);
    const status = String(store.status || 'unknown');
    const menusUrl = `${baseUrl}/commerce/${encodeURIComponent(accountId)}/stores/${encodeURIComponent(channelLinkId)}/menus`;

    try {
      const menusPayload = await getJson(menusUrl, token);
      const menus = arrayFromEnvelope(menusPayload).length > 0
        ? arrayFromEnvelope(menusPayload)
        : Array.isArray(menusPayload)
          ? menusPayload
          : [];
      const pickupMenus = menus.filter(isPickupCompatibleMenu);

      console.log(`STORE: ${storeName}`);
      console.log(`  channelLinkId: ${channelLinkId}`);
      console.log(`  status: ${status}`);
      console.log(`  pickup menus: ${pickupMenus.length}`);

      for (const menu of pickupMenus) {
        const menuId = String(menu.menuId || menu.id || '');
        const menuName = String(menu.menu || menu.name || menuId);
        const samples = sampleOrderableProducts(menu);
        console.log(`  MENU: ${menuName}`);
        console.log(`    menuId: ${menuId}`);
        console.log(`    menuType: ${menu.menuType} (${Number(menu.menuType) === 2 ? 'pickup' : 'delivery+pickup'})`);
        if (samples.length === 0) {
          console.log('    no obvious top-level, unsnoozed product samples found');
        } else {
          candidateCount += samples.length;
          for (const sample of samples) {
            console.log(
              `    PLU: ${sample.plu} | ${sample.name}` +
                `${sample.price !== undefined ? ` | price=${sample.price}` : ''}` +
                `${sample.multiMax !== undefined ? ` | multiMax=${sample.multiMax}` : ''}`
            );
          }
        }
      }
      console.log('');
    } catch (error) {
      console.error(`  Failed to inspect ${storeName} (${channelLinkId}):`, error);
      console.log('');
    }
  }

  if (candidateCount === 0) {
    console.log('No candidate PLUs found. Check that a pickup-compatible menu is published to the store.');
    process.exitCode = 3;
  } else {
    console.log('Use one channelLinkId + menuId + PLU above with scripts/test_collection_order.ts.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
