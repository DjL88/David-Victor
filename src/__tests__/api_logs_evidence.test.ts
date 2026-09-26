import { describe, expect, it } from 'vitest';
import { getScopeEvidence, menuProcessingDetail, readApiLogSnapshot, readApiLogTrace } from '../admin/apiLogEvidence';

const response = (extra: Record<string, unknown> = {}) => ({
  tenantId: 'tenant-a', generatedAt: '2026-09-26T04:00:00Z',
  menuPushes: [], webhooks: [], circuits: {},
  sources: {
    menuPushes: { status: 'AVAILABLE', source: 'FIRESTORE', observedAt: '2026-09-26T04:00:00Z' },
    webhooks: { status: 'AVAILABLE', source: 'FIRESTORE', observedAt: '2026-09-26T04:00:00Z' },
    integration: { status: 'AVAILABLE', observedAt: '2026-09-26T04:00:00Z' },
    oauth: { status: 'UNKNOWN', mode: 'PASSIVE', observedAt: '2026-09-26T04:00:00Z' },
  },
  integration: { grantedScopes: [], commerceScopeGranted: false }, ...extra,
});

describe('API Logs evidence boundary', () => {
  it('does not infer missing permission or a healthy circuit from absent evidence', () => {
    expect(getScopeEvidence(null)).toBe('UNKNOWN');
    const snapshot = readApiLogSnapshot(response(), 'tenant-a');
    expect(getScopeEvidence(snapshot)).toBe('UNKNOWN');
    expect(snapshot.commerceCircuit).toBeNull();
  });

  it('distinguishes a reported scope from one absent in a nonempty scope list', () => {
    expect(getScopeEvidence(readApiLogSnapshot(response({
      sources: { oauth: { status: 'AVAILABLE', mode: 'ACTIVE' } },
      integration: { grantedScopes: ['genericCommerce', 'genericChannel:test'] },
    }), 'tenant-a'))).toBe('REPORTED');
    expect(getScopeEvidence(readApiLogSnapshot(response({
      sources: { oauth: { status: 'AVAILABLE', mode: 'ACTIVE' } },
      integration: { grantedScopes: ['genericChannel:test'] },
    }), 'tenant-a'))).toBe('NOT_REPORTED');
  });

  it('does not trust the legacy granted boolean without scope evidence', () => {
    const snapshot = readApiLogSnapshot(response({ integration: {
      commerceScopeGranted: true, grantedScopes: [],
    } }), 'tenant-a');
    expect(getScopeEvidence(snapshot)).toBe('UNKNOWN');
  });

  it('rejects cross-tenant, missing and malformed log responses', () => {
    expect(() => readApiLogSnapshot(response({ tenantId: 'tenant-b' }), 'tenant-a')).toThrow();
    expect(() => readApiLogSnapshot(null, 'tenant-a')).toThrow();
    expect(() => readApiLogSnapshot(response({ menuPushes: null }), 'tenant-a')).toThrow();
    expect(() => readApiLogSnapshot(response({ webhooks: {} }), 'tenant-a')).toThrow();
  });

  it('selects only the exact tenant circuit and does not invent missing failure counts', () => {
    const foreign = readApiLogSnapshot(response({ circuits: {
      'tenant-b:commerce': { state: 'OPEN', failures: 10 },
    } }), 'tenant-a');
    expect(foreign.commerceCircuit).toBeNull();
    const own = readApiLogSnapshot(response({ circuits: {
      'tenant-b:commerce': { state: 'OPEN', failures: 10 },
      'tenant-a:commerce': { state: 'CLOSED' },
    } }), 'tenant-a');
    expect(own.commerceCircuit).toEqual({ state: 'CLOSED', failures: null });
  });

  it('preserves per-source availability and does not treat partial or unavailable as empty truth', () => {
    const snapshot = readApiLogSnapshot(response({
      sources: {
        menuPushes: { status: 'PARTIAL', source: 'MEMORY', observedAt: '2026-09-26T04:02:00Z', errorCode: 'FIRESTORE_READ_FAILED' },
        webhooks: { status: 'UNAVAILABLE', source: 'MEMORY', observedAt: '2026-09-26T04:02:00Z', errorCode: 'PERMISSION_DENIED' },
        integration: { status: 'UNAVAILABLE', observedAt: '2026-09-26T04:02:00Z' },
        oauth: { status: 'UNKNOWN', mode: 'PASSIVE', observedAt: '2026-09-26T04:02:00Z' },
      },
    }), 'tenant-a');
    expect(snapshot.sources.menuPushes).toMatchObject({ status: 'PARTIAL', source: 'MEMORY', errorCode: 'FIRESTORE_READ_FAILED' });
    expect(snapshot.sources.webhooks).toMatchObject({ status: 'UNAVAILABLE', errorCode: 'PERMISSION_DENIED' });
    expect(getScopeEvidence(snapshot)).toBe('UNKNOWN');
  });

  it('does not mark queued, failed or unknown menu processing as complete', () => {
    const snapshot = readApiLogSnapshot(response({ menuPushes: [
      { eventId: 'queued', status: 'QUEUED' },
      { eventId: 'failed', status: 'FAILED' },
      { eventId: 'unknown' },
      { eventId: 'done', status: 'PROCESSED' },
    ] }), 'tenant-a');
    expect(snapshot.menuPushes.map(menuProcessingDetail)).toEqual([
      'Waiting for processing', 'Processing failed', 'Completion not confirmed', 'Processing completed',
    ]);
  });

  it('does not pass arbitrary raw error text to the view and keeps event references', () => {
    const snapshot = readApiLogSnapshot(response({ menuPushes: [{
      eventId: 'event-reference', status: 'FAILED', error: 'Bearer private-provider-value',
    }], webhooks: [{ webhookEventId: 'webhook-reference', errorCode: 'Bearer private-provider-value' }] }), 'tenant-a');
    expect(JSON.stringify(snapshot)).not.toContain('private-provider-value');
    expect(snapshot.menuPushes[0].eventId).toBe('event-reference');
    expect(snapshot.menuPushes[0].hasError).toBe(true);
    expect(snapshot.webhooks[0].verified).toBeNull();
  });

  it('retains sanitized menu, account, channel and location labels for filtering', () => {
    const snapshot = readApiLogSnapshot(response({ menuPushes: [{
      eventId: 'event-labelled',
      status: 'PROCESSED',
      menuIds: ['menu-1'], menuNames: ['Market Lane'],
      accountIds: ['account-1'], accountNames: ['Test Retailer'],
      channelLinkIds: ['channel-1'], channelNames: ['LeitchTech'],
      locationIds: ['location-1'], locationNames: ["Ewan's Store"],
    }] }), 'tenant-a');

    expect(snapshot.menuPushes[0]).toMatchObject({
      menuNames: ['Market Lane'], accountNames: ['Test Retailer'],
      channelNames: ['LeitchTech'], locationNames: ["Ewan's Store"],
    });
  });

  it('requires matching tenant evidence for diagnostics and preserves unknown HTTP status', () => {
    expect(() => readApiLogTrace({ tenantId: 'tenant-b', overallStatus: 'SUCCESS' }, 'tenant-a')).toThrow();
    expect(() => readApiLogTrace({ overallStatus: 'SUCCESS' }, 'tenant-a')).toThrow();
    expect(readApiLogTrace({ tenantId: 'tenant-a' }, 'tenant-a')).toEqual({
      tenantId: 'tenant-a', result: 'Not reported', httpStatus: null, failureCode: null,
    });
  });
});
