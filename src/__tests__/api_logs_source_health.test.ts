import { describe, expect, it } from 'vitest';
import { getScopeEvidence, menuProcessingDetail, readApiLogSnapshot } from '../admin/apiLogEvidence';

const base = (extra: Record<string, unknown> = {}) => ({
  tenantId: 'tenant-a',
  generatedAt: '2026-09-26T05:00:00Z',
  menuPushes: [],
  webhooks: [],
  circuits: {},
  integration: { grantedScopes: [], allowedChannelLinkIds: [] },
  ...extra,
});

describe('API activity source-health evidence', () => {
  it('treats an observed empty OAuth scope set differently from an unavailable observation', () => {
    const available = readApiLogSnapshot(base({
      sources: {
        menuPushes: { status: 'AVAILABLE' },
        webhooks: { status: 'AVAILABLE' },
        integration: { status: 'AVAILABLE' },
        mappings: { status: 'AVAILABLE' },
        oauthScopes: { status: 'AVAILABLE', source: 'CACHE', observedAt: '2026-09-26T05:00:00Z' },
      },
    }), 'tenant-a');
    expect(getScopeEvidence(available)).toBe('NOT_REPORTED');

    const unavailable = readApiLogSnapshot(base({
      sources: {
        menuPushes: { status: 'AVAILABLE' },
        webhooks: { status: 'AVAILABLE' },
        integration: { status: 'AVAILABLE' },
        mappings: { status: 'AVAILABLE' },
        oauthScopes: { status: 'UNAVAILABLE', errorCode: 'OAUTH_SCOPE_REFRESH_FAILED' },
      },
    }), 'tenant-a');
    expect(getScopeEvidence(unavailable)).toBe('UNKNOWN');
    expect(unavailable.sources?.oauthScopes.errorCode).toBe('OAUTH_SCOPE_REFRESH_FAILED');
  });

  it('keeps structured processing failure evidence without preserving raw detail', () => {
    const snapshot = readApiLogSnapshot(base({
      menuPushes: [{
        eventId: 'event-safe',
        status: 'FAILED',
        hasError: true,
        error: 'untrusted upstream detail',
        errorCode: 'CHANNEL_MENU_PROCESSING_FAILED',
        errorStage: 'PROCESSING',
      }],
    }), 'tenant-a');

    expect(snapshot.menuPushes[0]).toMatchObject({
      hasError: true,
      errorCode: 'CHANNEL_MENU_PROCESSING_FAILED',
      errorStage: 'PROCESSING',
    });
    expect(JSON.stringify(snapshot)).not.toContain('untrusted upstream detail');
    expect(menuProcessingDetail(snapshot.menuPushes[0])).toContain('CHANNEL_MENU_PROCESSING_FAILED');
  });

  it('parses source health and pagination without accepting arbitrary error codes', () => {
    const snapshot = readApiLogSnapshot(base({
      sources: {
        menuPushes: { status: 'PARTIAL', source: 'MEMORY', nextCursor: 'next-menu', errorCode: 'FIRESTORE_READ_UNAVAILABLE' },
        webhooks: { status: 'UNAVAILABLE', errorCode: 'not safe' },
        integration: { status: 'AVAILABLE' },
        mappings: { status: 'AVAILABLE' },
        oauthScopes: { status: 'UNKNOWN' },
      },
      pagination: { menuCursor: 'next-menu', webhookCursor: null },
    }), 'tenant-a');

    expect(snapshot.sources?.menuPushes).toMatchObject({
      status: 'PARTIAL',
      source: 'MEMORY',
      nextCursor: 'next-menu',
      errorCode: 'FIRESTORE_READ_UNAVAILABLE',
    });
    expect(snapshot.sources?.webhooks.errorCode).toBeUndefined();
    expect(snapshot.pagination).toEqual({ menuCursor: 'next-menu', webhookCursor: null });
  });
});
