import { defaultAdminClient } from '../commerce/HttpAdminClient';
import {
  AltieFactsMutationSchema, AltieFactsStateSchema,
  type AltieFactsMutation, type AltieFactsPageData, type AltieFactsRevision, type AltieFactsState,
} from '../altie/knowledgeFacts';

const MESSAGES: Record<string, string> = {
  FACTS_REVISION_CONFLICT: 'Another session changed the facts. Reload and review before saving or publishing.',
  FACTS_FORBIDDEN: 'Only a Platform Super Admin can manage these facts.',
  AUTH_REQUIRED: 'Sign in again to manage facts.',
  FACTS_INVALID_INPUT: 'Check the fields and limits. Remove credentials, customer data and duplicate fact IDs.',
  FACTS_TOO_LARGE: 'The reference pack is too large. Shorten it before saving.',
  FACTS_RESPONSE_INVALID: 'The server response could not be verified. Reload before retrying; no change is confirmed.',
  FACTS_UNAVAILABLE: 'Facts could not be read or the change confirmed. Your local draft is preserved. Reload to check the server before retrying.',
};

export class AltieFactsClientError extends Error {
  constructor(public readonly code: string, public readonly status = 0) {
    super(MESSAGES[code] || MESSAGES.FACTS_UNAVAILABLE);
    this.name = 'AltieFactsClientError';
  }
}

export interface AltieFactsClient {
  load(signal?: AbortSignal): Promise<AltieFactsPageData>;
  mutate(input: AltieFactsMutation, signal?: AbortSignal): Promise<{ state: AltieFactsState; receipt: AltieFactsRevision }>;
  history(signal?: AbortSignal): Promise<AltieFactsRevision[]>;
  exportReference(signal?: AbortSignal): Promise<string>;
}

export class HttpAltieFactsClient implements AltieFactsClient {
  constructor(private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  private async request(path: string, signal?: AbortSignal, input?: AltieFactsMutation): Promise<Response> {
    try {
      const headers = await defaultAdminClient.getHeadersAsync();
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!headers.Authorization) throw new AltieFactsClientError('AUTH_REQUIRED', 401);
      const response = await this.fetcher(`/api/v1/admin/altie-facts${path}`, {
        method: input ? 'POST' : 'GET', signal, cache: 'no-store',
        headers: { ...headers, 'X-Tenant-ID': 'platform' },
        ...(input ? { body: JSON.stringify(input) } : {}),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code = typeof body?.code === 'string' && MESSAGES[body.code] ? body.code :
          response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'FACTS_FORBIDDEN' : 'FACTS_UNAVAILABLE';
        throw new AltieFactsClientError(code, response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof AltieFactsClientError || (error instanceof Error && error.name === 'AbortError')) throw error;
      throw new AltieFactsClientError('FACTS_UNAVAILABLE');
    }
  }

  private async json(response: Response): Promise<any> {
    if (!response.headers.get('content-type')?.includes('application/json')) throw new AltieFactsClientError('FACTS_RESPONSE_INVALID');
    try { return await response.json(); }
    catch { throw new AltieFactsClientError('FACTS_RESPONSE_INVALID'); }
  }

  async load(signal?: AbortSignal): Promise<AltieFactsPageData> {
    const body = await this.json(await this.request('', signal));
    const state = AltieFactsStateSchema.safeParse(body?.state);
    if (!state.success || body?.scope !== 'PLATFORM' || typeof body?.builtInVersion !== 'string' ||
        !Array.isArray(body?.builtIn) || body.builtIn.length > 60 || !body.builtIn.every((entry: any) =>
          entry && ['id', 'title', 'body', 'source', 'reviewedAt'].every((key) => typeof entry[key] === 'string') &&
          ['superAdmin', 'operators'].includes(entry.audience) && Array.isArray(entry.aliases) &&
          entry.aliases.every((alias: unknown) => typeof alias === 'string'))) {
      throw new AltieFactsClientError('FACTS_RESPONSE_INVALID');
    }
    return { ...body, state: state.data };
  }

  async mutate(input: AltieFactsMutation, signal?: AbortSignal): Promise<{ state: AltieFactsState; receipt: AltieFactsRevision }> {
    if (!AltieFactsMutationSchema.safeParse(input).success) throw new AltieFactsClientError('FACTS_INVALID_INPUT', 400);
    const body = await this.json(await this.request('', signal, input));
    const state = AltieFactsStateSchema.safeParse(body?.state);
    if (!state.success || state.data.revision !== input.expectedRevision + 1 ||
        body?.receipt?.revision !== state.data.revision || body?.receipt?.action !== input.action ||
        typeof body?.receipt?.actorId !== 'string' || typeof body?.receipt?.at !== 'string') {
      throw new AltieFactsClientError('FACTS_RESPONSE_INVALID');
    }
    return { state: state.data, receipt: body.receipt };
  }

  async history(signal?: AbortSignal): Promise<AltieFactsRevision[]> {
    const body = await this.json(await this.request('/history', signal));
    if (!Array.isArray(body?.revisions) || body.revisions.length > 20 || !body.revisions.every((entry: any) =>
      Number.isSafeInteger(entry?.revision) && ['save-draft', 'publish', 'discard-draft'].includes(entry.action) &&
      typeof entry.at === 'string' && typeof entry.actorId === 'string')) throw new AltieFactsClientError('FACTS_RESPONSE_INVALID');
    return body.revisions;
  }

  async exportReference(signal?: AbortSignal): Promise<string> {
    const response = await this.request('/export', signal);
    if (!response.headers.get('content-type')?.includes('text/markdown')) throw new AltieFactsClientError('FACTS_RESPONSE_INVALID');
    return response.text();
  }
}

export const altieFactsClient = new HttpAltieFactsClient();
