import { getFirestoreDb } from '../firebase';
import { isDemoMode, isTestMode } from '../runtimeMode';
import {
  AltieFactsMutationSchema, AltieFactsStateSchema, emptyAltieFactsState,
  type AltieFactsMutation, type AltieFactsRevision, type AltieFactsState,
} from '../../src/altie/knowledgeFacts';

export class AltieFactsError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
    this.name = 'AltieFactsError';
  }
}

export interface AltieFactsActor { id: string; role: string; }
const assertSuperAdmin = (actor: AltieFactsActor): void => {
  if (actor.role !== 'platformSuperAdmin' || !actor.id?.trim()) {
    throw new AltieFactsError('FACTS_FORBIDDEN', 403, 'Platform Super Admin access is required.');
  }
};
const unavailable = () => new AltieFactsError(
  'FACTS_UNAVAILABLE', 503, 'The facts store is unavailable. No save or publication is confirmed; reload before retrying.'
);
const memoryAllowed = () => isDemoMode() || isTestMode();
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function parseState(value: unknown): AltieFactsState {
  const parsed = AltieFactsStateSchema.safeParse(value);
  if (!parsed.success || parsed.data.publishedRevision > parsed.data.revision ||
      (parsed.data.publishedRevision === 0 && parsed.data.published.length > 0)) throw unavailable();
  return parsed.data;
}

/** Pure transition: a saved draft never changes the published reference. */
export function transitionAltieFacts(
  current: AltieFactsState, mutation: AltieFactsMutation, at: string
): AltieFactsState {
  if (current.revision !== mutation.expectedRevision) {
    throw new AltieFactsError('FACTS_REVISION_CONFLICT', 409, 'The facts changed in another session. Reload and review before saving or publishing.');
  }
  const revision = current.revision + 1;
  const next: AltieFactsState = { ...copy(current), revision, updatedAt: at };
  if (mutation.action === 'save-draft') next.draft = copy(mutation.facts);
  if (mutation.action === 'discard-draft') next.draft = copy(current.published);
  if (mutation.action === 'publish') {
    next.published = copy(current.draft);
    next.publishedRevision = revision;
    next.publishedAt = at;
  }
  return parseState(next);
}

/**
 * One bounded platform library, not tenant data. Both current state and a full
 * immutable revision/audit snapshot commit in the same Firestore transaction.
 * No direct browser writes, no new queues/indexes, no live-memory fallback.
 */
export class AltieFactsService {
  private memory = emptyAltieFactsState();
  private memoryHistory: Array<AltieFactsRevision & { state: AltieFactsState }> = [];

  constructor(private readonly dbProvider: typeof getFirestoreDb = getFirestoreDb) {}

  async read(): Promise<AltieFactsState> {
    if (memoryAllowed()) return copy(this.memory);
    const db = this.dbProvider();
    if (!db) throw unavailable();
    try {
      const snapshot = await db.collection('platformKnowledge').doc('altieFacts').get();
      return snapshot.exists ? parseState(snapshot.data()) : emptyAltieFactsState();
    } catch { throw unavailable(); }
  }

  async mutate(actor: AltieFactsActor, input: unknown): Promise<{ state: AltieFactsState; receipt: AltieFactsRevision }> {
    assertSuperAdmin(actor);
    const parsed = AltieFactsMutationSchema.safeParse(input);
    if (!parsed.success) {
      throw new AltieFactsError('FACTS_INVALID_INPUT', 400,
        'Check the fact fields, unique IDs, size limits and clean references. Never include credentials or personal/customer data.');
    }
    const mutation = parsed.data;
    const at = new Date().toISOString();
    const build = (current: AltieFactsState) => {
      const state = transitionAltieFacts(current, mutation, at);
      const receipt: AltieFactsRevision = {
        revision: state.revision, action: mutation.action, actorId: actor.id,
        at, publishedRevision: state.publishedRevision,
      };
      return { state, receipt };
    };

    if (memoryAllowed()) {
      // No await between compare and publication in the explicit demo/test store.
      const result = build(this.memory);
      this.memory = copy(result.state);
      this.memoryHistory.push({ ...copy(result.receipt), state: copy(result.state) });
      return copy(result);
    }

    const db = this.dbProvider();
    if (!db) throw unavailable();
    const ref = db.collection('platformKnowledge').doc('altieFacts');
    try {
      return await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const current = snapshot.exists ? parseState(snapshot.data()) : emptyAltieFactsState();
        const result = build(current);
        transaction.set(ref, result.state);
        transaction.create(ref.collection('revisions').doc(String(result.state.revision).padStart(12, '0')), {
          ...result.receipt, state: result.state,
        });
        return result;
      });
    } catch (error) {
      if (error instanceof AltieFactsError && error.code === 'FACTS_REVISION_CONFLICT') throw error;
      // Includes an uncertain commit response: never promise that nothing changed.
      throw unavailable();
    }
  }

  async history(actor: AltieFactsActor): Promise<AltieFactsRevision[]> {
    assertSuperAdmin(actor);
    const project = (entry: AltieFactsRevision): AltieFactsRevision => ({
      revision: entry.revision, action: entry.action, actorId: entry.actorId,
      at: entry.at, publishedRevision: entry.publishedRevision,
    });
    if (memoryAllowed()) return this.memoryHistory.slice(-20).reverse().map(project);
    const db = this.dbProvider();
    if (!db) throw unavailable();
    try {
      // A single-field bounded query; no composite index or cloud change needed.
      const snapshot = await db.collection('platformKnowledge').doc('altieFacts')
        .collection('revisions').orderBy('revision', 'desc').limit(20).get();
      return snapshot.docs.map((doc) => project(doc.data() as AltieFactsRevision));
    } catch { throw unavailable(); }
  }
}

export const altieFactsService = new AltieFactsService();
