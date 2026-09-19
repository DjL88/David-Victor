import React, { useState, useEffect } from 'react';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { AdminUser, TenantConfig } from '../../commerce/models';
import {
  Users,
  UserPlus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Mail,
  Building2,
  Info,
  Lock,
} from 'lucide-react';

interface MembershipRecord {
  membershipId: string;
  email: string;
  role: string;
  tenantId: string;
  name?: string;
  status: string;
  assignedBy?: string;
  assignedAt?: string;
  updatedAt?: string;
}

interface MembershipsScreenProps {
  currentUser: AdminUser;
  currentTenantId: string;
}

export const MembershipsScreen: React.FC<MembershipsScreenProps> = ({
  currentUser,
  currentTenantId,
}) => {
  const [memberships, setMemberships] = useState<MembershipRecord[]>([]);
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state (for platformSuperAdmin)
  const [selectedTenantFilter, setSelectedTenantFilter] = useState<string>(
    currentUser.isSuperAdmin || currentUser.role === 'platformSuperAdmin' ? 'all' : currentTenantId
  );

  // Add Member Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<string>('tenantAdmin');
  const [newTenantId, setNewTenantId] = useState<string>(currentTenantId || 'brand-alpha');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const isSuperAdmin = currentUser.isSuperAdmin || currentUser.role === 'platformSuperAdmin';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = selectedTenantFilter === 'all' ? undefined : selectedTenantFilter;
      const [membershipsList, tenantsList] = await Promise.all([
        defaultAdminClient.listMemberships(filter),
        isSuperAdmin ? defaultAdminClient.listAllTenants().catch(() => []) : Promise.resolve([]),
      ]);
      setMemberships(membershipsList);
      if (tenantsList.length > 0) {
        const seen = new Set<string>();
        const deduped = (tenantsList || []).filter((t: any) => {
          if (!t?.tenantId || seen.has(t.tenantId)) return false;
          seen.add(t.tenantId);
          return true;
        });
        setTenants(deduped);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team memberships');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedTenantFilter]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newRole) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await defaultAdminClient.createMembership({
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        tenantId: newRole === 'platformSuperAdmin' ? 'platform' : newTenantId,
        name: newName.trim() || undefined,
      });

      setSuccessMessage(`Membership for ${newEmail} created successfully.`);
      setIsAddModalOpen(false);
      setNewEmail('');
      setNewName('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to assign membership');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    setError(null);
    setSuccessMessage(null);
    try {
      await defaultAdminClient.deleteMembership(id);
      setSuccessMessage('Membership revoked successfully.');
      setDeleteConfirmId(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete membership');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'platformSuperAdmin':
      case 'PLATFORM_SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
            Platform SuperAdmin
          </span>
        );
      case 'tenantAdmin':
      case 'TENANT_ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            Tenant Admin
          </span>
        );
      case 'storeManager':
      case 'STORE_MANAGER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
            Store Manager
          </span>
        );
      case 'customerSupport':
      case 'CUSTOMER_SUPPORT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            Customer Support
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Admin Memberships & RBAC</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Section 7 & 27
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Manage authenticated Firebase accounts authorized for platform and tenant operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors"
            title="Refresh Memberships"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-98"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Administrator</span>
          </button>
        </div>
      </div>

      {/* BOOTSTRAP ALLOWLIST NOTICE */}
      <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-blue-950">First-Admin Bootstrap & Permanent RBAC</p>
          <p className="text-blue-800 leading-relaxed">
            When deployed to staging or production, the initial platform administrator is verified via cryptographically checked Firebase tokens matched against{' '}
            <code className="px-1.5 py-0.5 bg-blue-100/80 rounded font-mono font-bold text-blue-900">PLATFORM_SUPERADMIN_EMAILS</code>.
            Once you create authoritative memberships here in Firestore, those users retain their assigned permissions permanently, and the initial environment allowlist can safely be retired.
          </p>
        </div>
      </div>

      {/* ERROR & SUCCESS ALERTS */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-700">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Operation Error</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <p className="font-medium mt-0.5">{successMessage}</p>
        </div>
      )}

      {/* FILTER BAR FOR SUPER ADMIN */}
      {isSuperAdmin && (
        <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-200 text-xs">
          <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="font-semibold text-gray-700">Filter Tenant Scope:</span>
          <select
            value={selectedTenantFilter}
            onChange={(e) => setSelectedTenantFilter(e.target.value)}
            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
          >
            <option value="all">All Scopes (Platform + All Brands)</option>
            <option value="platform">Platform SuperAdmins Only</option>
            {tenants.map((t, idx) => (
              <option key={`membership-filter-${t.tenantId}-${idx}`} value={t.tenantId}>
                {t.brandName} ({t.tenantId})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* MEMBERSHIPS LIST */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Loading memberships...</span>
          </div>
        ) : memberships.length === 0 ? (
          <div className="p-12 text-center text-gray-500 space-y-3">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto text-gray-400">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-gray-800">No Memberships Found</p>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              No memberships configured for this filter scope. Add your first administrator above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="px-6 py-3.5">User Identity</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">Tenant / Brand Scope</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Assigned By</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {memberships.map((m) => {
                  const isCurrentSessionUser = currentUser.email?.toLowerCase() === m.email?.toLowerCase();
                  return (
                    <tr key={m.membershipId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            {m.email ? m.email[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                              <span>{m.name || m.email.split('@')[0]}</span>
                              {isCurrentSessionUser && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 text-indigo-700 font-bold">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-gray-500 text-[11px] flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <span>{m.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">{getRoleBadge(m.role)}</td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {m.tenantId === 'platform' ? 'Global Platform' : m.tenantId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-[11px]">
                        {m.assignedBy || 'System Bootstrap'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {deleteConfirmId === m.membershipId ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[11px] text-red-600 font-bold">Confirm revoke?</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.membershipId)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-[11px] font-bold hover:bg-red-700"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-[11px] hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(m.membershipId)}
                            disabled={isCurrentSessionUser}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isCurrentSessionUser ? 'Cannot revoke your own active membership' : 'Revoke membership'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD MEMBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Assign Administrator Membership</h3>
                  <p className="text-[11px] text-gray-500">Authorize a Firebase account for admin access</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Administrator Email (Firebase Account) *
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="admin@brand.com"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  The user must sign in with this exact email via Firebase Authentication.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Display Name (Optional)</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="tenantAdmin">Tenant Administrator (Full brand management)</option>
                  <option value="storeManager">Store Manager (Fleet & catalog operations)</option>
                  <option value="customerSupport">Customer Support (Orders & audit logs)</option>
                  <option value="analyst">Analyst (Read-only analytics & reporting)</option>
                  {isSuperAdmin && (
                    <option value="platformSuperAdmin">Platform SuperAdmin (Global multi-tenant)</option>
                  )}
                </select>
              </div>

              {newRole !== 'platformSuperAdmin' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tenant Scope *</label>
                  {isSuperAdmin ? (
                    <select
                      value={newTenantId}
                      onChange={(e) => setNewTenantId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                    >
                      {tenants.map((t, idx) => (
                        <option key={`new-member-tenant-${t.tenantId}-${idx}`} value={t.tenantId}>
                          {t.brandName} ({t.tenantId})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={currentTenantId}
                      className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-xs font-mono text-gray-600 cursor-not-allowed"
                    />
                  )}
                </div>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
