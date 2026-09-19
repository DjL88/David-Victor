import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { TenantConfig, BootstrapResponse } from '../commerce/models';
import { CommerceClient } from '../commerce/CommerceClient';
import { defaultHttpCommerceClient } from '../commerce/HttpCommerceClient';
import { MOCK_TENANTS } from '../commerce/mockData';
import { injectGoogleFontLink, GOOGLE_FONTS_CATALOG } from '../commerce/googleFonts';

import { defaultPaymentClient } from '../commerce/PaymentClient';
import { setRuntimeMode, parseRuntimeMode } from '../domain/runtime';

export type PlatformAppMode = 'unknown' | 'demo' | 'staging' | 'production';

interface TenantContextValue {
  tenant: TenantConfig | null;
  loading: boolean;
  error: string | null;
  client: CommerceClient;
  switchTenant: (tenantId: string) => Promise<void>;
  availableTenants: TenantConfig[];
  appMode: PlatformAppMode;
  setAppMode: (mode: PlatformAppMode) => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

function detectInitialTenant(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  // 1. Check URL query param (e.g. ?tenantId=brand-beta) in demo or admin contexts
  const urlParams = new URLSearchParams(window.location.search);
  const queryTenant = urlParams.get('tenantId');
  if (queryTenant) return queryTenant;

  // 2. Check Hostname / Subdomain (e.g. brand-beta.yourhost.com -> 'brand-beta')
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length > 2 && !['www', 'localhost', 'run', 'app'].includes(parts[0])) {
    const sub = parts[0].toLowerCase();
    if (sub.startsWith('brand-') || sub === 'marketlane') {
      return sub;
    }
  }

  return undefined;
}

export const TenantProvider: React.FC<{
  children: React.ReactNode;
  commerceClient?: CommerceClient;
}> = ({ children, commerceClient = defaultHttpCommerceClient }) => {
  const initialDetected = useMemo(() => detectInitialTenant(), []);
  // Do NOT pre-fill with brand-alpha. Startup mode initially equals UNKNOWN; resolve authoritatively from bootstrap.
  const [tenant, setTenant] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [appMode, setAppModeState] = useState<PlatformAppMode>('unknown');

  const availableTenants = useMemo(() => {
    const list = appMode === 'demo' ? Object.values(MOCK_TENANTS) : (tenant ? [tenant] : []);
    const seen = new Set<string>();
    return list.filter((t) => {
      if (!t?.tenantId || seen.has(t.tenantId)) return false;
      seen.add(t.tenantId);
      return true;
    });
  }, [appMode, tenant]);

  // Sync app mode from platform backend
  useEffect(() => {
    fetch('/api/v1/platform/mode')
      .then((res) => {
        if (!res.ok) throw new Error(`Platform mode endpoint returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const mode = data.appMode;
        if (mode === 'demo' || mode === 'staging' || mode === 'production') {
          setAppModeState(mode);
          setRuntimeMode(parseRuntimeMode(mode));
          defaultPaymentClient.setMode(mode);
          if ('setAppMode' in commerceClient) {
            (commerceClient as unknown as { setAppMode: (m: PlatformAppMode) => void }).setAppMode(mode);
          }
        } else {
          setAppModeState('unknown');
          setRuntimeMode('UNKNOWN');
        }
      })
      .catch((err) => {
        console.warn('[TenantContext] Could not resolve runtime mode from platform. Failing closed as unknown:', err);
        setAppModeState('unknown');
        setRuntimeMode('UNKNOWN');
      });
  }, [commerceClient]);

  const setAppMode = (mode: PlatformAppMode) => {
    setAppModeState(mode);
    setRuntimeMode(parseRuntimeMode(mode));
    defaultPaymentClient.setMode(mode);
    if ('setAppMode' in commerceClient) {
      (commerceClient as unknown as { setAppMode: (m: PlatformAppMode) => void }).setAppMode(mode);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initialTenant = detectInitialTenant();

    if (initialTenant && 'setTenant' in commerceClient) {
      (commerceClient as unknown as { setTenant: (id: string) => void }).setTenant(initialTenant);
    }

    async function loadBootstrap() {
      try {
        setLoading(true);
        setError(null);
        const res: BootstrapResponse = await commerceClient.getBootstrap();
        if (isMounted) {
          setTenant(res.tenant);
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.warn('[TenantContext] Bootstrap endpoint note, using default tenant configuration:', err);
          const fallbackId = initialTenant || 'brand-alpha';
          setTenant((prev) => prev || MOCK_TENANTS[fallbackId] || MOCK_TENANTS['brand-alpha']);
          setError(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBootstrap();

    return () => {
      isMounted = false;
    };
  }, [commerceClient]);

  // Apply dynamic CSS custom properties and Google Fonts to document root
  useEffect(() => {
    if (!tenant) return;

    const root = document.documentElement;
    root.style.setProperty('--brand-primary', tenant.primaryColour);
    root.style.setProperty('--brand-secondary', tenant.secondaryColour);
    root.style.setProperty('--brand-bg', tenant.backgroundColour);
    root.style.setProperty('--brand-text', tenant.textColour);
    root.style.setProperty('--brand-radius', tenant.borderRadius);
    root.style.setProperty('--brand-font', tenant.fontFamily);

    // Auto-inject Google Font link if matched
    const matchedFamily = GOOGLE_FONTS_CATALOG.find((f) =>
      tenant.fontFamily.toLowerCase().includes(f.family.toLowerCase())
    );
    if (matchedFamily) {
      injectGoogleFontLink(matchedFamily.family, matchedFamily.weights);
    }

    // Update document title and OpenGraph metadata with brand name
    document.title = `${tenant.brandName} • On-Demand Grocery Delivery`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', `${tenant.brandName} on-demand retail delivery and collection.`);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${tenant.brandName} • Retail Storefront`);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', `${tenant.brandName} on-demand retail delivery and collection.`);
  }, [tenant]);

  const switchTenant = async (tenantId: string) => {
    try {
      setLoading(true);
      if ('setTenant' in commerceClient) {
        (commerceClient as unknown as { setTenant: (id: string) => void }).setTenant(tenantId);
      }
      const res = await commerceClient.getBootstrap();
      setTenant(res.tenant);
    } catch (err) {
      console.error('Failed to switch tenant', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        loading,
        error,
        client: commerceClient,
        switchTenant,
        availableTenants,
        appMode,
        setAppMode,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
