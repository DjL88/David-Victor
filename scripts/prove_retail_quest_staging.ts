/**
 * WP-03 explicitly armed Retail/Quest staging proof.
 *
 * This script is intentionally inert unless the operator supplies both the
 * endpoint and an explicit opt-in. It never guesses Deliverect/DPay contracts
 * or credentials and is not part of normal CI.
 *
 * Usage:
 *   LT_RETAIL_PROOF_ARMED=true \
 *   LT_RETAIL_PROOF_URL=https://<staging-host>/<retail-order-route> \
 *   LT_RETAIL_PROOF_BEARER=<token-if-required> \
 *   npx tsx scripts/prove_retail_quest_staging.ts
 */
import { projectRetailQuestOrder } from '../server/deliverect/RetailQuestOrderContract';

function required(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

async function main() {
  if (process.env.LT_RETAIL_PROOF_ARMED !== 'true') {
    throw new Error('Refusing to send staging proof: set LT_RETAIL_PROOF_ARMED=true explicitly.');
  }

  const url = required('LT_RETAIL_PROOF_URL');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Retail staging proof requires an https URL.');

  const now = new Date().toISOString();
  const proofId = `LT-CERT-${Date.now()}`;
  const payload = projectRetailQuestOrder({
    channelOrderId: proofId,
    channelOrderDisplayId: proofId,
    placedTime: now,
    fulfillmentType: 'pickup',
    totalMinor: 155,
    hasOnlineAuthorization: false,
    customerNotes: 'LT WP-03 explicitly armed staging proof',
    items: [{
      plu: required('LT_RETAIL_PROOF_PLU'),
      name: process.env.LT_RETAIL_PROOF_ITEM_NAME || 'LT certification item',
      quantity: 1,
      unitPriceMinor: 155,
      substitutionPreference: 'BEST_MATCH',
    }],
  });

  const bearer = String(process.env.LT_RETAIL_PROOF_BEARER || '').trim();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  console.log(JSON.stringify({
    proofId,
    urlOrigin: parsed.origin,
    status: response.status,
    ok: response.ok,
    response: body.slice(0, 2000),
  }, null, 2));
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
