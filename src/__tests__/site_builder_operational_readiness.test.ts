import { describe, expect, it } from 'vitest';
import { createSiteWorkspace, evaluateSiteReadiness, publishSite } from '../../server/siteBuilderService';
import type { CmsPage } from '../commerce/cmsModels';

const page: CmsPage = {
  id: 'home-en-gb',
  tenantId: 'tenant-a',
  slug: 'home',
  title: 'Home',
  seoTitle: 'Home',
  seoDescription: 'Home',
  locale: 'en-GB',
  status: 'draft',
  navigationVisibility: 'header',
  blocks: [],
  createdAt: '2026-09-25T00:00:00.000Z',
  updatedAt: '2026-09-25T00:00:00.000Z',
};

describe('site publish operational readiness', () => {
  const workspace = createSiteWorkspace({
    tenantId: 'tenant-a',
    pages: [page],
    now: '2026-09-25T00:00:00.000Z',
  });

  it('blocks publish when persisted integration readiness is NOT_READY', () => {
    const readiness = evaluateSiteReadiness(workspace.draft, {
      operationalReadiness: { status: 'NOT_READY', issueCount: 2 },
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toContainEqual(expect.objectContaining({
      code: 'OPERATIONAL_NOT_READY',
      severity: 'blocker',
    }));
    expect(() => publishSite({
      workspace,
      now: '2026-09-25T00:01:00.000Z',
      readiness: { operationalReadiness: { status: 'NOT_READY', issueCount: 2 } },
    })).toThrow(/OPERATIONAL_NOT_READY/);
  });

  it('surfaces NEEDS_ATTENTION without blocking an otherwise valid publish', () => {
    const readiness = evaluateSiteReadiness(workspace.draft, {
      operationalReadiness: { status: 'NEEDS_ATTENTION', issueCount: 1 },
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.issues).toContainEqual(expect.objectContaining({
      code: 'OPERATIONAL_NOT_READY',
      severity: 'warning',
    }));
  });

  it('keeps held destructive catalogue changes as an explicit blocker', () => {
    const readiness = evaluateSiteReadiness(workspace.draft, {
      operationalReadiness: { status: 'HEALTHY', issueCount: 0 },
      destructiveCatalogChangeHeld: true,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.issues).toContainEqual(expect.objectContaining({
      code: 'CATALOG_CHANGE_HELD',
      severity: 'blocker',
    }));
  });
});
