import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AdminUser } from '../commerce/models';
import type { AdminTab } from './AdminLayout';

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
}

const AdminWorkspaceContext = createContext<AdminWorkspaceContextValue | null>(null);

export const AdminWorkspaceProvider: React.FC<{
  tenantId: string;
  section: AdminTab;
  actor: AdminUser;
  children: React.ReactNode;
}> = ({ tenantId, section, actor, children }) => {
  const [scope, setScope] = useState<AdminWorkspaceScope>({});
  const [resource, setResource] = useState<AdminResourceSelection | undefined>();
  const [filters, setFilters] = useState<Record<string, string | number | boolean | null> | undefined>();

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
    }),
    [tenantId, section, actor.id, actor.name, actor.role, actor.tenantId, scope, resource, filters]
  );

  return <AdminWorkspaceContext.Provider value={value}>{children}</AdminWorkspaceContext.Provider>;
};

export function useAdminWorkspace(): AdminWorkspaceContextValue {
  const value = useContext(AdminWorkspaceContext);
  if (!value) {
    throw new Error('useAdminWorkspace must be used within AdminWorkspaceProvider');
  }
  return value;
}
