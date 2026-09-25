import React, { useState, useEffect } from 'react';
import { TenantConfig } from '../../commerce/models';
import { getAdminClient } from '../../commerce/AdminClient';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Layers,
  Info,
  Copy,
} from 'lucide-react';

export interface DomainMapping {
  domainId: string;
  hostname: string;
  tenantId: string;
  isPrimary?: boolean;
  status?: 'active' | 'verified' | 'pending';
  verificationToken?: string;
  verificationRecordName?: string;
  verificationRecordValue?: string;
  ownershipVerifiedAt?: string;
  tlsStatus?: 'pending' | 'ready' | 'failed';
  createdAt?: string;
  updatedAt?: string;
}

interface DomainsScreenProps {
  tenantId: string;
  allTenants?: TenantConfig[];
}

export const DomainsScreen: React.FC<DomainsScreenProps> = ({ tenantId, allTenants = [] }) => {
  const [domains, setDomains] = useState<DomainMapping[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [newHostname, setNewHostname] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    void loadDomains();
  }, [tenantId]);

  const tenantConfig = allTenants.find((tenant) => tenant.tenantId === tenantId);
  const tenantName = tenantConfig?.brandName || tenantId;
  const tenantColour = tenantConfig?.primaryColour || '#059669';

  const loadDomains = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const client = getAdminClient();
      if (!client.listAllDomains) {
        throw new Error('Domain management is not available in this Admin client.');
      }
      const data = await client.listAllDomains();
      setDomains((data || []).filter((domain: DomainMapping) => domain.tenantId === tenantId));
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
      if (!client.addOrUpdateDomain) {
        throw new Error('Domain management is not available in this Admin client.');
      }
      await client.addOrUpdateDomain({
        hostname: cleanHost,
        tenantId,
        isPrimary,
      });

      setSuccessMessage(
        `Domain "${cleanHost}" has been claimed for ${tenantName} and is pending ownership/TLS verification.`
      );
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

  const handleVerifyDomain = async (domainId: string, hostname: string) => {
    setVerifyingId(domainId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const client = getAdminClient();
      if (!client.verifyDomainOwnership) {
        throw new Error('Domain ownership verification is not available in this Admin client.');
      }

      const result = await client.verifyDomainOwnership(domainId);
      setSuccessMessage(
        result?.domain?.status === 'active'
          ? `Domain "${hostname}" is verified and active.`
          : `Ownership of "${hostname}" is verified. Secure serving/TLS activation is the next step.`
      );
      await loadDomains();
    } catch (e: any) {
      if (e?.code === 'DOMAIN_OWNERSHIP_NOT_VERIFIED') {
        setErrorMessage(
          `DNS has not propagated the verification TXT record for "${hostname}" yet. Check the record below and retry.`
        );
      } else {
        setErrorMessage(e?.message || 'Domain ownership verification failed.');
      }
    } finally {
      setVerifyingId(null);
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
      if (!client.deleteDomain) {
        throw new Error('Domain management is not available in this Admin client.');
      }
      await client.deleteDomain(domainId);

      setSuccessMessage(`Domain "${hostname}" removed.`);
      await loadDomains();
    } catch (e: any) {
      console.error('Failed to delete domain:', e);
      setErrorMessage(e.message || 'Failed to delete domain mapping.');
    } finally {
      setDeletingId(null);
    }
  };

  const copyDnsValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setSuccessMessage(`${label} copied to clipboard.`);
    } catch {
      setErrorMessage(`Could not copy ${label.toLowerCase()}. Select the value and copy it manually.`);
    }
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
                <h1 className="text-xl font-bold text-gray-900">Domains</h1>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Connect and verify domains for the current brand workspace.
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
              This page only manages domains for the current brand. We show DNS records only when they are issued by the platform; we never guess routing IPs or provider values. Ownership verification is required before secure serving can be activated.
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-indigo-600" />
            <span>Connect a domain</span>
          </h2>
          <span className="text-[11px] font-semibold text-gray-500">
            Current brand: <span className="text-gray-800">{tenantName}</span>
          </span>
        </div>
        <p className="text-xs text-gray-500">
          Enter the hostname you own. After it is claimed, copy the exact TXT verification record shown below. Routing records will only be shown when the configured hosting layer provides them.
        </p>

        <form onSubmit={handleAddDomain} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5 space-y-1">
            <label className="block text-xs font-bold text-gray-700">
              Domain / Hostname
            </label>
            <input
              type="text"
              placeholder="e.g. shop.example.com or www.example.com"
              value={newHostname}
              onChange={(e) => setNewHostname(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono bg-white focus:outline-indigo-600 focus:border-indigo-600"
              required
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="block text-xs font-bold text-gray-700">Brand</label>
            <div className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50 font-semibold text-gray-700 truncate">
              {tenantName}
            </div>
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
                Add a published hostname or custom domain above to route shoppers to the correct brand.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs divide-y divide-gray-100">
            {domains.map((dom) => {
              const brandColor = tenantColour;
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
                        {dom.status === 'active' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Active
                          </span>
                        ) : dom.status === 'verified' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Ownership verified · TLS pending
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Pending DNS verification
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>Presents:</span>
                        <span
                          className="font-semibold px-2 py-0.5 rounded-md text-[11px] text-white"
                          style={{ backgroundColor: brandColor }}
                        >
                          {tenantName}
                        </span>
                        <span className="text-gray-400 text-[10px]">
                          Current workspace
                        </span>
                      </div>

                      {dom.status !== 'active' && dom.verificationRecordName && dom.verificationRecordValue && (
                        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[10px] text-gray-600">
                          <p className="font-extrabold uppercase tracking-wide text-gray-500">DNS ownership TXT record</p>
                          <div className="mt-1.5 grid gap-2">
                            <div className="flex items-start gap-2">
                              <p className="min-w-0 flex-1 font-mono break-all"><span className="font-bold text-gray-800">Name:</span> {dom.verificationRecordName}</p>
                              <button type="button" onClick={() => void copyDnsValue('DNS record name', dom.verificationRecordName!)} className="shrink-0 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-indigo-700" aria-label="Copy DNS record name" title="Copy name"><Copy className="h-3.5 w-3.5" /></button>
                            </div>
                            <div className="flex items-start gap-2">
                              <p className="min-w-0 flex-1 font-mono break-all"><span className="font-bold text-gray-800">Value:</span> {dom.verificationRecordValue}</p>
                              <button type="button" onClick={() => void copyDnsValue('DNS record value', dom.verificationRecordValue!)} className="shrink-0 rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-indigo-700" aria-label="Copy DNS record value" title="Copy value"><Copy className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                          {dom.ownershipVerifiedAt && (
                            <p className="mt-1.5 font-sans font-semibold text-blue-700">
                              Ownership verified {new Date(dom.ownershipVerifiedAt).toLocaleString('en-GB')}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {dom.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => void handleVerifyDomain(dom.domainId || dom.hostname, dom.hostname)}
                        disabled={verifyingId === (dom.domainId || dom.hostname)}
                        className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-[10px] font-extrabold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {verifyingId === (dom.domainId || dom.hostname) ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Verify DNS
                      </button>
                    )}

                    {dom.status === 'active' ? (
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
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800">
                        {dom.status === 'verified' ? 'Awaiting secure serving' : 'Awaiting verification'}
                      </span>
                    )}

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
