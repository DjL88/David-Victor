/**
 * Deliverect staging collection/pickup order smoke test.
 *
 * Usage from the project root after copying this to scripts/test_collection_order.ts:
 *
 *   npx tsx scripts/test_collection_order.ts \
 *     --account=68517fde1c3ddaa7f6d0275c \
 *     --store=<channelLinkId> \
 *     --menu=<menuId> \
 *     --plu=<PLU> \
 *     --qty=1
 *
 * By default the script stops after basket reconcile and DOES NOT create an order.
 * To inject an unpaid pickup order in staging you must pass BOTH:
 *   --checkout --confirm-checkout=CREATE_STAGING_ORDER
 *
 * Production is intentionally refused by this script.
 */

import 'dotenv/config';
import { OAuthTokenManager } from '../server/deliverect/OAuthTokenManager';
import {
  DeliverectCommerceBasketApi,
  DeliverectCommerceApiError,
} from '../server/deliverect/DeliverectCommerceBasketApi';

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

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const args = argsToMap(process.argv.slice(2));
  const accountId = required(args, 'account');
  const channelLinkId = required(args, 'store');
  const menuId = required(args, 'menu');
  const plu = required(args, 'plu');
  const qty = Number(typeof args.get('qty') === 'string' ? args.get('qty') : '1');
  const performCheckout = args.get('checkout') === true;
  const checkoutConfirmation =
    typeof args.get('confirm-checkout') === 'string'
      ? String(args.get('confirm-checkout'))
      : '';

  const environment = String(process.env.DELIVERECT_ENV || 'staging').toLowerCase();
  if (environment === 'production') {
    throw new Error(
      'Refusing to run against DELIVERECT_ENV=production. This smoke test is staging-only by design.'
    );
  }
  if (environment !== 'staging') {
    throw new Error(
      `Refusing to run with DELIVERECT_ENV=${environment}. Set DELIVERECT_ENV=staging for this smoke test.`
    );
  }
  if (performCheckout && checkoutConfirmation !== 'CREATE_STAGING_ORDER') {
    throw new Error(
      'Checkout is armed only when --checkout and --confirm-checkout=CREATE_STAGING_ORDER are both supplied.'
    );
  }

  const tokenManager = OAuthTokenManager.getInstance({
    environment: environment === 'production' ? 'production' : 'staging',
  });

  const api = new DeliverectCommerceBasketApi(tokenManager, accountId);

  console.log('Deliverect collection-order test');
  console.log(`Environment: ${environment}`);
  console.log(`Account: ${accountId}`);
  console.log(`Store/channelLinkId: ${channelLinkId}`);
  console.log(`Menu: ${menuId}`);
  console.log(`PLU: ${plu} x ${qty}`);
  console.log(
    `Checkout: ${
      performCheckout
        ? 'ARMED - confirmed staging unpaid pickup order will be injected'
        : 'SAFE MODE - stop after reconcile; no order will be created'
    }`
  );
  console.log('');

  const result = await api.createPickupTestOrder({
    channelLinkId,
    menuId,
    plu,
    quantity: qty,
    performCheckout,
    customer: {
      name: typeof args.get('name') === 'string' ? String(args.get('name')) : 'Bwydi Staging Test',
      email: typeof args.get('email') === 'string' ? String(args.get('email')) : undefined,
      phoneNumber: typeof args.get('phone') === 'string' ? String(args.get('phone')) : undefined,
    },
    pickupNotes: 'Bwydi staging collection test',
    orderNote: 'Bwydi Commerce API staging collection test',
  });

  console.log('SUCCESS');
  console.log(`Basket ID: ${result.basketId}`);
  console.log(`Authoritative total: ${result.totalMinor} minor units`);
  if (result.checkout) {
    console.log(`Channel order ID: ${result.channelOrderId}`);
    console.log(`Display ID: ${result.channelOrderDisplayId}`);
    console.log('Checkout response:');
    console.log(pretty(result.checkout));
    console.log('\nHTTP checkout acceptance is asynchronous; verify the checkout status/webhook or staging order view.');
  } else {
    console.log(
      'Reconcile succeeded safely. To create a staging order, re-run with ' +
        '--checkout --confirm-checkout=CREATE_STAGING_ORDER.'
    );
  }
}

main().catch((error: unknown) => {
  if (error instanceof DeliverectCommerceApiError) {
    console.error(`FAILED [${error.code}] ${error.message}`);
    console.error(`Operation: ${error.operation}`);
    console.error(`HTTP status: ${error.status}`);
    if (error.upstreamBody !== undefined) {
      console.error('Deliverect response:');
      console.error(pretty(error.upstreamBody));
    }
    if (error.code === 'BASKET_WRITE_PERMISSION_REQUIRED') {
      console.error(
        '\nThe current credentials can read Commerce data but cannot create baskets. ' +
          'Ask Deliverect to enable Commerce basket write access for this integration/account.'
      );
    }
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
