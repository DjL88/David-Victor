import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import http from 'http';
import { AddressInfo } from 'net';
import { v1Router } from '../../server/api/v1Router';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('Deliverect substitution callback URL', () => {
  let server: http.Server;
  let baseUrl = '';

  beforeEach(async () => {
    setServerRuntimeMode('demo');
    const app = express();
    app.use(express.json());
    app.use('/api/v1', v1Router);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('registers the literal tenant-scoped callback URL without template braces', async () => {
    const res = await fetch(
      `${baseUrl}/webhooks/deliverect/brand-alpha/picking/substitutions`
    );
    expect(res.status).toBe(400);
    const payload = await res.json();
    expect(payload.code).toBe('SUBSTITUTION_IDENTIFIERS_REQUIRED');
  });
});
