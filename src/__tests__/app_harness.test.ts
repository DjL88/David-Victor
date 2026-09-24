import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/app';
import { setMockAdminAuthForTest } from '../../server/firebase';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import { setRuntimeMode } from '../domain/runtime';
import { installMockFirebaseAdminToken } from './helpers/firebaseAuthHarness';

describe('SEC-00 createApp behavioural harness', () => {
  beforeEach(() => {
    setServerRuntimeMode('staging');
    setRuntimeMode('STAGING');
    setMockAdminAuthForTest(null);
  });

  afterEach(() => {
    setMockAdminAuthForTest(null);
    setServerRuntimeMode('demo');
    setRuntimeMode('UNKNOWN');
  });

  it('serves the health endpoint through the production Express composition', async () => {
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('commerce-bff');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('enforces admin authentication and accepts a Firebase-verified superadmin', async () => {
    const app = await createApp({ serveFrontend: false, initializeDependencies: false });

    await request(app).post('/api/v1/cache/reset').expect(401);

    const { token, verifyIdToken } = installMockFirebaseAdminToken();

    const response = await request(app)
      .post('/api/v1/cache/reset')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-ID', 'brand-alpha')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(verifyIdToken).toHaveBeenCalledWith(token, true);
  });
});
