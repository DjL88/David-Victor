import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertCloudTasksRuntimeConfig,
  setCloudTasksOidcVerifierForTest,
  verifyCloudTasksOidcToken,
} from '../../server/asyncWorkerService';
import { setServerRuntimeMode } from '../../server/runtimeMode';

describe('SEC-04a Cloud Tasks authentication', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.APP_MODE = 'staging';
    process.env.CLOUD_TASKS_SA_EMAIL = 'worker@example-project.iam.gserviceaccount.com';
    process.env.CLOUD_TASKS_AUDIENCE = 'https://worker.example.test';
    process.env.APP_URL = 'https://worker.example.test';
    setServerRuntimeMode('staging');
  });

  afterEach(() => {
    setCloudTasksOidcVerifierForTest(null);
    setServerRuntimeMode(null);
    process.env.NODE_ENV = originalNodeEnv;
    delete process.env.APP_MODE;
    delete process.env.CLOUD_TASKS_SA_EMAIL;
    delete process.env.CLOUD_TASKS_AUDIENCE;
    delete process.env.APP_URL;
    vi.restoreAllMocks();
  });

  it('accepts only the configured verified Cloud Tasks service account', async () => {
    const verifyIdToken = vi.fn().mockResolvedValue({
      getPayload: () => ({
        iss: 'https://accounts.google.com',
        email: 'worker@example-project.iam.gserviceaccount.com',
        email_verified: true,
        sub: 'worker-subject',
      }),
    });
    setCloudTasksOidcVerifierForTest({ verifyIdToken } as any);

    const result = await verifyCloudTasksOidcToken({
      headers: { authorization: 'Bearer task-token' },
    });

    expect(result.email).toBe('worker@example-project.iam.gserviceaccount.com');
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'task-token',
      audience: 'https://worker.example.test',
    });
  });

  it('returns 401 for a token issued to another service account', async () => {
    setCloudTasksOidcVerifierForTest({
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          iss: 'accounts.google.com',
          email: 'other@example-project.iam.gserviceaccount.com',
          email_verified: true,
          sub: 'other-worker',
        }),
      }),
    } as any);

    await expect(
      verifyCloudTasksOidcToken({
        headers: { authorization: 'Bearer task-token' },
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'OIDC_SERVICE_ACCOUNT_MISMATCH',
    });
  });

  it('returns 401 when the OIDC audience validation fails', async () => {
    setCloudTasksOidcVerifierForTest({
      verifyIdToken: vi.fn().mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience')),
    } as any);

    await expect(
      verifyCloudTasksOidcToken({
        headers: { authorization: 'Bearer wrong-audience-token' },
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'OIDC_TOKEN_INVALID',
    });
  });

  it('rejects a service account token without verified email', async () => {
    setCloudTasksOidcVerifierForTest({
      verifyIdToken: vi.fn().mockResolvedValue({
        getPayload: () => ({
          iss: 'https://accounts.google.com',
          email: 'worker@example-project.iam.gserviceaccount.com',
          email_verified: false,
          sub: 'worker-subject',
        }),
      }),
    } as any);

    await expect(
      verifyCloudTasksOidcToken({
        headers: { authorization: 'Bearer task-token' },
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'OIDC_EMAIL_NOT_VERIFIED',
    });
  });

  it('fails live startup configuration when worker identity, audience or APP_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CLOUD_TASKS_AUDIENCE;

    expect(() => assertCloudTasksRuntimeConfig()).toThrow(
      /CLOUD_TASKS_AUDIENCE/
    );
  });
});
