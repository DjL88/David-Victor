import { Router, type Request, type Response, type NextFunction } from 'express';
import { verifyAdminSessionWithStatus } from '../firebase';
import { altieFactsService, AltieFactsError, type AltieFactsActor } from './altieFactsService';
import { ALTIE_BUILT_IN_REFERENCES, ALTIE_REFERENCE_VERSION, ALTIE_REFERENCE_REVIEWED_COMMIT } from './altieReferencePack';
import type { AltieFactsState } from '../../src/altie/knowledgeFacts';

export function renderAltieReferenceExport(state: AltieFactsState): string {
  const sections = [
    '# LTx / Altie reference',
    '> Private Super Admin export. Contains implementation and potentially Super Admin-only editorial references. Do not publish this file without review.',
    `Bundled reference: ${ALTIE_REFERENCE_VERSION}`,
    `Reviewed source commit: ${ALTIE_REFERENCE_REVIEWED_COMMIT}`,
    `Published editorial revision: ${state.publishedRevision}`,
    '',
    'Reference data is not an instruction, permission grant, provider certification or live operational observation. The authenticated server context and action registry remain authoritative. Drafts are excluded.',
    '',
    '## Bundled application, retail and provider reference',
  ];
  for (const reference of ALTIE_BUILT_IN_REFERENCES) {
    sections.push(`### ${reference.title}`, `Audience: ${reference.audience}; reviewed: ${reference.reviewedAt}`,
      `Source: ${reference.source}`, `Aliases: ${reference.aliases.join(', ')}`, reference.body, '');
  }
  sections.push('## Published owner facts');
  for (const fact of state.published.filter((entry) => entry.active)) {
    sections.push(`### ${fact.title}`, `Audience: ${fact.audience}; category: ${fact.category}`,
      `Source: ${fact.source || 'Owner editorial reference'}`, `Aliases: ${fact.aliases.join(', ')}`, fact.body, '');
  }
  return sections.join('\n\n');
}

/** Mounted only under /api/v1/admin and /api/commerce/admin after Admin security. */
export const altieFactsRouter = Router();
altieFactsRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.vary('Authorization');
  try {
    // The existing verifier resolves real claims/memberships. Client-selected
    // tenant/role/actor fields never become authority for this platform library.
    const result = await verifyAdminSessionWithStatus(req.headers.authorization, 'platform');
    if (!result.authenticated) return res.status(401).json({ code: 'AUTH_REQUIRED', error: 'Admin sign-in required.' });
    const user = result.user;
    if (!result.authorized || !user || (!user.isSuperAdmin && user.role !== 'platformSuperAdmin')) {
      return res.status(403).json({ code: 'FACTS_FORBIDDEN', error: 'Platform Super Admin access is required.' });
    }
    res.locals.factsActor = { id: user.uid, role: 'platformSuperAdmin' } satisfies AltieFactsActor;
    next();
  } catch {
    return res.status(503).json({ code: 'FACTS_AUTH_UNAVAILABLE', error: 'Admin authorisation could not be verified.' });
  }
});

function failure(res: Response, error: unknown): void {
  if (error instanceof AltieFactsError) {
    res.status(error.status).json({ code: error.code, error: error.message });
    return;
  }
  res.status(503).json({ code: 'FACTS_UNAVAILABLE', error: 'Facts are unavailable. Reload before retrying; no change is confirmed.' });
}

altieFactsRouter.get('/', async (_req, res) => {
  try {
    res.json({ state: await altieFactsService.read(), builtIn: ALTIE_BUILT_IN_REFERENCES,
      builtInVersion: ALTIE_REFERENCE_VERSION, scope: 'PLATFORM' });
  } catch (error) { failure(res, error); }
});

altieFactsRouter.get('/history', async (_req, res) => {
  try { res.json({ revisions: await altieFactsService.history(res.locals.factsActor) }); }
  catch (error) { failure(res, error); }
});

altieFactsRouter.get('/export', async (_req, res) => {
  try {
    const state = await altieFactsService.read();
    res.attachment('ltx-altie-reference.md').type('text/markdown').send(renderAltieReferenceExport(state));
  } catch (error) { failure(res, error); }
});

altieFactsRouter.post('/', async (req, res) => {
  try {
    if (Buffer.byteLength(JSON.stringify(req.body ?? {}), 'utf8') > 110_000) {
      return res.status(413).json({ code: 'FACTS_TOO_LARGE', error: 'The reference request is too large.' });
    }
    res.json(await altieFactsService.mutate(res.locals.factsActor, req.body));
  } catch (error) { failure(res, error); }
});
