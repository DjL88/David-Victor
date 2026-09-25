import type { CmsPage, NavigationVisibility } from './cmsModels';

export type SitePublishState = 'draft' | 'published';
export type SitePlacement = NavigationVisibility;
export type SiteReadinessSeverity = 'blocker' | 'warning';

export interface SitePageRef {
  pageId: string;
  parentId?: string;
  label: string;
  placement: SitePlacement;
  order: number;
}

export interface SiteNavigation { items: SitePageRef[]; }

export interface SiteSnapshot {
  tenantId: string;
  version: number;
  state: SitePublishState;
  pages: CmsPage[];
  navigation: SiteNavigation;
  createdAt: string;
  createdBy?: string;
  sourceVersion?: number;
  publishAt?: string;
}

export interface SiteWorkspace {
  tenantId: string;
  draft: SiteSnapshot;
  published?: SiteSnapshot;
  history: SiteSnapshot[];
}

export type SiteReadinessCode =
  | 'NO_PUBLISHABLE_PAGE' | 'DUPLICATE_SLUG' | 'NAV_PAGE_MISSING'
  | 'NAV_ARCHIVED_PAGE' | 'NAV_DUPLICATE_PAGE' | 'NAV_ORPHAN_PARENT'
  | 'NAV_PARENT_CYCLE' | 'HOME_NOT_PUBLISHED' | 'DOMAIN_NOT_READY'
  | 'CATALOG_CHANGE_HELD';

export interface SiteReadinessIssue {
  code: SiteReadinessCode;
  severity: SiteReadinessSeverity;
  message: string;
  pageId?: string;
}

export interface SiteReadinessContext {
  domainSelected?: boolean;
  domainVerified?: boolean;
  destructiveCatalogChangeHeld?: boolean;
}

export interface SiteReadinessResult { ready: boolean; issues: SiteReadinessIssue[]; }
export interface PublishSiteResult { workspace: SiteWorkspace; publishedVersion: number; }
