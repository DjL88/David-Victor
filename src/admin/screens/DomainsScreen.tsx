import React, { useEffect, useMemo, useState } from 'react';
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
  LockKeyhole,
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

const cleanHostname = (value: string): string =>
  value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];

export const DomainsScreen: React.FC<DomainsScreenProps> = ({ tenantId, allTenants = [] }) => {
  const [domains, setDomains] = useState<DomainMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [newHostname, setNewHostname] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentTenant = useMemo(
    () => allTenants.find((tenant) => tenant.tenantId === tenantId),
    [allTenants, tenantId]
  );

  const loadDomains = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const client = getAdminClient();
      if (!client.listAllDomains) throw new Error('Domain management is not available in this Admin client.');
      const data = await client.listAllDomains();
      // The API already applies tenant scoping for tenant admins. Filter again
      // in the UI so even Platform Super Admin sees only the deliberately
      // selected tenant on this page.
      setDomains((data || []).filter((domain: DomainMapping) => domain.tenantId === tenantId));
    } catch (error: any) {
      console.error('Failed to load domains:', error);
      setErrorMessage(error?.message || 'Failed to load domain mappings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDomains();
  }, [tenantId]);

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue((current) => current === value ? null : current), 1800);
    } catch {
      setErrorMessage('Could not copy automatically. Select and copy the DNS value manually.');
    }
  };

  const handleAddDomain = async (event: React.FormEvent) => {
    event.preventDefault();
    const hostname = cleanHostname(newHostname);
    if (!hostname) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const client = getAdminClient();
      if (!client.addOrUpdateDomain) throw new Error('Domain management is not available in this Admin client.');
      await client.addOrUpdateDomain({ hostname, tenantId, isPrimary });
      setNewHostname('');
      setIsPrimary(false);
      setSuccessMessage(`"${hostname}" is claimed for this tenant. Add the exact ownership TXT record shown below, then verify it.`);
      await loadDomains();
    } catch (error: any) {
      console.error('Failed to save domain mapping:', error);
      setErrorMessage(error?.message || 'Failed to save domain mapping.');
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
      if (!client.verifyDomainOwnership) throw new Error('Domain ownership verification is not available in this Admin client.');
      const result = await client.verifyDomainOwnership(domainId);
      setSuccessMessage(
        result?.domain?.status === 'active'
          ? `"${hostname}" is verified and live.`
          : `Ownership of "${hostname}" is verified. Secure serving/TLS is the remaining publish step.`
      );
      await loadDomains();
    } catch (error: any) {
      if (error?.code === 'DOMAIN_OWNERSHIP_NOT_VERIFIED') {
        setErrorMessage(`DNS has not propagated the TXT ownership record for "${hostname}" yet. Check the exact record below and retry.`);
      } else {
        setErrorMessage(error?.message || 'Domain ownership verification failed.');
      }
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteDomain = async (domainId: string, hostname: string) => {
    if (!window.confirm(`Remove "${hostname}" from this tenant? The site content itself will not be deleted.`)) return;
    setDeletingId(domainId);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const client = getAdminClient();
      if (!client.deleteDomain) throw new Error('Domain management is not available in this Admin client.');
      await client.deleteDomain(domainId);
      setSuccessMessage(`"${hostname}" was unbound from this tenant.`);
      await loadDomains();
    } catch (error: any) {
      console.error('Failed to delete domain:', error);
      setErrorMessage(error?.message || 'Failed to remove domain mapping.');
    } finally {
      setDeletingId(null);
    }
  };

  const brandName = currentTenant?.brandName || tenantId;
  const brandColour = currentTenant?.primaryColour || '#4f46e5';

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="shrink-0 rounded-xl bg-indigo-600 p-2 text-white shadow-xs">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Domains</h1>
            <p className="mt-0.5 text-xs text-gray-500">Publish {brandName} to a retailer-owned URL.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadDomains()}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh status
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-950">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
        <div>
          <p className="font-bold">Scoped to this tenant</p>
          <p className="mt-1 text-indigo-900/75">
            This page only displays domains assigned to <strong>{brandName}</strong>. Switching tenant context is the deliberate way for Platform Super Admin to manage another brand.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-xs sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Plus className="h-4 w-4 text-indigo-600" />
            Connect a custom domain
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Claim the hostname first. The platform then gives you the exact TXT ownership record to add at your DNS provider.
          </p>
        </div>

        <form onSubmit={handleAddDomain} className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0 space-y-1">
            <label className="block text-xs font-bold text-gray-700">Domain / hostname</label>
            <input
              value={newHostname}
              onChange={(event) => setNewHostname(event.target.value)}
              placeholder="shop.example.com"
              className="w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono focus:border-indigo-600 focus:outline-none"
              required
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(event) => setIsPrimary(event.target.checked)}
                className="rounded border-gray-300 text-indigo-600"
              />
              Make this the primary storefront domain
            </label>
          </div>
          <button
            type="submit"
            disabled={isSaving || !newHostname.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-gray-800 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-4 w-4" />}
            {isSaving ? 'Claiming…' : 'Connect domain'}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 gap-3">
          <h2 className="text-sm font-bold text-gray-900">Your domains ({domains.length})</h2>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-indigo-600" />
            <p className="mt-2 text-xs font-medium text-gray-500">Checking domain status…</p>
          </div>
        ) : domains.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <Globe className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm font-bold text-gray-800">No custom domain yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-gray-500">Your existing platform URL can continue to serve the storefront until a custom hostname is verified and activated.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {domains.map((domain) => {
              const id = domain.domainId || domain.hostname;
              const ownershipReady = domain.status === 'verified' || domain.status === 'active';
              const tlsReady = domain.tlsStatus === 'ready' || domain.status === 'active';
              const active = domain.status === 'active';
              const deleting = deletingId === id;

              return (
                <article key={id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: brandColour }}>
                          <Globe className="h-4 w-4" />
                        </div>
                        <span className="break-all font-mono text-sm font-bold text-gray-900">{domain.hostname}</span>
                        {domain.isPrimary && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Primary</span>}
                        {active && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Live</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {active && (
                        <a href={`https://${domain.hostname}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                          Open site <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteDomain(id, domain.hostname)}
                        disabled={deleting}
                        className="rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        aria-label={`Remove ${domain.hostname}`}
                      >
                        {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-px border-y border-gray-100 bg-gray-100 sm:grid-cols-4">
                    {[
                      ['1', 'Claimed', true],
                      ['2', 'Ownership', ownershipReady],
                      ['3', 'HTTPS', tlsReady],
                      ['4', 'Live', active],
                    ].map(([step, label, complete]) => (
                      <div key={String(step)} className="bg-white px-3 py-3">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {complete ? '✓' : step}
                          </span>
                          <span className={`font-bold ${complete ? 'text-emerald-800' : 'text-gray-500'}`}>{label}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {!ownershipReady && domain.verificationRecordName && domain.verificationRecordValue && (
                    <div className="space-y-3 bg-amber-50/60 p-4">
                      <div>
                        <p className="text-xs font-bold text-amber-950">Add this exact TXT record</p>
                        <p className="mt-1 text-[11px] text-amber-900/70">This proves ownership only. We deliberately do not show a guessed routing CNAME or IP.</p>
                      </div>
                      {[
                        ['Name / host', domain.verificationRecordName],
                        ['Value', domain.verificationRecordValue],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border border-amber-200 bg-white p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{label}</p>
                          <div className="mt-1 flex min-w-0 items-start gap-2">
                            <code className="min-w-0 flex-1 break-all text-[11px] text-gray-800">{value}</code>
                            <button type="button" onClick={() => void copyValue(value)} className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50" aria-label={`Copy ${label}`}>
                              {copiedValue === value ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => void handleVerifyDomain(id, domain.hostname)}
                        disabled={verifyingId === id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {verifyingId === id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        Verify ownership
                      </button>
                    </div>
                  )}

                  {ownershipReady && !active && (
                    <div className="border-t border-blue-100 bg-blue-50/60 p-4 text-xs text-blue-950">
                      <p className="font-bold">Ownership verified</p>
                      <p className="mt-1 text-blue-900/75">Secure serving and TLS provisioning is the remaining platform step. The UI will only show routing DNS instructions when the configured hosting provider supplies exact values.</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
