import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AdminUser } from '../commerce/models';
import type { AdminTab } from './AdminLayout';
import { AltieGuidanceNotice, type AltieGuidanceRequest } from './AltieGuidanceNotice';

export type AdminResourceType =
  | 'tenant'
  | 'location'
  | 'product'
  | 'rule'
  | 'story'
  | 'banner'
  | 'page'
  | 'integration'
  | 'domain'
  | 'asset'
  | 'audit';

export interface AdminResourceSelection {
  type: AdminResourceType;
  id: string;
  label?: string;
}

export interface AdminWorkspaceScope {
  organizationId?: string;
  market?: string;
  region?: string;
  locationGroupId?: string;
  locationId?: string;
}

export interface AdminGuideStep {
  section: AdminTab;
  target?: string;
  label: string;
  instruction: string;
  prefill?: Record<string, unknown>;
}

export interface AdminNavigateOptions {
  prefill?: Record<string, unknown>;
  steps?: AdminGuideStep[];
}

export interface AdminWorkspaceSnapshot {
  tenantId: string;
  section: AdminTab;
  actor: Pick<AdminUser, 'id' | 'name' | 'role' | 'tenantId'>;
  scope: AdminWorkspaceScope;
  resource?: AdminResourceSelection;
  filters?: Record<string, string | number | boolean | null>;
}

interface AdminWorkspaceContextValue extends AdminWorkspaceSnapshot {
  setScope: (scope: AdminWorkspaceScope) => void;
  setResource: (resource?: AdminResourceSelection) => void;
  setFilters: (filters?: Record<string, string | number | boolean | null>) => void;
  navigateTo: (section: AdminTab, target?: string, options?: AdminNavigateOptions) => void;
}

const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);

interface AdminWorkspaceProviderProps {
  tenantId: string;
  section: AdminTab;
  actor: AdminUser;
  onNavigate?: (section: AdminTab, target?: string, options?: AdminNavigateOptions) => void;
  children: React.ReactNode;
}

// Reset before descendants render under another identity, not in a later effect.
// This also discards the drawer's conversation/draft state on tenant or role change.
export const AdminWorkspaceProvider: React.FC<AdminWorkspaceProviderProps> = (props) => {
  const { tenantId, actor } = props;
  const identity = JSON.stringify([tenantId, actor.id, actor.role, actor.tenantId]);
  return <AdminWorkspaceSession key={identity} {...props} />;
};

const AdminWorkspaceSession: React.FC<AdminWorkspaceProviderProps> = ({ tenantId, section, actor, onNavigate, children }) => {
  const [scope, setScope] = useState<AdminWorkspaceScope>({});
  const [resource, setResource] = useState<AdminResourceSelection | undefined>();
  const [filters, setFilters] = useState<Record<string, string | number | boolean | null> | undefined>();
  const [guidance, setGuidance] = useState<AltieGuidanceRequest | null>(null);
  const dismissGuidance = useCallback(() => setGuidance(null), []);
  const navigateTo = useCallback((nextSection: AdminTab, target?: string, options?: AdminNavigateOptions) => {
    if (!onNavigate) return;
    // Existing navigation, prefills and approval paths remain authoritative.
    onNavigate(nextSection, target, options);
    const first = options?.steps?.find((step) => step?.section);
    setGuidance({
      section: first?.section || nextSection,
      target: first ? first.target : target,
      label: typeof first?.label === 'string' && first.label.trim() ? first.label : 'Review before saving',
    });
  }, [onNavigate]);

  const value = useMemo<AdminWorkspaceContextValue>(
    () => ({
      tenantId,
      section,
      actor: {
        id: actor.id,
        name: actor.name,
        role: actor.role,
        tenantId: actor.tenantId,
      },
      scope,
      resource,
      filters,
      setScope,
      setResource,
      setFilters,
      navigateTo,
    }),
    [tenantId, section, actor.id, actor.name, actor.role, actor.tenantId, scope, resource, filters, navigateTo]
  );

  return <AdminWorkspaceContext.Provider value={value}>
    {children}
    {guidance && <AltieGuidanceNotice key={JSON.stringify(guidance)} request={guidance} activeSection={section} onDismiss={dismissGuidance} />}
  </AdminWorkspaceContext.Provider>;
};

export function useAdminWorkspace(): AdminWorkspaceContextValue {
  const value = useContext(AdminWorkspaceContext);
  if (!value) {
    throw new Error('useAdminWorkspace must be used within AdminWorkspaceProvider');
  }
  return value;
}
