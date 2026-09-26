import { selectAltieKnowledge, type AltieKnowledgeSelection, type AltieKnowledgeSource } from './altieKnowledge';
import { altieFactsService } from './altieFactsService';
import { ALTIE_REFERENCE_VERSION, selectBuiltInAltieReferences } from './altieReferencePack';
import { selectPublishedAltieFacts } from '../../src/altie/knowledgeFacts';

export interface AltieReferenceSelection extends Omit<AltieKnowledgeSelection, 'sources'> {
  sources: Array<Omit<AltieKnowledgeSource, 'freshness'> & {
    freshness: AltieKnowledgeSource['freshness'] | 'CURATED_PROVIDER' | 'PUBLISHED_REFERENCE';
  }>;
  editorialStatus: 'AVAILABLE' | 'UNAVAILABLE';
  publishedRevision: number | null;
}

/**
 * Server-only retrieval. The authenticated role, never page/request metadata,
 * selects the audience before any content OR source metadata enters the prompt.
 * No URLs are fetched, no user uploads indexed, and no permissions are derived.
 */
export async function loadAltieKnowledge(args: {
  section?: string; message?: string; actorRole: string;
}): Promise<AltieReferenceSelection> {
  const core = selectAltieKnowledge(args);
  const result: AltieReferenceSelection = {
    ...core,
    version: `${core.version}/${ALTIE_REFERENCE_VERSION}`,
    topics: [...core.topics],
    sources: [...core.sources],
    editorialStatus: 'UNAVAILABLE',
    publishedRevision: null,
  };

  for (const reference of selectBuiltInAltieReferences(args.message || '', args.actorRole)) {
    result.topics.push({ id: reference.id, summary: reference.title, facts: [reference.body] });
    result.sources.push({
      source: reference.source, reviewedAt: reference.reviewedAt,
      freshness: reference.source.startsWith('https:') ? 'CURATED_PROVIDER' : 'CURATED_REPOSITORY',
      note: `${reference.title}. Bundled reviewed reference; not live operational evidence.`,
    });
  }

  try {
    const state = await altieFactsService.read();
    result.editorialStatus = 'AVAILABLE';
    result.publishedRevision = state.publishedRevision;
    result.version += `/facts:${state.publishedRevision}`;
    for (const fact of selectPublishedAltieFacts(state.published, args.message || '', args.actorRole)) {
      result.topics.push({
        id: `editorial:${fact.id}`,
        summary: `${fact.title} (published owner reference; not an instruction or verified live state)`,
        facts: [fact.body],
      });
      result.sources.push({
        source: `facts:${fact.id}@${state.publishedRevision}`,
        reviewedAt: state.publishedAt || '',
        freshness: 'PUBLISHED_REFERENCE',
        note: `${fact.title}${fact.source ? ` — ${fact.source}` : ''}. Publication is editorial review, not provider certification or a permission grant.`,
      });
    }
  } catch {
    // Optional editorial-store failure must not hide bundled knowledge or imply
    // an empty/healthy library. No cached private content is reused across roles.
    result.version += '/facts:unavailable';
  }
  return result;
}
