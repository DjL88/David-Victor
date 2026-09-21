import React, { useState, useEffect } from 'react';
import { TenantConfig } from '../../commerce/models';
import { getAdminClient } from '../../commerce/AdminClient';
import { MOCK_TENANTS } from '../../commerce/mockData';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';

export interface DomainMapping {
  domainId: string;
  hostname: string;
  tenantId: string;
  isPrimary?: boolean;
  status?: 'active' | 'pending';
  createdAt?: string;
  updatedAt?: string;
}

interface DomainsScreenProps {
  tenantId: string;
  allTenants?: TenantConfig[];
}

export const DomainsScreen: React.FC<DomainsScreenProps> = ({ tenantId, allTenants = [] }) => {
  const [domains, setDomains] = useState<DomainMapping[]>([]);
  const [tenantsList, setTenantsList] = useState<TenantConfig[]>(
    allTenants.length > 0 ? allTenants : Object.values(MOCK_TENANTS)
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [newHostname, setNewHostname] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState(tenantId || 'brand-alpha');
  const [isPrimary, setIsPrimary] = useState(false);
  const [showDnsHelp, setShowDnsHelp] = useState(false);

  useEffect(() => {
    if (allTenants && allTenants.length > 0) {
      const seen = new Set<string>();
      const deduped = (allTenants || []).filter((t: any) => {
        if (!t?.tenantId || seen.has(t.tenantId)) return false;
        seen.add(t.tenantId);
        return true;
      });
      setTenantsList(deduped);
    } else {
      loadTenants();
    }
    loadDomains();
  }, [tenantId]);

  const loadTenants = async () => {
    try {
      const client = getAdminClient();
      const list = await client.listAllTenants();
      if (list && list.length > 0) {
        const seen = new Set<string>();
        const deduped = (list || []).filter((t: any) => {
          if (!t?.tenantId || seen.has(t.tenantId)) return false;
          seen.add(t.tenantId);
          return true;
        });
        setTenantsList(deduped);
      }
    } catch (e) {
      console.warn('Could not fetch tenants list:', e);
    }
  };

  const loadDomains = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const client = getAdminClient();
      if (client.listAllDomains) {
        const data = await client.listAllDomains();
        setDomains(data || []);
      } else {
        const res = await fetch('/api/v1/admin/domains');
        if (res.ok) {
          const data = await res.json();
          setDomains(data || []);
        }
      }
    } catch (e: any) {
      console.error('Failed to load domains:', e);
      setErrorMessage(e.message || 'Failed to load domain mappings.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHostname.trim()) return;

    let cleanHost = newHostname.trim().toLowerCase();
    // Strip protocol if user pasted https://
    cleanHost = cleanHost.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const client = getAdminClient();
      if (client.addOrUpdateDomain) {
        await client.addOrUpdateDomain({
          hostname: cleanHost,
          tenantId: selectedTenantId,
          isPrimary,
        });
      } else {
        const res = await fetch('/api/v1/admin/domains', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostname: cleanHost,
            tenantId: selectedTenantId,
            isPrimary,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to map domain.');
        }
      }

      setSuccessMessage(`Domain "${cleanHost}" successfully mapped to ${getTenantName(selectedTenantId)}!`);
      setNewHostname('');
      setIsPrimary(false);
      await loadDomains();
    } catch (e: any) {
      console.error('Failed to save domain mapping:', e);
      setErrorMessage(e.message || 'Failed to save domain mapping.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDomain = async (domainId: string, hostname: string) => {
    if (!window.confirm(`Are you sure you want to remove the domain mapping for "${hostname}"?`)) {
      return;
    }

    setDeletingId(domainId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const client = getAdminClient();
      if (client.deleteDomain) {
        await client.deleteDomain(domainId);
      } else {
        const res = await fetch(`/api/v1/admin/domains/${encodeURIComponent(domainId)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to delete domain.');
        }
      }

      setSuccessMessage(`Domain "${hostname}" removed.`);
      await loadDomains();
    } catch (e: any) {
      console.error('Failed to delete domain:', e);
      setErrorMessage(e.message || 'Failed to delete domain mapping.');
    } finally {
      setDeletingId(null);
    }
  };

  const getTenantName = (tId: string): string => {
    const found = tenantsList.find((t) => t.tenantId === tId);
    return found?.brandName || tId;
  };

  const getTenantColor = (tId: string): string => {
    const found = tenantsList.find((t) => t.tenantId === tId);
    return found?.primaryColour || '#059669';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">Domains & brand routing</h1>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Associate published hostnames and custom domains with the correct storefront brand.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDomains}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh domains</span>
          </button>
        </div>
      </div>

      {/* HOW ROUTING WORKS BANNER */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-emerald-50/50 border border-indigo-100/90 shadow-2xs">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-gray-700 leading-relaxed">
            <p className="font-bold text-indigo-950">
              How domain routing works
            </p>
            <p>
              Each configured hostname resolves to its assigned brand automatically. Customers can open the storefront normally without selecting a tenant or adding brand parameters to the URL.
            </p>
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ADD / MAP DOMAIN FORM */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Map a domain to a brand</span>
          </h2>
          <button
            type="button"
            onClick={() => setShowDnsHelp(!showDnsHelp)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {showDnsHelp ? 'Hide DNS Setup Guide' : 'View DNS Records Guide'}
          </button>
        </div>

        {showDnsHelp && (
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2 text-gray-600">
            <p className="font-bold text-gray-900">Configuring Custom Domains at your DNS Registrar:</p>
            <p>To point a domain like <code>www.shop1.com</code> to this application:</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left font-mono text-[11px] bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="p-2">Type</th>
                    <th className="p-2">Host / Name</th>
                    <th className="p-2">Target / Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="p-2 text-indigo-600 font-bold">CNAME</td>
                    <td className="p-2">www (or subdomain)</td>
                    <td className="p-2">1bwydi.ai.studio (or your published app URL)</td>
                  </tr>
                  <tr>
                    <td className="p-2 text-indigo-600 font-bold">A</td>
                    <td className="p-2">@ (root/apex)</td>
                    <td className="p-2">Your Cloud Run or reverse-proxy IP</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form onSubmit={handleAddDomain} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5 space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Domain / Hostname
            </label>
            <input
              type="text"
              placeholder="e.g. 1bwydi.ai.studio, www.shop1.com, shop2.com"
              value={newHostname}
              onChange={(e) => setNewHostname(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono bg-white focus:outline-indigo-600 focus:border-indigo-600"
              required
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Assigned Brand
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => setSelectedTenantId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:outline-indigo-600 focus:border-indigo-600 font-semibold"
            >
              {tenantsList.map((t, idx) => (
                <option key={`domain-brand-opt-${t.tenantId}-${idx}`} value={t.tenantId}>
                  {t.brandName} ({t.tenantId})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <span className="text-xs text-gray-700 font-medium">Primary Domain</span>
            </label>

            <button
              type="submit"
              disabled={isSaving || !newHostname.trim()}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5 shadow-xs shrink-0"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add domain</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ACTIVE DOMAINS LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Configured domains ({domains.length})</span>
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 space-y-2">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs text-gray-500 font-medium">Loading domain bindings...</p>
          </div>
        ) : domains.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 space-y-3">
            <Globe className="w-8 h-8 text-gray-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-800">No Custom Domains Configured</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Add your published AI Studio hostname (e.g. <code>1bwydi.ai.studio</code>) or custom brand domains above to automatically route shoppers to their respective stores.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs divide-y divide-gray-100">
            {domains.map((dom) => {
              const brand = tenantsList.find((t) => t.tenantId === dom.tenantId);
              const brandColor = brand?.primaryColour || '#059669';
              const isDeleting = deletingId === dom.domainId || deletingId === dom.hostname;

              return (
                <div
                  key={dom.domainId || dom.hostname}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs font-bold text-xs"
                      style={{ backgroundColor: brandColor }}
                    >
                      <Globe className="w-5 h-5 text-white" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-gray-900">
                          {dom.hostname}
                        </span>
                        {dom.isPrimary && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Primary
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Configured
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Presents:</span>
                        <span
                          className="font-semibold px-2 py-0.5 rounded-md text-[11px] text-white"
                          style={{ backgroundColor: brandColor }}
                        >
                          {brand?.brandName || dom.tenantId}
                        </span>
                        <span className="text-gray-400 font-mono text-[10px]">
                          ({dom.tenantId})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`https://${dom.hostname}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 shadow-2xs"
                      title={`Open https://${dom.hostname} in new tab`}
                    >
                      <span>Open Storefront</span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleDeleteDomain(dom.domainId || dom.hostname, dom.hostname)}
                      disabled={isDeleting}
                      className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Unbind domain mapping"
                    >
                      {isDeleting ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-red-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
