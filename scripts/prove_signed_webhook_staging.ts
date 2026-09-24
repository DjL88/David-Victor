/**
 * WP-08 deployed staging webhook proof harness.
 *
 * Inert by default. This script performs a real signed POST only when
 * DELIVERECT_WEBHOOK_PROOF_ARMED=1 and every required input is supplied.
 *
 * Required:
 *   DELIVERECT_WEBHOOK_PROOF_ARMED=1
 *   DELIVERECT_WEBHOOK_PROOF_BASE_URL=https://<deployed-staging-host>
 *   DELIVERECT_WEBHOOK_PROOF_IDENTIFIER=<tenant/account webhook identifier>
 *   DELIVERECT_WEBHOOK_PROOF_SECRET=<staging HMAC secret>
 *   DELIVERECT_WEBHOOK_PROOF_PAYLOAD='{"...":"provider-valid fixture"}'
 *
 * Optional:
 *   DELIVERECT_WEBHOOK_PROOF_PATH_SUFFIX=/picking/status
 *   DELIVERECT_WEBHOOK_PROOF_EXPECT_STATUS=200
 *
 * The payload is intentionally caller-supplied: the repository must not invent a
 * provider callback contract. Use a known-good staging fixture and disposable
 * staging order/location data.
 */
import crypto from 'node:crypto';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

if (process.env.DELIVERECT_WEBHOOK_PROOF_ARMED !== '1') {
  console.log('WP-08 staging webhook proof is inert. Set DELIVERECT_WEBHOOK_PROOF_ARMED=1 to explicitly arm it.');
  process.exit(0);
}

const baseUrl = required('DELIVERECT_WEBHOOK_PROOF_BASE_URL').replace(/\/$/, '');
const identifier = required('DELIVERECT_WEBHOOK_PROOF_IDENTIFIER');
const secret = required('DELIVERECT_WEBHOOK_PROOF_SECRET');
const rawPayload = required('DELIVERECT_WEBHOOK_PROOF_PAYLOAD');
const suffixRaw = process.env.DELIVERECT_WEBHOOK_PROOF_PATH_SUFFIX?.trim() ?? '';
const suffix = suffixRaw && !suffixRaw.startsWith('/') ? `/${suffixRaw}` : suffixRaw;
const expectedStatus = Number(process.env.DELIVERECT_WEBHOOK_PROOF_EXPECT_STATUS ?? '200');

if (!Number.isInteger(expectedStatus) || expectedStatus < 100 || expectedStatus > 599) {
  throw new Error('DELIVERECT_WEBHOOK_PROOF_EXPECT_STATUS must be a valid HTTP status');
}

try {
  JSON.parse(rawPayload);
} catch {
  throw new Error('DELIVERECT_WEBHOOK_PROOF_PAYLOAD must be valid JSON; bytes are sent exactly as supplied');
}

const signature = crypto.createHmac('sha256', secret).update(Buffer.from(rawPayload)).digest('hex');
const url = `${baseUrl}/api/v1/webhooks/deliverect/${encodeURIComponent(identifier)}${suffix}`;

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-server-authorization-hmac-sha256': signature,
  },
  body: rawPayload,
  redirect: 'error',
});

const responseText = await response.text();
console.log(JSON.stringify({
  proof: 'WP-08',
  url,
  status: response.status,
  expectedStatus,
  passed: response.status === expectedStatus,
  responseBodyPreview: responseText.slice(0, 500),
}, null, 2));

if (response.status !== expectedStatus) process.exit(1);
