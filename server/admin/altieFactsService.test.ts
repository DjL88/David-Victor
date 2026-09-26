import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AltieFactPackSchema, AltieFactSchema, emptyAltieFactsState, selectPublishedAltieFacts, type AltieFact } from '../../src/altie/knowledgeFacts';

const runtime = vi.hoisted(() => ({ demo: false }));
vi.mock('../runtimeMode', () => ({ isDemoMode: () => runtime.demo, isTestMode: () => false }));
vi.mock('../firebase', () => ({ getFirestoreDb: () => null }));
import { AltieFactsService, transitionAltieFacts } from './altieFactsService';
import { ALTIE_BUILT_IN_REFERENCES, selectBuiltInAltieReferences } from './altieReferencePack';

const actor = { id: 'verified-super', role: 'platformSuperAdmin' };
const fact = (overrides: Partial<AltieFact> = {}): AltieFact => ({
  id: 'retail-note', title: 'Replacement terms', body: 'Replacement is not proof of customer approval.',
  category: 'retail', audience: 'operators', aliases: ['sub'], source: 'docs/ARCHITECTURE.md', active: true,
  ...overrides,
});

function fakeFirestore() {
  let stored: any = undefined;
  let failAudit = false;
  const revisions: any[] = [];
  const limit = vi.fn(() => ({ get: async () => ({ docs: revisions.slice(-20).reverse().map((entry) => ({ data: () => entry })) }) }));
  const orderBy = vi.fn(() => ({ limit }));
  const historyCollection = { doc: (id: string) => ({ id }), orderBy };
  const ref = { get: async () => ({ exists: stored !== undefined, data: () => structuredClone(stored) }), collection: () => historyCollection };
  const set = vi.fn();
  const create = vi.fn();
  const db = {
    collection: vi.fn(() => ({ doc: () => ref })),
    runTransaction: vi.fn(async (work: any) => {
      let pendingState: any;
      let pendingAudit: any;
      const result = await work({
        get: async () => ({ exists: stored !== undefined, data: () => structuredClone(stored) }),
        set: (target: any, state: any) => { set(target, state); pendingState = structuredClone(state); },
        create: (target: any, record: any) => { create(target, record); if (failAudit) throw new Error('private provider detail'); pendingAudit = structuredClone(record); },
      });
      stored = pendingState;
      revisions.push(pendingAudit);
      return result;
    }),
  };
  return { db, set, create, orderBy, limit, revisions, failAudit: () => { failAudit = true; } };
}

beforeEach(() => { runtime.demo = false; vi.clearAllMocks(); });

describe('Altie editorial schema and retrieval', () => {
  it('requires explicit audiences and rejects extra authority fields, duplicate IDs and credentials', () => {
    expect(AltieFactSchema.safeParse(fact()).success).toBe(true);
    expect(AltieFactSchema.safeParse({ ...fact(), audience: undefined }).success).toBe(false);
    expect(AltieFactSchema.safeParse({ ...fact(), role: 'platformSuperAdmin' }).success).toBe(false);
    expect(AltieFactPackSchema.safeParse([fact(), fact()]).success).toBe(false);
    expect(AltieFactSchema.safeParse(fact({ body: `Do not retain this Bearer ${'x'.repeat(30)}` })).success).toBe(false);
    expect(AltieFactSchema.safeParse(fact({ source: 'https://example.com/page?token=private' })).success).toBe(false);
    expect(AltieFactSchema.safeParse(fact({ source: 'https://user:pass@example.com/page' })).success).toBe(false);
    expect(AltieFactPackSchema.safeParse(Array.from({ length: 41 }, (_, i) => fact({ id: `fact-${i}` }))).success).toBe(false);
  });

  it('matches whole-word aliases and filters private/archived content before ranking', () => {
    const facts = [fact(), fact({ id: 'private', audience: 'superAdmin', body: 'Internal implementation reference only.' }), fact({ id: 'archived', active: false })];
    expect(selectPublishedAltieFacts(facts, 'subscription', 'tenantAdmin')).toEqual([]);
    expect(selectPublishedAltieFacts(facts, 'Explain a SUB?', 'tenantAdmin').map((entry) => entry.id)).toEqual(['retail-note']);
    expect(selectPublishedAltieFacts(facts, 'Explain a sub?', 'platformSuperAdmin')).toHaveLength(2);
    expect(selectPublishedAltieFacts(facts, 'Explain a sub?', 'inventedRole')).toEqual([]);
  });

  it('keeps bundled sources real, bounded and architecture restricted', () => {
    for (const reference of ALTIE_BUILT_IN_REFERENCES) {
      if (reference.source.startsWith('https:')) expect(new URL(reference.source).hostname).toBe('developers.deliverect.com');
      else expect(existsSync(resolve(reference.source))).toBe(true);
      expect(reference.body.length).toBeLessThanOrEqual(2000);
    }
    expect(selectBuiltInAltieReferences('Explain architecture', 'tenantAdmin')).toEqual([]);
    expect(selectBuiltInAltieReferences('Explain architecture', 'platformSuperAdmin').map((entry) => entry.id)).toContain('app-architecture');
    expect(selectBuiltInAltieReferences('Explain a sub', 'tenantAdmin')[0].body).toContain('line total');
    const rules = readFileSync(resolve('firestore.rules'), 'utf8');
    expect(rules).toContain('match /{document=**}');
    expect(rules).not.toMatch(/match \/platformKnowledge.*allow read: if true/s);
  });
});

describe('Altie facts production persistence service', () => {
  it('saves a draft without changing publication, then publishes and archives explicitly', async () => {
    const fake = fakeFirestore();
    const service = new AltieFactsService(() => fake.db as any);
    const saved = await service.mutate(actor, { action: 'save-draft', expectedRevision: 0, facts: [fact()] });
    expect(saved.state.published).toEqual([]);
    expect(saved.state.draft).toHaveLength(1);
    const published = await service.mutate(actor, { action: 'publish', expectedRevision: 1 });
    expect(published.state.publishedRevision).toBe(2);
    expect(published.state.published).toEqual([fact()]);
    await service.mutate(actor, { action: 'save-draft', expectedRevision: 2, facts: [fact({ active: false })] });
    expect((await service.read()).published[0].active).toBe(true);
    await service.mutate(actor, { action: 'publish', expectedRevision: 3 });
    expect((await service.read()).published[0].active).toBe(false);
    expect(fake.create).toHaveBeenCalledTimes(4);
    expect(fake.revisions[1]).toMatchObject({ action: 'publish', actorId: actor.id, state: { publishedRevision: 2 } });
    expect(fake.db.runTransaction).toHaveBeenCalledTimes(4);
  });

  it('rejects stale publish/save and forged authority without writing', async () => {
    const fake = fakeFirestore();
    const service = new AltieFactsService(() => fake.db as any);
    await service.mutate(actor, { action: 'save-draft', expectedRevision: 0, facts: [fact()] });
    await expect(service.mutate(actor, { action: 'publish', expectedRevision: 0 })).rejects.toMatchObject({ code: 'FACTS_REVISION_CONFLICT', status: 409 });
    await expect(service.mutate({ id: 'tenant-admin', role: 'tenantAdmin' }, { action: 'publish', expectedRevision: 1 })).rejects.toMatchObject({ status: 403 });
    await expect(service.mutate(actor, { action: 'publish', expectedRevision: 1, tenantId: 'foreign', role: 'platformSuperAdmin' })).rejects.toMatchObject({ status: 400 });
    expect(fake.set).toHaveBeenCalledTimes(1);
    expect((await service.read()).published).toEqual([]);
  });

  it('fails closed if the audit write fails and does not claim persistence', async () => {
    const fake = fakeFirestore(); fake.failAudit();
    const service = new AltieFactsService(() => fake.db as any);
    const result = await service.mutate(actor, { action: 'save-draft', expectedRevision: 0, facts: [fact()] }).catch((error) => error);
    expect(result).toMatchObject({ code: 'FACTS_UNAVAILABLE', status: 503 });
    expect(result.message).not.toContain('private provider');
    expect(await service.read()).toEqual(emptyAltieFactsState());
    expect(fake.revisions).toEqual([]);
  });

  it('never treats a missing live database as an empty successful library', async () => {
    const service = new AltieFactsService(() => null);
    await expect(service.read()).rejects.toMatchObject({ status: 503 });
    await expect(service.mutate(actor, { action: 'publish', expectedRevision: 0 })).rejects.toMatchObject({ status: 503 });
    await expect(service.history(actor)).rejects.toMatchObject({ status: 503 });
  });

  it('reads bounded revision history through the durable service', async () => {
    const fake = fakeFirestore();
    const service = new AltieFactsService(() => fake.db as any);
    await service.mutate(actor, { action: 'save-draft', expectedRevision: 0, facts: [fact()] });
    expect(await service.history(actor)).toEqual([expect.objectContaining({ revision: 1, action: 'save-draft', actorId: actor.id })]);
    expect(fake.orderBy).toHaveBeenCalledWith('revision', 'desc');
    expect(fake.limit).toHaveBeenCalledWith(20);
  });

  it('uses memory only in explicit demo/test mode and restores published draft', async () => {
    runtime.demo = true;
    const service = new AltieFactsService(() => { throw new Error('must not access live storage'); });
    const saved = await service.mutate(actor, { action: 'save-draft', expectedRevision: 0, facts: [fact()] });
    const discarded = transitionAltieFacts(saved.state, { action: 'discard-draft', expectedRevision: 1 }, '2026-09-26T00:00:00Z');
    expect(discarded.draft).toEqual([]);
    expect(discarded.revision).toBe(2);
  });
});
