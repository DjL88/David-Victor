import React, { useState, useEffect } from 'react';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { TenantConfig, AdminUser } from '../../commerce/models';
import { BwydiLogo } from '../../components/BwydiLogo';
import { FeatureSwitchesPanel } from '../components/FeatureSwitchesPanel';
import {
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Palette,
  Globe,
  Mail,
  Layers,
  Store,
  Trash2,
  Sliders,
} from 'lucide-react';

interface BrandsScreenProps {
  currentUser: AdminUser;
  onSelectTenant: (tenantId: string) => void;
}

export const BrandsScreen: React.FC<BrandsScreenProps> = ({ currentUser, onSelectTenant }) => {
  const [tenants, setTenants] = useState<TenantConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provisioning Wizard Modal
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provisionSuccess, setProvisionSuccess] = useState<TenantConfig | null>(null);

  // Wizard form state
  const [brandName, setBrandName] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [primaryColour, setPrimaryColour] = useState('#059669');
  const [secondaryColour, setSecondaryColour] = useState('#10B981');
  const [fontFamily, setFontFamily] = useState('Plus Jakarta Sans');
  const [headingFontFamily, setHeadingFontFamily] = useState('Playfair Display');
  const [currency, setCurrency] = useState('GBP');
  const [country, setCountry] = useState('GB');
  const [defaultDomain, setDefaultDomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [initialIntegration, setInitialIntegration] = useState<'standalone' | 'deliverect'>('standalone');

  // Feature Flags Modal state
  const [selectedFeatureFlagsTenant, setSelectedFeatureFlagsTenant] = useState<string | null>(null);

  const isSuperAdmin = currentUser.role === 'platformSuperAdmin';

  const loadTenants = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await defaultAdminClient.listAllTenants();
      const seen = new Set<string>();
      const deduped = (list || []).filter((t) => {
        if (!t?.tenantId || seen.has(t.tenantId)) return false;
        seen.add(t.tenantId);
        return true;
      });
      setTenants(deduped);
    } catch (err: any) {
      setError(err.message || 'Failed to load brands from platform database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleNameChange = (val: string) => {
    setBrandName(val);
    if (!tenantId || tenantId === brandName.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setTenantId(val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
    }
    if (!defaultDomain) {
      setDefaultDomain(`${val.toLowerCase().replace(/[^a-z0-9]/g, '')}.retail.platform`);
    }
  };

  const handleProvisionBrand = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const newTenant = await defaultAdminClient.provisionBrand({
        tenantId,
        brandName,
        primaryColour,
        secondaryColour,
        fontFamily,
        headingFontFamily,
        adminEmail,
        adminName,
      });

      setProvisionSuccess(newTenant);
      await loadTenants();
    } catch (err: any) {
      setError(err.message || 'Brand provisioning failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBrand = async (targetTenantId: string, brandTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete brand "${brandTitle}" (${targetTenantId})? This action cannot be undone.`)) {
      return;
    }
    setError(null);
    try {
      await defaultAdminClient.deleteBrand(targetTenantId);
      await loadTenants();
    } catch (err: any) {
      setError(err.message || 'Failed to delete brand.');
    }
  };

  const resetWizard = () => {
    setIsWizardOpen(false);
    setWizardStep(1);
    setProvisionSuccess(null);
    setBrandName('');
    setTenantId('');
    setPrimaryColour('#059669');
    setSecondaryColour('#10B981');
    setDefaultDomain('');
    setAdminEmail('');
    setAdminName('');
  };

  if (!isSuperAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center space-y-3">
        <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl inline-flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-semibold text-sm">Restricted to Platform SuperAdmins</span>
        </div>
        <p className="text-sm text-gray-500">
          Brand creation and cross-tenant provisioning requires Platform SuperAdmin credentials.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <BwydiLogo variant="icon" color="aubergine" size="sm" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Brands</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
              Platform SuperAdmin
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Create and manage white-label brands, domains and commerce connections.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New brand</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tenants Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 text-sm">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading platform tenants from Firestore...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tenants.map((t, idx) => (
            <div
              key={`brand-card-${t.tenantId}-${idx}`}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-xs"
                      style={{ backgroundColor: t.primaryColour || '#059669' }}
                    >
                      {t.brandName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 leading-snug">{t.brandName}</h3>
                      <p className="text-xs font-mono text-gray-400">{t.tenantId}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      t.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t.status || 'ACTIVE'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-600 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Primary Color</span>
                    <span className="font-mono font-medium flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-full border border-gray-200"
                        style={{ backgroundColor: t.primaryColour || '#059669' }}
                      />
                      {t.primaryColour}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Domain</span>
                    <span className="font-medium text-gray-700 truncate max-w-[180px]">
                      {t.defaultDomain || `${t.tenantId}.retail.platform`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Typography</span>
                    <span className="font-medium text-gray-700">{t.fontFamily || 'Default'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectTenant(t.tenantId)}
                  className="flex-1 py-2 px-3 bg-gray-50 hover:bg-gray-100 text-gray-800 text-xs font-semibold rounded-xl transition-colors text-center"
                >
                  Manage Brand
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFeatureFlagsTenant(t.tenantId)}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  title="Feature Flags & Capabilities"
                >
                  <Sliders className="w-4 h-4" />
                </button>
                <a
                  href={`?brand=${t.tenantId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                  title="Open Storefront"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => handleDeleteBrand(t.tenantId, t.brandName || t.tenantId)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete Brand"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7-Step Brand Provisioning Wizard Modal */}
      {isWizardOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95">
            {/* Wizard Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                  Step {wizardStep} of 7
                </span>
                <h2 className="text-lg font-bold text-gray-900">
                  {wizardStep === 1 && 'Brand basics'}
                  {wizardStep === 2 && 'Visual identity'}
                  {wizardStep === 3 && 'Typography'}
                  {wizardStep === 4 && 'Language & currency'}
                  {wizardStep === 5 && 'Storefront domain'}
                  {wizardStep === 6 && 'Administrator'}
                  {wizardStep === 7 && 'Review'}
                </h2>
              </div>
              <button
                type="button"
                onClick={resetWizard}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            {/* Success View */}
            {provisionSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-900">Brand created</h3>
                  <p className="text-xs text-gray-500">
                    Tenant <strong>{provisionSuccess.tenantId}</strong> has been created successfully.
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl text-left text-xs space-y-2 font-mono">
                  <div>Brand: {provisionSuccess.brandName}</div>
                  <div>Tenant ID: {provisionSuccess.tenantId}</div>
                  <div>Status: Brand configuration created</div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetWizard();
                      onSelectTenant(provisionSuccess.tenantId);
                    }}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
                  >
                    Open brand
                  </button>
                  <button
                    type="button"
                    onClick={resetWizard}
                    className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Step 1: Brand Basics */}
                {wizardStep === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Brand Name *</label>
                      <input
                        type="text"
                        required
                        value={brandName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. Daylesford Organic"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Tenant ID / Slug *</label>
                      <input
                        type="text"
                        required
                        value={tenantId}
                        onChange={(e) => setTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="e.g. daylesford"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-600"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Unique identifier used to keep this brand's configuration separate.</p>
                    </div>
                  </div>
                )}

                {/* Step 2: Visual Identity */}
                {wizardStep === 2 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={primaryColour}
                            onChange={(e) => setPrimaryColour(e.target.value)}
                            className="w-10 h-10 rounded-xl border border-gray-200 p-0.5 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={primaryColour}
                            onChange={(e) => setPrimaryColour(e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Secondary Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={secondaryColour}
                            onChange={(e) => setSecondaryColour(e.target.value)}
                            className="w-10 h-10 rounded-xl border border-gray-200 p-0.5 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={secondaryColour}
                            onChange={(e) => setSecondaryColour(e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Storefront Preview:</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="px-3 py-1 text-white text-xs font-bold rounded-lg shadow-2xs"
                          style={{ backgroundColor: primaryColour }}
                        >
                          Checkout
                        </span>
                        <span
                          className="px-3 py-1 text-white text-xs font-bold rounded-lg shadow-2xs"
                          style={{ backgroundColor: secondaryColour }}
                        >
                          Add to Basket
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Typography */}
                {wizardStep === 3 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Body Font Family</label>
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      >
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans (Clean Modern)</option>
                        <option value="Inter">Inter (Neutral Precision)</option>
                        <option value="Outfit">Outfit (Contemporary Retail)</option>
                        <option value="DM Sans">DM Sans (Approachable Modern)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Headings Font Family</label>
                      <select
                        value={headingFontFamily}
                        onChange={(e) => setHeadingFontFamily(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      >
                        <option value="Playfair Display">Playfair Display (Luxury Editorial Serif)</option>
                        <option value="Fraunces">Fraunces (Warm Heritage Serif)</option>
                        <option value="Cinzel">Cinzel (Classic Artisan)</option>
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans (Modern Clean)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 4: Languages & Currency */}
                {wizardStep === 4 && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Currency</label>
                        <select
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                        >
                          <option value="GBP">GBP (£)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="USD">USD ($)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Default Country</label>
                        <select
                          value={country}
                          onChange={(e) => setCountry(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                        >
                          <option value="GB">United Kingdom (GB)</option>
                          <option value="IE">Ireland (IE)</option>
                          <option value="US">United States (US)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5: Storefront Domain */}
                {wizardStep === 5 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Storefront Domain</label>
                      <input
                        type="text"
                        value={defaultDomain}
                        onChange={(e) => setDefaultDomain(e.target.value)}
                        placeholder="e.g. shop.daylesford.com"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Canonical domain routed to this tenant's storefront.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 6: Tenant Administrator */}
                {wizardStep === 6 && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Admin Name</label>
                      <input
                        type="text"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Admin Email *</label>
                      <input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="admin@brand.com"
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Sets the initial administrator for this brand.
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 7: Review & Provision */}
                {wizardStep === 7 && (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-2xl space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Brand Name:</span>
                        <span className="font-bold">{brandName || 'Untitled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tenant Slug:</span>
                        <span className="font-mono font-bold">{tenantId || 'none'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Primary Color:</span>
                        <span className="font-mono">{primaryColour}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Currency:</span>
                        <span className="font-bold">{currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Admin Email:</span>
                        <span className="font-mono">{adminEmail || 'None'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Integration:</span>
                        <span className="text-emerald-700 font-semibold">Configure separately</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Navigation Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  {wizardStep > 1 ? (
                    <button
                      type="button"
                      onClick={() => setWizardStep((s) => s - 1)}
                      className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Back
                    </button>
                  ) : (
                    <div />
                  )}

                  {wizardStep < 7 ? (
                    <button
                      type="button"
                      disabled={wizardStep === 1 && (!brandName || !tenantId)}
                      onClick={() => setWizardStep((s) => s + 1)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting || !brandName || !tenantId}
                      onClick={handleProvisionBrand}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      {isSubmitting ? 'Provisioning...' : 'Create brand'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Feature Flags Modal */}
      {selectedFeatureFlagsTenant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <span>Feature Flags — {selectedFeatureFlagsTenant}</span>
              </h2>
              <button
                type="button"
                onClick={() => setSelectedFeatureFlagsTenant(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <FeatureSwitchesPanel
              tenantId={selectedFeatureFlagsTenant}
              currentUser={currentUser}
              compact={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
