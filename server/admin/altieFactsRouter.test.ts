import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { readFileSync } from 'node:fs';

const auth = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock('../firebase', () => ({ verifyAdminSessionWithStatus: auth.verify, getFirestoreDb: () => null }));
vi.mock('../runtimeMode', () => ({ isDemoMode: () => true, isTestMode: () => false }));
import { altieFactsRouter, renderAltieReferenceExport } from './altieFactsRouter';
import { emptyAltieFactsState, type AltieFact } from '../../src/altie/knowledgeFacts';

const fact: AltieFact = {
  id: 'route-note', title: 'Demo reference', body: 'A draft must not become model context before publication.',
  category: 'app', audience: 'superAdmin', aliases: ['demo note'], source: '', active: true,
};
const app = express();
app.use(express.json({ limit: '200kb' }));
app.use('/admin/altie-facts', altieFactsRouter);

beforeEach(() => {
  auth.verify.mockReset();
  auth.verify.mockResolvedValue({ authenticated: true, authorized: true, user: { uid: 'server-super', role: 'platformSuperAdmin', isSuperAdmin: true } });
});

describe('Super Admin facts HTTP boundary', () => {
  it('rejects unauthenticated reads, writes and exports with no private content', async () => {
    auth.verify.mockResolvedValue({ authenticated: false, authorized: false, user: null });
    for (const path of ['', '/export', '/history']) {
      const response = await request(app).get(`/admin/altie-facts${path}`);
      expect(response.status).toBe(401);
      expect(response.text).not.toContain('Application architecture');
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
    expect((await request(app).post('/admin/altie-facts').send({ action: 'publish', expectedRevision: 0 })).status).toBe(401);
  });

  it('ignores spoofed role and tenant inputs and denies authenticated tenant administrators', async () => {
    auth.verify.mockResolvedValue({ authenticated: true, authorized: true, user: { uid: 'tenant-user', role: 'tenantAdmin', isSuperAdmin: false } });
    const response = await request(app).post('/admin/altie-facts')
      .set('Authorization', 'Bearer synthetic-session')
      .set('X-Tenant-ID', 'platform').set('X-Role', 'platformSuperAdmin')
      .send({ action: 'publish', expectedRevision: 0, role: 'platformSuperAdmin' });
    expect(response.status).toBe(403);
    expect(auth.verify).toHaveBeenCalledWith('Bearer synthetic-session', 'platform');
  });

  it('runs the actual draft -> publish service through HTTP and preserves revision conflicts', async () => {
    const initial = await request(app).get('/admin/altie-facts');
    expect(initial.status).toBe(200);
    expect(initial.body.scope).toBe('PLATFORM');
    const previous = initial.body.state.revision;
    const saved = await request(app).post('/admin/altie-facts').send({ action: 'save-draft', expectedRevision: previous, facts: [fact] });
    expect(saved.status).toBe(200);
    expect(saved.body.receipt.actorId).toBe('server-super');
    expect(saved.body.state.published).toEqual(initial.body.state.published);
    const stale = await request(app).post('/admin/altie-facts').send({ action: 'publish', expectedRevision: previous });
    expect(stale.status).toBe(409);
    const published = await request(app).post('/admin/altie-facts').send({ action: 'publish', expectedRevision: saved.body.state.revision });
    expect(published.status).toBe(200);
    expect(published.body.state.published).toEqual([fact]);
    const exported = await request(app).get('/admin/altie-facts/export');
    expect(exported.status).toBe(200);
    expect(exported.headers['content-type']).toContain('text/markdown');
    expect(exported.headers['content-disposition']).toContain('attachment');
    expect(exported.text).toContain(fact.body);
    expect((await request(app).get('/admin/altie-facts/history')).body.revisions[0].action).toBe('publish');
  });

  it('returns bounded authentication failures, not raw errors', async () => {
    auth.verify.mockRejectedValue(new Error('private credentials go here'));
    const response = await request(app).get('/admin/altie-facts');
    expect(response.status).toBe(503);
    expect(response.text).not.toContain('private credentials');
  });

  it('excludes draft and archived text from the reference export', () => {
    const text = renderAltieReferenceExport({ ...emptyAltieFactsState(),
      draft: [{ ...fact, body: 'DRAFT_ONLY_TEXT' }],
      published: [{ ...fact, body: 'ARCHIVED_ONLY_TEXT', active: false }],
    });
    expect(text).not.toContain('DRAFT_ONLY_TEXT');
    expect(text).not.toContain('ARCHIVED_ONLY_TEXT');
    expect(text).toContain('Private Super Admin export');
  });

  it('mounts only after the existing App Check/MFA boundaries and not on the legacy integration alias', () => {
    const source = readFileSync('server/app.ts', 'utf8');
    for (const base of ['/api/v1', '/api/commerce']) {
      expect(source.indexOf(`app.use('${base}/admin', adminSecurityMiddleware)`)).toBeLessThan(
        source.indexOf(`app.use('${base}/admin/altie-facts', altieFactsRouter)`));
    }
    expect(source).not.toContain("app.use('/integrations/deliverect/admin/altie-facts'");
  });
});
