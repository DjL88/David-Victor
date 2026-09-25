import type { CmsPage } from '../src/commerce/cmsModels';
import type {
  PublishSiteResult,
  SiteNavigation,
  SitePageRef,
  SiteReadinessContext,
  SiteReadinessIssue,
  SiteReadinessResult,
  SiteSnapshot,
  SiteWorkspace,
} from '../src/commerce/siteBuilderModels';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function normalizeNavigation(pages: CmsPage[], navigation?: SiteNavigation): SiteNavigation {
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const supplied = navigation?.items || [];
  const seen = new Set<string>();
  const items: SitePageRef[] = [];

  for (const item of supplied) {
    if (seen.has(item.pageId)) continue;
    const page = pageById.get(item.pageId);
    if (!page) {
      items.push({ ...item });
      seen.add(item.pageId);
      continue;
    }
    items.push({
      ...item,
      label: item.label || page.navigationLabel || page.title,
      placement: item.placement || page.navigationVisibility,
      order: Number.isFinite(item.order) ? item.order : page.navigationOrder ?? 999,
    });
    seen.add(item.pageId);
  }

  for (const page of pages) {
    if (seen.has(page.id)) continue;
    items.push({
      pageId: page.id,
      label: page.navigationLabel || page.title,
      placement: page.navigationVisibility,
      order: page.navigationOrder ?? 999,
    });
  }

  return { items: items.sort((a, b) => a.order - b.order || a.pageId.localeCompare(b.pageId)) };
}

export function createSiteWorkspace(params: {
  tenantId: string;
  pages: CmsPage[];
  now: string;
  actorId?: string;
  navigation?: SiteNavigation;
}): SiteWorkspace {
  if (!params.tenantId.trim()) throw new Error('tenantId is required');
  const draft: SiteSnapshot = {
    tenantId: params.tenantId,
    version: 1,
    state: 'draft',
    pages: clone(params.pages),
    navigation: normalizeNavigation(params.pages, params.navigation),
    createdAt: params.now,
    createdBy: params.actorId,
  };
  return { tenantId: params.tenantId, draft, history: [] };
}

export function saveSiteDraft(params: {
  workspace: SiteWorkspace;
  pages: CmsPage[];
  navigation?: SiteNavigation;
  now: string;
  actorId?: string;
}): SiteWorkspace {
  const { workspace } = params;
  const nextVersion = Math.max(
    workspace.draft.version,
    workspace.published?.version || 0,
    ...workspace.history.map((entry) => entry.version),
  ) + 1;
  return {
    ...clone(workspace),
    draft: {
      tenantId: workspace.tenantId,
      version: nextVersion,
      state: 'draft',
      pages: clone(params.pages),
      navigation: normalizeNavigation(params.pages, params.navigation),
      createdAt: params.now,
      createdBy: params.actorId,
      sourceVersion: workspace.draft.version,
    },
  };
}

function cycleExists(items: SitePageRef[]): boolean {
  const parent = new Map(items.filter((item) => item.parentId).map((item) => [item.pageId, item.parentId!]));
  for (const item of items) {
    const seen = new Set<string>();
    let current: string | undefined = item.pageId;
    while (current && parent.has(current)) {
      if (seen.has(current)) return true;
      seen.add(current);
      current = parent.get(current);
    }
  }
  return false;
}

export function evaluateSiteReadiness(
  snapshot: SiteSnapshot,
  context: SiteReadinessContext = {},
): SiteReadinessResult {
  const issues: SiteReadinessIssue[] = [];
  const activePages = snapshot.pages.filter((page) => page.status !== 'archived');
  const publishablePages = activePages.filter((page) => page.status === 'published' || snapshot.state === 'draft');

  if (publishablePages.length === 0) {
    issues.push({ code: 'NO_PUBLISHABLE_PAGE', severity: 'blocker', message: 'Add at least one page before publishing.' });
  }

  const slugs = new Map<string, string>();
  for (const page of activePages) {
    const key = `${page.locale.toLowerCase()}::${page.slug.trim().toLowerCase()}`;
    const existing = slugs.get(key);
    if (existing && existing !== page.id) {
      issues.push({ code: 'DUPLICATE_SLUG', severity: 'blocker', message: `Duplicate URL slug “${page.slug}” for ${page.locale}.`, pageId: page.id });
    } else slugs.set(key, page.id);
  }

  const pageById = new Map(snapshot.pages.map((page) => [page.id, page]));
  const navSeen = new Set<string>();
  for (const item of snapshot.navigation.items) {
    const page = pageById.get(item.pageId);
    if (!page) {
      issues.push({ code: 'NAV_PAGE_MISSING', severity: 'blocker', message: `Navigation references missing page ${item.pageId}.`, pageId: item.pageId });
      continue;
    }
    if (page.status === 'archived' && item.placement !== 'hidden') {
      issues.push({ code: 'NAV_ARCHIVED_PAGE', severity: 'blocker', message: `Archived page “${page.title}” is still visible in navigation.`, pageId: page.id });
    }
    if (navSeen.has(item.pageId)) {
      issues.push({ code: 'NAV_DUPLICATE_PAGE', severity: 'blocker', message: `Page “${page.title}” appears more than once in navigation.`, pageId: page.id });
    }
    navSeen.add(item.pageId);
    if (item.parentId && !pageById.has(item.parentId)) {
      issues.push({ code: 'NAV_ORPHAN_PARENT', severity: 'blocker', message: `Navigation parent for “${page.title}” no longer exists.`, pageId: page.id });
    }
  }
  if (cycleExists(snapshot.navigation.items)) {
    issues.push({ code: 'NAV_PARENT_CYCLE', severity: 'blocker', message: 'Navigation contains a parent/child cycle.' });
  }

  const home = activePages.find((page) => page.slug === '' || page.slug === '/' || page.slug === 'home');
  if (!home) {
    issues.push({ code: 'HOME_NOT_PUBLISHED', severity: 'warning', message: 'No explicit home page is configured; the existing storefront home surface will remain primary.' });
  }
  if (context.domainSelected && !context.domainVerified) {
    issues.push({ code: 'DOMAIN_NOT_READY', severity: 'blocker', message: 'The selected custom domain must be verified before publishing to it.' });
  }
  if (context.destructiveCatalogChangeHeld) {
    issues.push({ code: 'CATALOG_CHANGE_HELD', severity: 'blocker', message: 'A held destructive catalogue change must be reviewed before launch.' });
  }

  return { ready: !issues.some((issue) => issue.severity === 'blocker'), issues };
}

export function publishSite(params: {
  workspace: SiteWorkspace;
  now: string;
  actorId?: string;
  readiness?: SiteReadinessContext;
}): PublishSiteResult {
  const readiness = evaluateSiteReadiness(params.workspace.draft, params.readiness);
  if (!readiness.ready) {
    const error = new Error(`Site is not ready to publish: ${readiness.issues.filter((issue) => issue.severity === 'blocker').map((issue) => issue.code).join(', ')}`);
    (error as Error & { readiness?: SiteReadinessResult }).readiness = readiness;
    throw error;
  }

  const published: SiteSnapshot = {
    ...clone(params.workspace.draft),
    state: 'published',
    createdAt: params.now,
    createdBy: params.actorId,
  };
  const history = params.workspace.published
    ? [...params.workspace.history, clone(params.workspace.published)]
    : [...params.workspace.history];

  return {
    workspace: { ...clone(params.workspace), published, history },
    publishedVersion: published.version,
  };
}

export function rollbackSite(params: {
  workspace: SiteWorkspace;
  version: number;
  now: string;
  actorId?: string;
}): SiteWorkspace {
  const candidates = [
    ...params.workspace.history,
    ...(params.workspace.published ? [params.workspace.published] : []),
  ];
  const source = candidates.find((entry) => entry.version === params.version);
  if (!source) throw new Error(`Site version ${params.version} was not found.`);
  if (source.tenantId !== params.workspace.tenantId) throw new Error('Cannot restore a site version from another tenant.');

  return saveSiteDraft({
    workspace: params.workspace,
    pages: source.pages,
    navigation: source.navigation,
    now: params.now,
    actorId: params.actorId,
  });
}
