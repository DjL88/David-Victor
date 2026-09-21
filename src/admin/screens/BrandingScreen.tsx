import React, { useState, useEffect } from 'react';
import { TenantConfig, AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import {
  CustomFont,
  TenantFontConfig,
  DEFAULT_FALLBACK_CHAINS,
  FontProcessingState,
} from '../../commerce/fontModels';
import { applyTenantFonts, simulateBackendFontPipeline } from '../../tenant/fontManager';
import { GOOGLE_FONTS_CATALOG, extractCleanFontFamily } from '../../commerce/googleFonts';
import { GoogleFontFamily } from '../../commerce/googleFonts';
import { FontPicker } from '../components/FontPicker';
import { FeatureSwitchesPanel } from '../components/FeatureSwitchesPanel';
import {
  Palette,
  Check,
  RefreshCw,
  Eye,
  Type,
  Upload,
  AlertTriangle,
  ShieldCheck,
  FileCode,
  Paintbrush,
} from 'lucide-react';

interface BrandingScreenProps {
  tenantId: string;
  currentUser: AdminUser;
  onBrandingUpdated?: (updated: TenantConfig) => void;
}

export const BrandingScreen: React.FC<BrandingScreenProps> = ({
  tenantId,
  currentUser,
  onBrandingUpdated,
}) => {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Form states
  const [brandName, setBrandName] = useState<string>('');
  const [tagline, setTagline] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [faviconUrl, setFaviconUrl] = useState<string>('');
  const [headerLogoMode, setHeaderLogoMode] = useState<'ICON_WITH_TEXT' | 'WIDE_LOGO' | 'LOGO_ONLY'>('ICON_WITH_TEXT');
  const [headerLogoMaxWidth, setHeaderLogoMaxWidth] = useState<number>(160);
  const [uploadingAsset, setUploadingAsset] = useState<'logo' | 'favicon' | null>(null);
  const [primaryColour, setPrimaryColour] = useState<string>('#059669');
  const [secondaryColour, setSecondaryColour] = useState<string>('#f59e0b');
  const [backgroundColour, setBackgroundColour] = useState<string>('#f8fafc');
  const [surfaceColour, setSurfaceColour] = useState<string>('#ffffff');
  const [textColour, setTextColour] = useState<string>('#0f172a');
  const [mutedTextColour, setMutedTextColour] = useState<string>('#64748b');
  const [borderColour, setBorderColour] = useState<string>('#e2e8f0');
  const [successColour, setSuccessColour] = useState<string>('#059669');
  const [warningColour, setWarningColour] = useState<string>('#d97706');
  const [errorColour, setErrorColour] = useState<string>('#dc2626');
  const [borderRadius, setBorderRadius] = useState<string>('16px');
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [supportPhone, setSupportPhone] = useState<string>('');

  // Custom Font Management states
  const [headingFamily, setHeadingFamily] = useState<string>('Plus Jakarta Sans');
  const [headingFallback, setHeadingFallback] = useState<string>(DEFAULT_FALLBACK_CHAINS.modernSans);
  const [bodyFamily, setBodyFamily] = useState<string>('Plus Jakarta Sans');
  const [carouselTitleFamily, setCarouselTitleFamily] = useState<string>('Plus Jakarta Sans');
  const [googleFonts, setGoogleFonts] = useState<GoogleFontFamily[]>(GOOGLE_FONTS_CATALOG);
  const [bodyFallback, setBodyFallback] = useState<string>(DEFAULT_FALLBACK_CHAINS.modernSans);

  const [fontsList, setFontsList] = useState<CustomFont[]>([
    {
      id: 'font-pjs-bold',
      tenantId: 'brand-alpha',
      family: 'Plus Jakarta Sans',
      weight: '700',
      style: 'normal',
      format: 'woff2',
      fileName: 'PlusJakartaSans-Bold.woff2',
      fileSize: 42100,
      url: 'https://cdn.platform.example/fonts/brand-alpha/PlusJakartaSans-Bold.woff2',
      state: 'READY',
      licenseConfirmed: true,
      createdAt: '2026-02-10T10:00:00Z',
      updatedAt: '2026-02-10T10:05:00Z',
    },
    {
      id: 'font-pjs-reg',
      tenantId: 'brand-alpha',
      family: 'Plus Jakarta Sans',
      weight: '400',
      style: 'normal',
      format: 'woff2',
      fileName: 'PlusJakartaSans-Regular.woff2',
      fileSize: 39800,
      url: 'https://cdn.platform.example/fonts/brand-alpha/PlusJakartaSans-Regular.woff2',
      state: 'READY',
      licenseConfirmed: true,
      createdAt: '2026-02-10T10:00:00Z',
      updatedAt: '2026-02-10T10:05:00Z',
    },
  ]);

  // Upload Form states
  const [uploadFamily, setUploadFamily] = useState('');
  const [uploadFormat, setUploadFormat] = useState<'woff2' | 'woff' | 'ttf' | 'otf'>('woff2');
  const [uploadWeight, setUploadWeight] = useState('700');
  const [uploadStyle, setUploadStyle] = useState<'normal' | 'italic'>('normal');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [licenseConfirmed, setLicenseConfirmed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStateStatus, setUploadStateStatus] = useState<FontProcessingState | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantId]);

  useEffect(() => {
    fetch('/api/v1/admin/fonts/catalog')
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Font catalogue unavailable')))
      .then((data) => Array.isArray(data.fonts) && data.fonts.length && setGoogleFonts(data.fonts))
      .catch(() => setGoogleFonts(GOOGLE_FONTS_CATALOG));
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await defaultAdminClient.getBranding(tenantId);
      setConfig(data);
      setBrandName(data.brandName);
      setTagline(data.tagline || '');
      setLogoUrl(data.logoUrl || '');
      setFaviconUrl(data.faviconUrl || '');
      setHeaderLogoMode(data.headerLogoMode || 'ICON_WITH_TEXT');
      setHeaderLogoMaxWidth(data.headerLogoMaxWidth || 160);
      setPrimaryColour(data.primaryColour);
      setSecondaryColour(data.secondaryColour);
      setBackgroundColour(data.backgroundColour || '#f8fafc');
      setSurfaceColour(data.surfaceColour || '#ffffff');
      setTextColour(data.textColour || '#0f172a');
      setMutedTextColour(data.mutedTextColour || '#64748b');
      setBorderColour(data.borderColour || '#e2e8f0');
      setSuccessColour(data.successColour || '#059669');
      setWarningColour(data.warningColour || '#d97706');
      setErrorColour(data.errorColour || '#dc2626');
      setHeadingFamily(extractCleanFontFamily(data.headingFontFamily));
      setBodyFamily(extractCleanFontFamily(data.fontFamily));
      setCarouselTitleFamily(extractCleanFontFamily(data.carouselTitleFontFamily || data.headingFontFamily));
      setBorderRadius(data.borderRadius);
      setSupportEmail(data.supportDetails?.email || '');
      setSupportPhone(data.supportDetails?.phone || '');

      // Load tenant-managed font assets
      try {
        const assets = await defaultAdminClient.listAssets(tenantId, 'FONT');
        if (assets && Array.isArray(assets) && assets.length > 0) {
          const loadedFonts: CustomFont[] = assets.map((a: any) => {
            const format: 'woff2' | 'woff' | 'ttf' | 'otf' =
              a.contentType?.includes('woff2') || a.storagePath?.endsWith('.woff2')
                ? 'woff2'
                : a.contentType?.includes('woff') || a.storagePath?.endsWith('.woff')
                ? 'woff'
                : a.storagePath?.endsWith('.otf')
                ? 'otf'
                : 'ttf';

            return {
              id: a.id,
              tenantId: a.tenantId,
              family: a.metadata?.family || a.name || 'Custom Font',
              weight: a.metadata?.weight || '400',
              style: a.metadata?.style || 'normal',
              format,
              fileName: a.fileName || `${a.id}.${format}`,
              fileSize: a.byteSize || 0,
              url: a.publicUrl,
              state: a.status === 'READY' ? 'READY' : a.status === 'FAILED' ? 'FAILED' : 'PROCESSING',
              licenseConfirmed: true,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            };
          });
          setFontsList(loadedFonts);
        }
      } catch (assetErr) {
        console.warn('Could not load custom font assets for tenant:', assetErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAsset = async (file: File, type: 'LOGO' | 'FAVICON') => {
    setUploadingAsset(type === 'LOGO' ? 'logo' : 'favicon');
    try {
      const uploaded = await defaultAdminClient.uploadAssetFile(file, type, tenantId);
      if (type === 'LOGO') {
        setLogoUrl(uploaded.publicUrl);
      } else {
        setFaviconUrl(uploaded.publicUrl);
      }
    } catch (err: any) {
      alert(`Asset upload failed: ${err.message || err}`);
    } finally {
      setUploadingAsset(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const cleanBody = extractCleanFontFamily(bodyFamily);
      const cleanHeading = extractCleanFontFamily(headingFamily);
      const cleanCarousel = extractCleanFontFamily(carouselTitleFamily);

      const updated = await defaultAdminClient.updateBranding(
        tenantId,
        {
          brandName,
          tagline,
          logoUrl,
          faviconUrl,
          iconUrl: faviconUrl || logoUrl,
          headerLogoMode,
          headerLogoMaxWidth,
          primaryColour,
          secondaryColour,
          backgroundColour,
          surfaceColour,
          textColour,
          mutedTextColour,
          borderColour,
          successColour,
          warningColour,
          errorColour,
          borderRadius,
          fontFamily: `'${cleanBody}', ${bodyFallback}`,
          headingFontFamily: `'${cleanHeading}', ${headingFallback}`,
          carouselTitleFontFamily: `'${cleanCarousel}', ${headingFallback}`,
          supportDetails: {
            ...config.supportDetails,
            email: supportEmail,
            phone: supportPhone,
          },
        },
        currentUser
      );

      // Apply dynamic fonts safely
      const fontConfig: TenantFontConfig = {
        headingFontFamily: cleanHeading,
        headingFallbackChain: headingFallback,
        bodyFontFamily: cleanBody,
        bodyFallbackChain: bodyFallback,
        customFonts: fontsList,
      };
      applyTenantFonts(fontConfig);

      setConfig(updated);
      setSavedSuccess(true);
      onBrandingUpdated?.(updated);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFont = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFamily.trim() || (!uploadFileName.trim() && !uploadFile)) {
      setUploadError('Please specify font family and select a font file.');
      return;
    }
    if (!licenseConfirmed) {
      setUploadError('You must confirm that you hold the legal licence/permission to use this font.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      let fontUrl: string | undefined;
      let fontId: string | undefined;
      let fileSize = uploadFile ? uploadFile.size : 45000;

      // Real Cloud Storage asset upload if a real file is supplied
      if (uploadFile) {
        setUploadStateStatus('VALIDATING');
        const uploadedAsset = await defaultAdminClient.uploadAssetFile(uploadFile, 'FONT', tenantId);
        fontUrl = uploadedAsset.publicUrl;
        fontId = uploadedAsset.id;
        fileSize = uploadedAsset.byteSize || uploadFile.size;
      }

      if (fontUrl && fontId) {
        setUploadStateStatus('READY');
        const newFont: CustomFont = {
          id: fontId,
          tenantId,
          family: uploadFamily.trim(),
          format: uploadFormat,
          weight: uploadWeight,
          style: uploadStyle,
          fileName: uploadFile?.name || uploadFileName.trim(),
          fileSize,
          url: fontUrl,
          state: 'READY',
          licenseConfirmed,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setFontsList((prev) => {
          const updated = [...prev, newFont];
          applyTenantFonts({
            headingFontFamily: newFont.family,
            headingFallbackChain: headingFallback,
            bodyFontFamily: bodyFamily,
            bodyFallbackChain: bodyFallback,
            customFonts: updated,
          });
          return updated;
        });
        setHeadingFamily(newFont.family);
        setUploadFamily('');
        setUploadFileName('');
        setUploadFile(null);
        setLicenseConfirmed(false);
      } else {
        // Fallback pipeline for simulated tests
        const newFont = await simulateBackendFontPipeline(
          {
            tenantId,
            family: uploadFamily.trim(),
            format: uploadFormat,
            weight: uploadWeight,
            style: uploadStyle,
            fileName: uploadFileName.trim() || (uploadFile ? uploadFile.name : 'font.woff2'),
            fileSize,
            licenseConfirmed,
          },
          (state) => {
            setUploadStateStatus(state);
          }
        );

        if (newFont.state === 'READY') {
          setFontsList((prev) => {
            const updated = [...prev, newFont];
            applyTenantFonts({
              headingFontFamily: newFont.family,
              headingFallbackChain: headingFallback,
              bodyFontFamily: bodyFamily,
              bodyFallbackChain: bodyFallback,
              customFonts: updated,
            });
            return updated;
          });
          setHeadingFamily(newFont.family);
          setUploadFamily('');
          setUploadFileName('');
          setUploadFile(null);
          setLicenseConfirmed(false);
        } else if (newFont.state === 'FAILED') {
          setUploadError(newFont.validationErrors?.join(' ') || 'Font validation failed.');
        }
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Font processing encountered an error.');
    } finally {
      setIsUploading(false);
      setUploadStateStatus(null);
    }
  };

  if (loading || !config) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading branding profile...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" />
            <span>Brand Identity & Dynamic Typography</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure white-label colours, layout radii, and validated custom fonts for {config.brandName}.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Changes published & audited</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: BRAND & THEME FORM */}
        <div className="lg:col-span-7 space-y-8">
          <form onSubmit={handleSave} className="space-y-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Paintbrush className="w-4 h-4 text-indigo-600" />
              <span>Theme Colours & Brand Essence</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Brand Name</label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-indigo-600"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Brand Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-indigo-600"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">Brand Logo Asset</label>
                  <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
                    {uploadingAsset === 'logo' ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{uploadingAsset === 'logo' ? 'Uploading...' : 'Upload PNG/SVG'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadAsset(f, 'LOGO');
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Brand Logo"
                      className="w-9 h-9 object-contain rounded-lg border border-gray-200 p-0.5 shrink-0 bg-gray-50"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://... or uploaded Cloud Storage link"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-700">Square Brand Icon / Favicon</label>
                  <label className="cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
                    {uploadingAsset === 'favicon' ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{uploadingAsset === 'favicon' ? 'Uploading...' : 'Upload Icon'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadAsset(f, 'FAVICON');
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  {faviconUrl && (
                    <img
                      src={faviconUrl}
                      alt="Favicon"
                      className="w-9 h-9 object-contain rounded-lg border border-gray-200 p-0.5 shrink-0 bg-gray-50"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <input
                    type="text"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://... or uploaded Cloud Storage link"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-700">Header logo layout
                <select value={headerLogoMode} onChange={(e) => setHeaderLogoMode(e.target.value as typeof headerLogoMode)} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white">
                  <option value="ICON_WITH_TEXT">Square icon + brand text</option>
                  <option value="WIDE_LOGO">Wide logo + brand text hidden</option>
                  <option value="LOGO_ONLY">Logo only</option>
                </select>
              </label>
              <label className="text-xs font-bold text-gray-700">Header logo width: {headerLogoMaxWidth}px
                <input type="range" min="80" max="240" step="4" value={headerLogoMaxWidth} onChange={(e) => setHeaderLogoMaxWidth(Number(e.target.value))} className="mt-3 w-full" />
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
              {[
                ['Background', backgroundColour, setBackgroundColour],
                ['Surface', surfaceColour, setSurfaceColour],
                ['Text', textColour, setTextColour],
                ['Muted text', mutedTextColour, setMutedTextColour],
                ['Borders', borderColour, setBorderColour],
                ['Success', successColour, setSuccessColour],
                ['Warning', warningColour, setWarningColour],
                ['Error', errorColour, setErrorColour],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="text-[11px] font-bold text-gray-700">
                  {label as string}
                  <div className="mt-1 flex items-center gap-2">
                    <input type="color" value={value as string} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className="w-9 h-9 rounded-lg border border-gray-200" />
                    <input value={value as string} onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)} className="min-w-0 w-full px-2 py-1.5 border border-gray-200 rounded-lg font-mono text-[10px]" />
                  </div>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Primary Brand Colour</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColour}
                    onChange={(e) => setPrimaryColour(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={primaryColour}
                    onChange={(e) => setPrimaryColour(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Secondary Accent Colour</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColour}
                    onChange={(e) => setSecondaryColour(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={secondaryColour}
                    onChange={(e) => setSecondaryColour(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Container Corner Radius</label>
                <select
                  value={borderRadius}
                  onChange={(e) => setBorderRadius(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-indigo-600 bg-white"
                >
                  <option value="8px">Subtle (8px)</option>
                  <option value="12px">Standard (12px)</option>
                  <option value="16px">Friendly Rounded (16px)</option>
                  <option value="20px">Super Soft (20px)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Customer Support Email</label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-indigo-600"
                />
              </div>
            </div>

            {/* DYNAMIC FONT SELECTION & FALLBACK CHAINS */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-indigo-600" />
                  <span>Storefront typography</span>
                </h3>
                <span className="text-[10px] text-gray-400">Tenant-specific</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Heading Font (H1-H4)
                  </label>
                  <FontPicker label="" value={headingFamily} fonts={googleFonts} onChange={setHeadingFamily} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Heading Fallback Chain
                  </label>
                  <select
                    value={headingFallback}
                    onChange={(e) => setHeadingFallback(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono text-[11px] bg-white"
                  >
                    <option value={DEFAULT_FALLBACK_CHAINS.modernSans}>Modern Sans (system-ui, sans-serif)</option>
                    <option value={DEFAULT_FALLBACK_CHAINS.editorialSerif}>Editorial Serif (Georgia, Times)</option>
                    <option value={DEFAULT_FALLBACK_CHAINS.mono}>Monospace (SFMono, Menlo)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Body Font (Paragraphs & Buttons)
                  </label>
                  <FontPicker label="" value={bodyFamily} fonts={googleFonts} onChange={setBodyFamily} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Body Fallback Chain
                  </label>
                  <select
                    value={bodyFallback}
                    onChange={(e) => setBodyFallback(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono text-[11px] bg-white"
                  >
                    <option value={DEFAULT_FALLBACK_CHAINS.modernSans}>Modern Sans (system-ui, sans-serif)</option>
                    <option value={DEFAULT_FALLBACK_CHAINS.editorialSerif}>Editorial Serif (Georgia, Times)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Carousel / Banner Title Font</label>
                <FontPicker label="" value={carouselTitleFamily} fonts={googleFonts} onChange={setCarouselTitleFamily} />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save & Publish Theme</span>
              </button>
            </div>
          </form>

          {/* CUSTOM FONT ASSET UPLOAD & PIPELINE */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>Custom font upload</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload a licensed TTF, OTF, WOFF or WOFF2 font for this brand. Files are validated before they are made available to the storefront.
                </p>
              </div>
            </div>

            <form onSubmit={handleUploadFont} className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Font Family Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Outfit, Recoleta"
                    value={uploadFamily}
                    onChange={(e) => setUploadFamily(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Format</label>
                  <select
                    value={uploadFormat}
                    onChange={(e) => setUploadFormat(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                  >
                    <option value="woff2">WOFF2 (Optimized)</option>
                    <option value="woff">WOFF</option>
                    <option value="otf">OTF (OpenType)</option>
                    <option value="ttf">TTF (TrueType)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Weight</label>
                  <select
                    value={uploadWeight}
                    onChange={(e) => setUploadWeight(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                  >
                    <option value="400">Regular (400)</option>
                    <option value="600">Semibold (600)</option>
                    <option value="700">Bold (700)</option>
                    <option value="800">Extra Bold (800)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">
                  Font File Upload (.woff2, .woff, .ttf, .otf)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer flex items-center justify-between px-3 py-2 border border-dashed border-gray-300 rounded-lg hover:border-indigo-400 bg-white transition-colors">
                    <span className="text-xs text-gray-600 truncate">
                      {uploadFile ? uploadFile.name : uploadFileName || 'Choose a font file or drag here...'}
                    </span>
                    <span className="ml-2 px-2 py-0.5 bg-gray-100 text-[10px] font-semibold text-gray-600 rounded">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadFile(file);
                          setUploadFileName(file.name);
                          const ext = file.name.split('.').pop()?.toLowerCase();
                          if (ext === 'woff2' || ext === 'woff' || ext === 'ttf' || ext === 'otf') {
                            setUploadFormat(ext as any);
                          }
                          if (!uploadFamily.trim()) {
                            const inferred = file.name.replace(/\.[^/.]+$/, '').replace(/[-_](regular|bold|semibold|light|medium|italic)/i, '');
                            setUploadFamily(inferred);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* MANDATORY LEGAL LICENCE CHECKBOX */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={licenseConfirmed}
                    onChange={(e) => setLicenseConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="text-xs text-amber-950 leading-snug">
                    <span className="font-bold">Font licence confirmation: </span>
                    I confirm that this brand has permission to use and distribute this font on its storefront.
                  </div>
                </label>
              </div>

              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              {isUploading && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-2 text-xs font-semibold text-indigo-800">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Processing: {uploadStateStatus}…</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload font</span>
                </button>
              </div>
            </form>

            {/* INSTALLED FONTS REPOSITORY TABLE */}
            <div>
              <h4 className="text-xs font-bold text-gray-800 mb-2">Installed fonts</h4>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {fontsList.map((f) => (
                  <div key={f.id} className="p-3 flex items-center justify-between text-xs bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                        Aa
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{f.family}</div>
                        <div className="text-[11px] text-gray-500 font-mono">
                          {f.fileName} • {f.format.toUpperCase()} • {f.weight}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        READY
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TENANT FEATURE FLAGS & CAPABILITIES PANEL */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
            <FeatureSwitchesPanel tenantId={tenantId} currentUser={currentUser} />
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE TYPOGRAPHY PREVIEW & MOBILE VIEW */}
        <div className="lg:col-span-5 space-y-6">
          {/* LIVE TYPOGRAPHY PREVIEW PANEL */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-indigo-600" />
                <span>Typography preview</span>
              </h3>
              <span className="text-[10px] font-mono text-gray-500">
                {headingFamily} / {bodyFamily}
              </span>
            </div>

            <div className="space-y-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Heading
                </span>
                <h1
                  className="text-2xl font-black text-gray-900 leading-tight"
                  style={{ fontFamily: `'${headingFamily}', ${headingFallback}` }}
                >
                  Fresh Artisan Groceries in Minutes
                </h1>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Subheading
                </span>
                <h3
                  className="text-base font-bold text-gray-800"
                  style={{ fontFamily: `'${headingFamily}', ${headingFallback}` }}
                >
                  Slow-Fermented Heritage Bakery & Orchard Crates
                </h3>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  Body text
                </span>
                <p
                  className="text-xs text-gray-600 leading-relaxed"
                  style={{ fontFamily: `'${bodyFamily}', ${bodyFallback}` }}
                >
                  Hand-picked by store specialists from local certified farms. Our Lower Price Guarantee protects your basket on every substitution.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Price
                </span>
                <span
                  className="text-lg font-black text-gray-900 font-mono"
                  style={{ color: primaryColour }}
                >
                  £34.50
                </span>
              </div>
            </div>
          </div>

          {/* REAL-TIME MOBILE UI PREVIEW */}
          <div className="bg-gray-900 p-4 rounded-3xl shadow-xl max-w-sm mx-auto">
            <div className="flex items-center justify-between text-gray-400 text-[11px] mb-3 px-2">
              <span className="font-semibold">Mobile preview</span>
              <Eye className="w-3.5 h-3.5" />
            </div>

            <div
              className="bg-white rounded-2xl overflow-hidden p-4 space-y-4 shadow-inner"
              style={{
                fontFamily: `'${bodyFamily}', ${bodyFallback}`,
                borderRadius: borderRadius,
              }}
            >
              {/* Header mockup */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span
                  className="font-black text-sm tracking-tight"
                  style={{ color: primaryColour }}
                >
                  {brandName || 'Store'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  Open Now
                </span>
              </div>

              {/* Banner card */}
              <div
                className="p-3 text-white space-y-1 shadow-xs"
                style={{
                  backgroundColor: primaryColour,
                  borderRadius: borderRadius,
                }}
              >
                <div
                  className="text-xs font-black tracking-tight"
                  style={{ fontFamily: `'${headingFamily}', ${headingFallback}` }}
                >
                  Morning Harvest Specials
                </div>
                <div className="text-[10px] opacity-90">{tagline || 'Fresh in minutes'}</div>
              </div>

              {/* Sample Product item */}
              <div className="flex items-center gap-3 p-2 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-gray-200 shrink-0 flex items-center justify-center text-gray-400 text-[10px] font-bold">
                  IMG
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-bold text-gray-900 line-clamp-1"
                    style={{ fontFamily: `'${headingFamily}', ${headingFallback}` }}
                  >
                    Slow Fermented Sourdough
                  </div>
                  <div className="text-[11px] font-mono font-bold text-gray-600">£3.25</div>
                </div>
                <button
                  type="button"
                  className="px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs"
                  style={{
                    backgroundColor: primaryColour,
                    borderRadius: borderRadius,
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
