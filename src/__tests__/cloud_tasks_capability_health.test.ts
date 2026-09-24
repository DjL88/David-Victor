import { describe, expect, it } from 'vitest';
import { getCloudTasksCapabilityHealth } from '../../server/cloudTasksSecurity';

describe('Cloud Tasks capability health', () => {
  it('reports exact missing live configuration without throwing', () => {
    const health = getCloudTasksCapabilityHealth({}, true);

    expect(health.mode).toBe('cloud-tasks');
    expect(health.configured).toBe(false);
    expect(health.queues).toEqual({ bulk: false, realtime: false });
    expect(health.missing).toEqual([
      'GOOGLE_CLOUD_PROJECT',
      'CLOUD_TASKS_SA_EMAIL',
      'CLOUD_TASKS_AUDIENCE',
      'APP_URL_OR_CLOUD_TASKS_AUDIENCE',
      'CHANNEL_MENU_TASKS_QUEUE',
      'CHANNEL_REALTIME_TASKS_QUEUE',
    ]);
  });

  it('accepts the documented shared queue and audience fallbacks', () => {
    const health = getCloudTasksCapabilityHealth(
      {
        GOOGLE_CLOUD_PROJECT: 'lt-nonprod',
        CLOUD_TASKS_SA_EMAIL: 'tasks@lt-nonprod.iam.gserviceaccount.com',
        CLOUD_TASKS_AUDIENCE: 'https://integration.leitch.tech',
        CLOUD_TASKS_QUEUE: 'deliverect-events',
      },
      true
    );

    expect(health.mode).toBe('cloud-tasks');
    expect(health.configured).toBe(true);
    expect(health.appUrlConfigured).toBe(true);
    expect(health.queues).toEqual({ bulk: true, realtime: true });
    expect(health.missing).toEqual([]);
  });

  it('reports in-memory capability as healthy outside live modes', () => {
    const health = getCloudTasksCapabilityHealth({}, false);

    expect(health.mode).toBe('in-memory');
    expect(health.configured).toBe(true);
    expect(health.missing).toEqual([]);
  });
});
