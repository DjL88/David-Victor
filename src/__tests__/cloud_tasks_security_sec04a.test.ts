import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/app';
import {
  assertCloudTasksSecurityConfigured,
  getCloudTasksSecurityConfig,
  setCloudTasksTokenVerifierForTest,
  verifyCloudTasksOidcToken,
} from '../../server/cloudTasksSecurity';
import { setServerRuntimeMode } from '../../server/runtimeMode';

const EXPECTED_SA = 'tasks-worker@example-project.iam.gserviceaccount.com';
const EXPECTED_AUDIENCE = 'https://worker.example.test';
const EXPECTED_APP_URL = 'https://worker.example.test';

function req(token = 'signed.oidc.token') {
  return { headers: { authorization: `Bearer ${token}` } };
}

describe('SEC-04a Cloud Tasks OIDC hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    process.env.CLOUD_TASKS_SA_EMAIL = EXPECTED_SA;
    process.env.CLOUD_TASKS_AUDIENCE = EXPECTED_AUDIENCE;
    process.env.APP_URL = EXPECTED_APP_URL;
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    setCloudTasksTokenVerifierForTest(null);
    setServerRuntimeMode(null);
    delete process.env.APP_MODE;
    delete process.env.CLOUD_TASKS_SA_EMAIL;
    delete process.env.CLOUD_TASKS_AUDIENCE;
    delete process.env.APP_URL;
    vi.restoreAllMocks();
  });

  it('rejects a token from a different service account', async () => {
    setCloudTasksTokenVerifierForTest(async (_token, audience) => ({
      iss: 'https://accounts.google.com',
      aud: audience,
      email: 'other-worker@example-project.iam.gserviceaccount.com',
      email_verified: true,
      sub: 'other-worker',
    }));

    await expect(verifyCloudTasksOidcToken(req())).rejects.toMatchObject({
      statusCode: 401,
      code: 'OIDC_SERVICE_ACCOUNT_MISMATCH',
    });
  });

  it('rejects a token with the wrong audience', async () => {
    setCloudTasksTokenVerifierForTest(async () => ({
      iss: 'https://accounts.google.com',
      aud: 'https://wrong-audience.example.test',
      email: EXPECTED_SA,
      email_verified: true,
      sub: 'worker',
    }));

    await expect(verifyCloudTasksOidcToken(req())).rejects.toMatchObject({
      statusCode: 401,
      code: 'OIDC_AUDIENCE_MISMATCH',
    });
  });

  it('rejects a task identity whose email is not verified', async () => {
    setCloudTasksTokenVerifierForTest(async (_token, audience) => ({
      iss: 'https://accounts.google.com',
      aud: audience,
      email: EXPECTED_SA,
      email_verified: false,
      sub: 'worker',
    }));

    await expect(verifyCloudTasksOidcToken(req())).rejects.toMatchObject({
      statusCode: 401,
      code: 'OIDC_EMAIL_NOT_VERIFIED',
    });
  });

  it('accepts only the configured SA and exact audience', async () => {
    const verifier = vi.fn(async (_token: string, audience: string) => ({
      iss: 'https://accounts.google.com',
      aud: audience,
      email: EXPECTED_SA,
      email_verified: true,
      sub: 'worker-subject',
    }));
    setCloudTasksTokenVerifierForTest(verifier);

    await expect(verifyCloudTasksOidcToken(req())).resolves.toEqual({
      email: EXPECTED_SA,
      sub: 'worker-subject',
    });
    expect(verifier).toHaveBeenCalledWith('signed.oidc.token', EXPECTED_AUDIENCE);
  });

  it('uses one explicit config tuple for enqueue target and OIDC audience', () => {
    expect(getCloudTasksSecurityConfig()).toEqual({
      serviceAccountEmail: EXPECTED_SA,
      audience: EXPECTED_AUDIENCE,
      appUrl: EXPECTED_APP_URL,
    });
  });

  it('fails boot in staging when required Cloud Tasks auth config is missing', async () => {
    delete process.env.CLOUD_TASKS_SA_EMAIL;
    expect(() => assertCloudTasksSecurityConfigured()).toThrow(/CLOUD_TASKS_SA_EMAIL/);

    await expect(
      createApp({ serveFrontend: false, initializeDependencies: true })
    ).rejects.toThrow(/CLOUD_TASKS_SA_EMAIL/);
  });
});
