import { describe, expect, it, vi } from 'vitest';
import { requireExactWebhookRawBody } from '../../server/webhookRawBodyGuard';

function responseHarness() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status } as any, status, json };
}

describe('SEC-04b webhook raw-body boundary', () => {
  it('passes only when the exact captured bytes are present', () => {
    const next = vi.fn();
    const { res, status } = responseHarness();
    requireExactWebhookRawBody({ rawBody: Buffer.from('{"a": 1}') } as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('fails closed instead of allowing JSON reconstruction', () => {
    const next = vi.fn();
    const { res, status, json } = responseHarness();
    requireExactWebhookRawBody({ body: { a: 1 } } as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'WEBHOOK_RAW_BODY_REQUIRED' }));
  });

  it('rejects string bodies because they are not the captured byte buffer', () => {
    const next = vi.fn();
    const { res, status } = responseHarness();
    requireExactWebhookRawBody({ rawBody: '{"a":1}' } as any, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(400);
  });
});
