export type ScopeEvidence = 'REPORTED' | 'NOT_REPORTED' | 'UNKNOWN';
export type ObservedCircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type ApiActivitySourceStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'UNKNOWN';

export interface ApiActivitySourceEvidence {
  status: ApiActivitySourceStatus;
  observedAt?: string;
  source?: 'FIRESTORE' | 'MEMORY';
  nextCursor?: string;
  errorCode?: string;
  mode?: 'PASSIVE' | 'ACTIVE';
}

type JsonRecord = Record<string, unknown>;

export interface ApiLogMenuEntry {
  eventId: string;
  status: string;
  receivedAt?: string;
  processedAt?: string;
  menuIds: string[];
  menuNames: string[];
  channelLinkIds: string[];
  channelNames: string[];
  accountIds: string[];
  accountNames: string[];
  locationIds: string[];
  locationNames: string[];
  hasError: boolean;
  reviewReason?: string;
}

export interface ApiLogWebhookEntry {
  webhookEventId: string;
  eventType: string;
  receivedAt?: string;
  processingStatus: string;
  verified: boolean | null;
  errorCode?: string;
}

export interface ApiLogSnapshot {
  tenantId: string;
  generatedAt?: string;
  integration: {
    environment?: string;
    credentialMode?: string;
    accountId?: string;
    accountName?: string;
    channelName?: string;
    publicBaseUrl?: string;
    allowedChannelLinkIds: string[] | null;
    grantedScopes: string[];
  } | null;
  commerceCircuit: { state: ObservedCircuitState; failures: number | null } | null;
  sources: {
    menuPushes: ApiActivitySourceEvidence;
    webhooks: ApiActivitySourceEvidence;
    integration: ApiActivitySourceEvidence;
    oauth: ApiActivitySourceEvidence;
  };
  menuPushes: ApiLogMenuEntry[];
  webhooks: ApiLogWebhookEntry[];
}

const record = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const strings = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
  : [];
const errorCode = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value) ? value : undefined;
const sourceStatus = (value: unknown): ApiActivitySourceStatus =>
  value === 'AVAILABLE' || value === 'PARTIAL' || value === 'UNAVAILABLE' || value === 'UNKNOWN'
    ? value : 'UNKNOWN';
const sourceEvidence = (value: unknown): ApiActivitySourceEvidence => {
  const input = record(value);
  const source = input?.source === 'FIRESTORE' || input?.source === 'MEMORY' ? input.source : undefined;
  const mode = input?.mode === 'PASSIVE' || input?.mode === 'ACTIVE' ? input.mode : undefined;
  return {
    status: sourceStatus(input?.status),
    observedAt: text(input?.observedAt),
    source,
    nextCursor: text(input?.nextCursor),
    errorCode: errorCode(input?.errorCode),
    mode,
  };
};

/** Reject mismatched or incomplete payloads rather than displaying another tenant or fake emptiness. */
export function readApiLogSnapshot(value: unknown, tenantId: string): ApiLogSnapshot {
  const input = record(value);
  if (!tenantId || input?.tenantId !== tenantId ||
      !Array.isArray(input.menuPushes) || !Array.isArray(input.webhooks)) {
    throw new Error('API log response is unavailable or does not match the selected tenant.');
  }
  const integration = record(input.integration);
  const sources = record(input.sources);
  const rawCircuit = record(record(input.circuits)?.[`${tenantId}:commerce`]);
  const circuitState = rawCircuit?.state;
  const circuitObserved = circuitState === 'CLOSED' || circuitState === 'OPEN' || circuitState === 'HALF_OPEN';

  return {
    tenantId,
    generatedAt: text(input.generatedAt),
    integration: integration ? {
      environment: text(integration.environment),
      credentialMode: text(integration.credentialMode),
      accountId: text(integration.accountId),
      accountName: text(integration.accountName),
      channelName: text(integration.channelName),
      publicBaseUrl: text(integration.publicBaseUrl),
      allowedChannelLinkIds: Array.isArray(integration.allowedChannelLinkIds)
        ? strings(integration.allowedChannelLinkIds) : null,
      grantedScopes: strings(integration.grantedScopes),
    } : null,
    commerceCircuit: circuitObserved ? {
      state: circuitState,
      failures: typeof rawCircuit?.failures === 'number' && Number.isFinite(rawCircuit.failures) && rawCircuit.failures >= 0
        ? rawCircuit.failures : null,
    } : null,
    sources: {
      menuPushes: sourceEvidence(sources?.menuPushes),
      webhooks: sourceEvidence(sources?.webhooks),
      integration: sourceEvidence(sources?.integration),
      oauth: sourceEvidence(sources?.oauth),
    },
    menuPushes: input.menuPushes.map((entry): ApiLogMenuEntry => {
      const item = record(entry);
      if (!item || !text(item.eventId)) throw new Error('Malformed menu activity entry.');
      return {
        eventId: text(item.eventId)!,
        status: text(item.status) || 'UNKNOWN',
        receivedAt: text(item.receivedAt),
        processedAt: text(item.processedAt),
        menuIds: strings(item.menuIds),
        menuNames: strings(item.menuNames),
        channelLinkIds: strings(item.channelLinkIds),
        channelNames: strings(item.channelNames),
        accountIds: strings(item.accountIds),
        accountNames: strings(item.accountNames),
        locationIds: strings(item.locationIds),
        locationNames: strings(item.locationNames),
        hasError: Boolean(item.error),
        reviewReason: errorCode(record(item.review)?.reason),
      };
    }),
    webhooks: input.webhooks.map((entry): ApiLogWebhookEntry => {
      const item = record(entry);
      if (!item || !text(item.webhookEventId)) throw new Error('Malformed webhook activity entry.');
      return {
        webhookEventId: text(item.webhookEventId)!,
        eventType: text(item.eventType) || 'Unknown',
        receivedAt: text(item.receivedAt),
        processingStatus: text(item.processingStatus) || 'UNKNOWN',
        verified: typeof item.verified === 'boolean' ? item.verified : null,
        errorCode: errorCode(item.errorCode),
      };
    }),
  };
}

/** Only a successful active scope observation can prove a scope absent. */
export function getScopeEvidence(snapshot: ApiLogSnapshot | null): ScopeEvidence {
  if (!snapshot || snapshot.sources.oauth.status !== 'AVAILABLE' || snapshot.sources.oauth.mode !== 'ACTIVE') {
    return 'UNKNOWN';
  }
  const scopes = snapshot.integration?.grantedScopes || [];
  return scopes.some((scope) => scope.toLowerCase() === 'genericcommerce') ? 'REPORTED' : 'NOT_REPORTED';
}

export function menuProcessingDetail(entry: ApiLogMenuEntry): string {
  if (entry.hasError) return 'Processing error recorded; use the event ID for investigation.';
  switch (entry.status.toUpperCase()) {
    case 'PROCESSED': return 'Processing completed';
    case 'RECEIVED': return 'Received; processing not yet confirmed';
    case 'QUEUED': return 'Waiting for processing';
    case 'PROCESSING': return 'Processing in progress';
    case 'REVIEW_REQUIRED': return 'Held for operator review';
    case 'QUEUE_FAILED': return 'Queue delivery failed';
    case 'FAILED': return 'Processing failed';
    default: return 'Completion not confirmed';
  }
}

export interface ApiLogTrace {
  tenantId: string;
  result: string;
  httpStatus: number | null;
  failureCode: string | null;
}

export function readApiLogTrace(value: unknown, tenantId: string): ApiLogTrace {
  const input = record(value);
  if (!tenantId || input?.tenantId !== tenantId) {
    throw new Error('Connection diagnostic does not match the selected tenant.');
  }
  const httpStatus = record(input.stage1Upstream)?.httpStatus;
  return {
    tenantId,
    result: text(input.overallStatus) || text(input.status) || 'Not reported',
    httpStatus: typeof httpStatus === 'number' && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? httpStatus : null,
    failureCode: errorCode(input.exactErrorCode) || errorCode(input.errorCode) || null,
  };
}
