import { z } from 'zod';

/** Editorial reference data only. Never use these fields for authorisation or tools. */
export const MAX_ALTIE_FACTS = 40;
export const MAX_ALTIE_FACT_PACK_BYTES = 100_000;
export const ALTIE_FACT_CATEGORIES = ['app', 'retail', 'deliverect', 'operations'] as const;
export const ALTIE_FACT_AUDIENCES = ['superAdmin', 'operators'] as const;

const hasObviousCredential = (text: string): boolean =>
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+/=-]{16,}|\bAIza[0-9A-Za-z_-]{30,}|\bgh[pousr]_[A-Za-z0-9]{20,}|["']?private_key["']?\s*:\s*["']|\b(?:api[_ -]?key|client[_ -]?secret|password|access[_ -]?token)\s*[:=]\s*["']?[A-Za-z0-9_./+\-=]{12,}/i.test(text);

export const AltieFactSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  title: z.string().trim().min(3).max(120),
  category: z.enum(ALTIE_FACT_CATEGORIES),
  audience: z.enum(ALTIE_FACT_AUDIENCES),
  body: z.string().trim().min(10).max(2_000),
  aliases: z.array(z.string().trim().min(2).max(60)).max(12),
  source: z.string().trim().max(240),
  active: z.boolean(),
}).strict().superRefine((fact, context) => {
  if (hasObviousCredential(JSON.stringify(fact))) {
    context.addIssue({ code: 'custom', message: 'Remove credentials from this reference before saving.' });
  }
  // Source references are plain text, not fetched URLs. Do not retain credential-
  // bearing query strings or userinfo in a source URL even for a Super Admin.
  if (/^https?:\/\//i.test(fact.source)) {
    try {
      const url = new URL(fact.source);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        context.addIssue({ code: 'custom', path: ['source'], message: 'Use a clean HTTPS reference without credentials, query parameters or fragments.' });
      }
    } catch {
      context.addIssue({ code: 'custom', path: ['source'], message: 'Use a valid reference URL or a repository path.' });
    }
  }
});

export type AltieFact = z.infer<typeof AltieFactSchema>;

export const AltieFactPackSchema = z.array(AltieFactSchema).max(MAX_ALTIE_FACTS).superRefine((facts, context) => {
  if (new Set(facts.map((fact) => fact.id)).size !== facts.length) {
    context.addIssue({ code: 'custom', message: 'Each fact must have a unique identifier.' });
  }
  if (new TextEncoder().encode(JSON.stringify(facts)).byteLength > MAX_ALTIE_FACT_PACK_BYTES) {
    context.addIssue({ code: 'custom', message: 'The reference pack is too large. Shorten the facts before saving.' });
  }
});

const RevisionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1);
export const AltieFactsStateSchema = z.object({
  revision: RevisionSchema,
  draft: AltieFactPackSchema,
  published: AltieFactPackSchema,
  publishedRevision: RevisionSchema,
  publishedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
}).strict();
export type AltieFactsState = z.infer<typeof AltieFactsStateSchema>;

export const AltieFactsMutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('save-draft'), expectedRevision: RevisionSchema, facts: AltieFactPackSchema }).strict(),
  z.object({ action: z.literal('publish'), expectedRevision: RevisionSchema }).strict(),
  z.object({ action: z.literal('discard-draft'), expectedRevision: RevisionSchema }).strict(),
]);
export type AltieFactsMutation = z.infer<typeof AltieFactsMutationSchema>;

export interface AltieFactsRevision {
  revision: number;
  action: AltieFactsMutation['action'];
  actorId: string;
  at: string;
  publishedRevision: number;
}

export interface AltieBuiltInReference {
  id: string;
  title: string;
  body: string;
  aliases: string[];
  source: string;
  reviewedAt: string;
  audience: AltieFact['audience'];
}

export interface AltieFactsPageData {
  state: AltieFactsState;
  builtIn: AltieBuiltInReference[];
  builtInVersion: string;
  scope: 'PLATFORM';
}

export const emptyAltieFactsState = (): AltieFactsState => ({
  revision: 0, draft: [], published: [], publishedRevision: 0, publishedAt: null, updatedAt: null,
});

/** Match complete normalised words/phrases, not 'sub' inside 'subscription'. */
export function normaliseFactText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function selectPublishedAltieFacts(
  facts: AltieFact[], message: string, actorRole: string, limit = 3
): AltieFact[] {
  const allowedRoles = ['platformSuperAdmin', 'tenantAdmin', 'marketingEditor', 'operationsEditor', 'viewer'];
  if (!allowedRoles.includes(actorRole)) return [];
  const text = ` ${normaliseFactText(message)} `;
  return facts
    .filter((fact) => fact.active && (fact.audience === 'operators' || actorRole === 'platformSuperAdmin'))
    .map((fact) => ({
      fact,
      score: [...new Set([fact.title, ...fact.aliases].map(normaliseFactText))]
        .filter((term) => term && text.includes(` ${term} `)).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id))
    .slice(0, Math.max(0, Math.min(3, Math.floor(limit) || 0)))
    .map(({ fact }) => fact);
}
