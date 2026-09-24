import React, { useState, useEffect } from 'react';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { DeliverectChannelSetupGuide } from '../components/DeliverectChannelSetupGuide';
import { DEFAULT_TENANT_ID } from '../../tenant/constants';
import {
  Link2,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Lock,
  Radio,
  Save,
  Layers,
  Key,
  Globe,
  Store,
  ArrowRight,
  ShieldCheck,
  Building2,
  MapPin,
  ExternalLink,
  Package,
  Download,
  Copy,
  ShoppingCart,
  Play,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from 'lucide-react';

interface IntegrationsAdminScreenProps {
  tenantId?: string;
}

export const IntegrationsAdminScreen: React.FC<IntegrationsAdminScreenProps> = ({ tenantId = DEFAULT_TENANT_ID }) => {
  const [config, setConfig] = useState<any>({
    status: 'UNCONFIGURED',
    environment: 'staging',
    deliverectAccountId: '',
    channelLinkId: '',
    lastSyncAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [testingOAuth, setTestingOAuth] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialMode, setCredentialMode] = useState<'platform' | 'dedicated'>('platform');
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [webhookSecretInput, setWebhookSecretInput] = useState('');
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const [discoveringStores, setDiscoveringStores] = useState(false);

  // Diagnostic & step results
  const [oauthResult, setOauthResult] = useState<{
    success: boolean;
    status: string;
    message: string;
    latencyMs?: number;
    environment?: string;
    tokenExpiry?: string;
  } | null>(null);
  const [platformOauthVerified, setPlatformOauthVerified] = useState(false);

  const [linkedAccounts, setLinkedAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [discoveredStores, setDiscoveredStores] = useState<any[]>([]);
  const [discoveredLocations, setDiscoveredLocations] = useState<any[]>([]);
  const [selectedChannelLinkIds, setSelectedChannelLinkIds] = useState<string[]>([]);

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [noAccountsWarning, setNoAccountsWarning] = useState<string | null>(null);

  const [commerceDiagnostics, setCommerceDiagnostics] = useState<any | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState<boolean>(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [menuInspection, setMenuInspection] = useState<any | null>(null);

  // Test Order Probe state
  const [testOrderChannelLinkId, setTestOrderChannelLinkId] = useState<string>('');
  const [testOrderMenuId, setTestOrderMenuId] = useState<string>('');
  const [testOrderPlu, setTestOrderPlu] = useState<string>('');
  const [testOrderQuantity, setTestOrderQuantity] = useState<number>(1);
  const [testOrderAdditionalItems, setTestOrderAdditionalItems] = useState<
    Array<{ id: string; menuId: string; plu: string; quantity: number }>
  >([]);
  const [testOrderCustomerName, setTestOrderCustomerName] = useState<string>('Staging Test Customer');
  const [testOrderCustomerEmail, setTestOrderCustomerEmail] = useState<string>('test@bwydi.com');
  const [testOrderCustomerPhone, setTestOrderCustomerPhone] = useState<string>('+447700900123');
  const [testOrderPerformCheckout, setTestOrderPerformCheckout] = useState<boolean>(true);
  const [placingTestOrder, setPlacingTestOrder] = useState<boolean>(false);
  const [testOrderResult, setTestOrderResult] = useState<any | null>(null);
  const [testOrderError, setTestOrderError] = useState<string | null>(null);
  const [showRawTestOrderJson, setShowRawTestOrderJson] = useState<boolean>(false);
  const [copiedWebhookKey, setCopiedWebhookKey] = useState<string | null>(null);
  const [retailBaseUrl, setRetailBaseUrl] = useState('');
  const [retailPathTemplate, setRetailPathTemplate] = useState('');
  const [retailVersion, setRetailVersion] = useState<'none' | 'retail' | 'stable' | 'rapid'>('none');
  const [savingRetailEndpoint, setSavingRetailEndpoint] = useState(false);

  const addTestOrderItem = () => {
    setTestOrderAdditionalItems((prev) => [
      ...prev,
      { id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, menuId: '', plu: '', quantity: 1 },
    ]);
  };

  const updateTestOrderItem = (id: string, field: 'menuId' | 'plu' | 'quantity', value: any) => {
    setTestOrderAdditionalItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeTestOrderItem = (id: string) => {
    setTestOrderAdditionalItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePlaceTestOrder = async () => {
    setPlacingTestOrder(true);
    setTestOrderError(null);
    setTestOrderResult(null);

    const targetCh = testOrderChannelLinkId || selectedChannelLinkIds[0] || discoveredStores[0]?.channelLinkId;
    const selectedStore = discoveredStores.find((s) => s.channelLinkId === targetCh);
    if (selectedStore && selectedStore.fulfillmentCapabilitiesProjection && !selectedStore.fulfillmentCapabilitiesProjection.pickup) {
      setTestOrderError('Collection is not enabled for this Deliverect Commerce store.');
      setPlacingTestOrder(false);
      return;
    }

    try {
      if (defaultAdminClient.placePickupTestOrder) {
        let itemsPayload: Array<{ menuId?: string; plu?: string; quantity: number }> | undefined = undefined;

        if (testOrderAdditionalItems.length > 0) {
          itemsPayload = [
            {
              menuId: testOrderMenuId || undefined,
              plu: testOrderPlu || undefined,
              quantity: Math.max(1, Number(testOrderQuantity) || 1),
            },
            ...testOrderAdditionalItems.map((item) => ({
              menuId: item.menuId || undefined,
              plu: item.plu || undefined,
              quantity: Math.max(1, Number(item.quantity) || 1),
            })),
          ];
        }

        const res = await defaultAdminClient.placePickupTestOrder(tenantId, {
          channelLinkId: targetCh,
          menuId: testOrderMenuId || undefined,
          plu: testOrderPlu || undefined,
          quantity: Math.max(1, Number(testOrderQuantity) || 1),
          items: itemsPayload,
          customer: {
            name: testOrderCustomerName,
            email: testOrderCustomerEmail,
            phoneNumber: testOrderCustomerPhone,
          },
          performCheckout: testOrderPerformCheckout,
        });
        setTestOrderResult(res.result || res);
      }
    } catch (err: any) {
      console.error('Test order failed:', err);
      setTestOrderError(err.message || 'Failed to place test pickup order');
    } finally {
      setPlacingTestOrder(false);
    }
  };

  const runCommerceDiagnostics = async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      if (defaultAdminClient.getCommerceDiagnostics) {
        const diag = await defaultAdminClient.getCommerceDiagnostics(tenantId);
        setCommerceDiagnostics(diag);
      }
    } catch (err: any) {
      console.warn('Failed to load commerce diagnostics:', err);
      setDiagnosticsError(err.message || 'Failed to fetch catalog diagnostics');
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const downloadRawMenu = async () => {
    const store = discoveredStores.find((item) => selectedChannelLinkIds.includes(String(item.channelLinkId))) || discoveredStores[0];
    if (!store) { setDiagnosticsError('Discover and assign a store before downloading its menu.'); return; }
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const raw = await defaultAdminClient.getRawStoreMenu!(tenantId, store.id || store.channelLinkId);
      const blob = new Blob([JSON.stringify(raw, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deliverect-menu-${store.channelLinkId || store.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setDiagnosticsError(err.message || 'Could not download the menu JSON.');
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const runMenuInspection = async () => {
    const store = discoveredStores.find((item) => selectedChannelLinkIds.includes(String(item.channelLinkId))) || discoveredStores[0];
    if (!store) {
      setDiagnosticsError('Discover and assign a store before inspecting its menu.');
      return;
    }
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const menuId = testOrderMenuId || commerceDiagnostics?.storeCatalog?.activeMenuId || undefined;
      const report = await defaultAdminClient.inspectStoreMenu(
        tenantId,
        store.id || store.channelLinkId,
        menuId
      );
      setMenuInspection(report);
    } catch (err: any) {
      setDiagnosticsError(err.message || 'Could not inspect the published menu.');
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  useEffect(() => {
    loadIntegration();
  }, [tenantId]);

  const loadIntegration = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await defaultAdminClient.getIntegration(tenantId);
      if (data) {
        setConfig(data);
        setRetailBaseUrl(data.retailOrder?.baseUrl || '');
        setRetailPathTemplate(data.retailOrder?.pathTemplate || '');
        setRetailVersion((data.retailOrder?.headers?.['x-deliverect-version'] || 'none') as any);
        setCredentialMode(data.credentialMode === 'dedicated' ? 'dedicated' : 'platform');
        setClientIdInput('');
        setClientSecretInput('');
        setWebhookSecretInput('');
        if (data.deliverectAccountId) {
          setSelectedAccountId(data.deliverectAccountId);
        }
        setSelectedChannelLinkIds(Array.isArray(data.allowedChannelLinkIds) ? data.allowedChannelLinkIds.map(String) : []);
      }

      // Load linked accounts and stores if already mapped
      try {
        const mappings = await defaultAdminClient.getLinkedAccounts(tenantId);
        if (mappings) {
          if (mappings.accounts && mappings.accounts.length > 0) {
            setLinkedAccounts(mappings.accounts);
            if (!selectedAccountId && mappings.accounts[0]?.deliverectAccountId) {
              setSelectedAccountId(mappings.accounts[0].deliverectAccountId);
            }
          }
          if (mappings.stores && mappings.stores.length > 0) {
            setDiscoveredStores(mappings.stores);
          }
          if (mappings.locations && mappings.locations.length > 0) {
            setDiscoveredLocations(mappings.locations);
          }
        }
      } catch (mappingErr) {
        console.warn('Could not pre-fetch existing accounts/stores:', mappingErr);
      }

      // Automatically trigger live commerce diagnostics
      runCommerceDiagnostics();
    } catch (err: any) {
      console.warn('Failed to load integration config:', err);
      setConfig({
        tenantId,
        status: 'UNCONFIGURED',
        environment: 'staging',
        deliverectAccountId: '',
        channelLinkId: '',
        lastSyncAt: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRetailOrderEndpoint = async (reset = false) => {
    if (!defaultAdminClient.updateIntegration) return;
    setSavingRetailEndpoint(true);
    setError(null);
    try {
      const retailOrder = reset ? {} : {
        ...(retailBaseUrl.trim() ? { baseUrl: retailBaseUrl.trim() } : {}),
        ...(retailPathTemplate.trim() ? { pathTemplate: retailPathTemplate.trim() } : {}),
        ...(retailVersion !== 'none' ? { headers: { 'x-deliverect-version': retailVersion } } : {}),
      };
      await defaultAdminClient.updateIntegration(tenantId, { retailOrder });
      await loadIntegration();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save retail order endpoint.');
    } finally {
      setSavingRetailEndpoint(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (credentialMode === 'dedicated' && (!clientIdInput.trim() || !clientSecretInput.trim())) {
      setError('Client ID and Client Secret are required for dedicated tenant credentials.');
      return;
    }
    setSavingCredentials(true);
    setError(null);
    try {
      await defaultAdminClient.updateIntegrationCredentials!(tenantId, {
        credentialMode,
        clientId: credentialMode === 'dedicated' ? clientIdInput.trim() : undefined,
        clientSecret: credentialMode === 'dedicated' ? clientSecretInput.trim() : undefined,
        webhookSecret: credentialMode === 'dedicated' ? webhookSecretInput.trim() || undefined : undefined,
        environment: config.environment || 'staging',
      });
      setClientSecretInput('');
      setWebhookSecretInput('');
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
      await loadIntegration();
    } catch (err: any) {
      setError(err?.message || 'Failed to save Deliverect credentials.');
    } finally {
      setSavingCredentials(false);
    }
  };

  /**
   * STEP 2: Genuine Platform Deliverect OAuth Verification (Platform Scope)
   * Calls POST /api/v1/admin/platform/integrations/deliverect/test-oauth protected by platformSuperAdmin.
   * Tests only https://api.staging.deliverect.com/oauth/token with audience https://api.staging.deliverect.com.
   * Does NOT mark any Bwydi tenant as connected.
   */
  const handleTestOAuth = async () => {
    setTestingOAuth(true);
    setError(null);
    setOauthResult(null);

    try {
      const res = credentialMode === 'dedicated'
        ? await defaultAdminClient.testDeliverectOAuth!(tenantId, {
            environment: config.environment || 'staging',
          })
        : await defaultAdminClient.testPlatformDeliverectOAuth!({
            environment: config.environment || 'staging',
          });

      setOauthResult({
        success: res.success,
        status: res.status,
        message: res.message,
        latencyMs: res.latencyMs,
        environment: res.environment,
        tokenExpiry: res.tokenExpiry,
      });

      if (res.success) {
        // Show OAUTH_VERIFIED for platform partner OAuth, but do not mark any Bwydi tenant as connected
        setPlatformOauthVerified(true);
      } else {
        setError(res.message || 'OAuth token handshake failed with Deliverect.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to communicate with BFF Platform OAuth test endpoint.');
      setOauthResult({
        success: false,
        status: 'ERROR',
        message: err?.message || 'Network or server error',
      });
    } finally {
      setTestingOAuth(false);
    }
  };

  /**
   * STEP 3: Find accounts from Deliverect Commerce API
   */
  const handleDiscoverAccounts = async () => {
    setSyncingAccounts(true);
    setError(null);

    try {
      const res = await defaultAdminClient.syncLinkedAccounts(tenantId);
      if (res && res.accounts) {
        setLinkedAccounts(res.accounts);
        if (res.stores) {
          setDiscoveredStores(res.stores);
        }
        if (res.locations) {
          setDiscoveredLocations(res.locations);
        }

        if (res.accounts.length > 0) {
          const defaultAcc = res.accounts[0].deliverectAccountId || res.accounts[0].accountLinkId;
          setSelectedAccountId((prev) => prev || defaultAcc);
        }
      }

      if (res?.status === 'NO_ACCOUNTS_FOUND' || (res?.accounts && res.accounts.length === 0)) {
        setPersistenceWarning(null);
        setNoAccountsWarning(
          'No linked accounts were returned by Deliverect. Deliverect returned HTTP 200, but zero merchant accounts are linked to this client credentials set.'
        );
      } else if (res?.status === 'DISCOVERY_SUCCEEDED_PERSISTENCE_FAILED' || res?.persistenceStatus === 'FAILED') {
        setNoAccountsWarning(null);
        setPersistenceWarning(
          'Deliverect accounts were discovered successfully from the Commerce API, but Firestore persistence failed due to GCP Cloud Run IAM permissions (PERMISSION_DENIED). Cloud Run service account requires role "roles/datastore.user". Accounts are currently available in in-memory cache.'
        );
      } else {
        setNoAccountsWarning(null);
        setPersistenceWarning(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch linked accounts from Deliverect Commerce API.');
    } finally {
      setSyncingAccounts(false);
    }
  };

  /**
   * STEP 3 (Save): Map Selected Deliverect Account to Tenant
   */
  const handleSelectAccount = async () => {
    if (!selectedAccountId) {
      setError('Please choose a Deliverect Account from the list.');
      return;
    }

    setError(null);
    try {
      const res = await defaultAdminClient.selectAccount(tenantId, selectedAccountId, selectedChannelLinkIds);
      if (res.success) {
        setConfig((prev: any) => ({
          ...prev,
          deliverectAccountId: selectedAccountId,
          status: res.status || 'ACCOUNT_MAPPED',
          lastSyncAt: new Date().toISOString(),
          allowedChannelLinkIds: res.allowedChannelLinkIds || selectedChannelLinkIds,
        }));
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3500);

        // Auto-discover stores for the newly selected account
        handleDiscoverStores(selectedAccountId);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to link Deliverect account to tenant.');
    }
  };

  /**
   * STEP 4: Import locations for Selected Account
   */
  const handleDiscoverStores = async (accId?: string) => {
    const targetAccount = accId || selectedAccountId || config.deliverectAccountId;
    if (!targetAccount) {
      setError('Please select or map a Deliverect Account in Step 3 before discovering Commerce Stores.');
      return;
    }

    setDiscoveringStores(true);
    setError(null);

    try {
      const res = await defaultAdminClient.discoverStores(tenantId, targetAccount);
      if (res && res.stores) {
        setDiscoveredStores(res.stores);
        setConfig((prev: any) => ({
          ...prev,
          status: res.status || (res.stores.length > 0 ? 'COMMERCE_VERIFIED' : 'ACCOUNT_MAPPED'),
          lastSyncAt: new Date().toISOString(),
        }));

        if (res.stores.length === 0) {
          setError('No commerce stores were returned by Deliverect for this account.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to discover commerce stores for selected account.');
    } finally {
      setDiscoveringStores(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMMERCE_VERIFIED':
      case 'CONNECTED':
        return {
          bg: 'bg-emerald-950 text-emerald-400 border-emerald-800',
          dot: 'bg-emerald-400 animate-pulse',
          label: 'Commerce Verified',
        };
      case 'ACCOUNT_MAPPED':
        return {
          bg: 'bg-blue-950 text-blue-400 border-blue-800',
          dot: 'bg-blue-400',
          label: 'Account Mapped',
        };
      case 'OAUTH_VERIFIED':
        return {
          bg: 'bg-amber-950 text-amber-400 border-amber-800',
          dot: 'bg-amber-400',
          label: 'OAuth Verified',
        };
      case 'ERROR':
        return {
          bg: 'bg-red-950 text-red-400 border-red-800',
          dot: 'bg-red-400',
          label: 'Integration Error',
        };
      case 'UNCONFIGURED':
      case 'STANDALONE':
      default:
        return {
          bg: 'bg-gray-800 text-gray-400 border-gray-700',
          dot: 'bg-gray-500',
          label: 'Unconfigured',
        };
    }
  };

  const currentStatus = getStatusBadge(config.status);

  const callbackOrigin =
    typeof window !== 'undefined'
      ? window.location.origin.replace(/\/$/, '')
      : '';
  // Keep the provisioning URL human-readable and stable per brand.
  // The BFF resolves this tenant id and still requires valid Deliverect HMAC.
  const callbackIdentifier =
    String(tenantId || DEFAULT_TENANT_ID).trim();

  const questRetailWebhookUrls = {
    pickingStatus: callbackOrigin
      ? `${callbackOrigin}/api/v1/webhooks/deliverect/${encodeURIComponent(
          callbackIdentifier
        )}/picking/status`
      : '',
    amendments: callbackOrigin
      ? `${callbackOrigin}/api/v1/webhooks/deliverect/${encodeURIComponent(
          callbackIdentifier
        )}/picking/amendments`
      : '',
    substitutions: callbackOrigin
      ? `${callbackOrigin}/api/v1/integrations/deliverect/orders/{channelOrderId}/substitute/{plu}`
      : '',
  };

  const copyQuestWebhook = async (key: string, value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedWebhookKey(key);
      window.setTimeout(() => setCopiedWebhookKey(null), 1800);
    } catch (err) {
      console.warn('Could not copy webhook URL:', err);
      setError('Could not copy webhook URL. Select the URL and copy it manually.');
    }
  };

  const connected =
    config.status === 'COMMERCE_VERIFIED' || config.status === 'CONNECTED';
  const oauthReady =
    platformOauthVerified ||
    ['OAUTH_VERIFIED', 'ACCOUNT_MAPPED', 'COMMERCE_VERIFIED', 'CONNECTED'].includes(config.status);
  const accountReady =
    Boolean(selectedAccountId || config.deliverectAccountId) &&
    ['ACCOUNT_MAPPED', 'COMMERCE_VERIFIED', 'CONNECTED'].includes(config.status);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Link2 className="h-6 w-6 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Connect Deliverect</h2>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              Connect this brand, choose the Deliverect account, then assign the locations it is allowed to use.
            </p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${currentStatus.bg}`}>
            <span className={`h-2 w-2 rounded-full ${currentStatus.dot}`} />
            {currentStatus.label}
          </span>
        </div>

        <div className="mt-5 grid gap-2 border-t border-gray-800 pt-5 sm:grid-cols-3">
          {[
            { label: 'Connect', done: oauthReady },
            { label: 'Choose account', done: accountReady },
            { label: 'Assign locations', done: connected && selectedChannelLinkIds.length > 0 },
          ].map((step, index) => (
            <div key={step.label} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${
              step.done ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-gray-800 bg-gray-950 text-gray-400'
            }`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                step.done ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}>{step.done ? '✓' : index + 1}</span>
              {step.label}
            </div>
          ))}
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-700 bg-emerald-950/80 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>Deliverect settings saved.</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-700 bg-red-950/80 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-5" data-admin-ai-target="deliverect-connect">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-800">
              <Key className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">1. Connect</h3>
              <p className="text-xs text-gray-400">Use platform credentials, or dedicated credentials for this tenant.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setCredentialMode('platform')} className={`rounded-xl border p-3 text-left text-xs ${
            credentialMode === 'platform' ? 'border-emerald-600 bg-emerald-950/30 text-white' : 'border-gray-800 bg-gray-950 text-gray-400'
          }`}>
            <span className="block font-bold">Platform connection</span>
            <span className="mt-1 block text-[11px] opacity-75">Recommended when this tenant uses the shared LT Deliverect integration.</span>
          </button>
          <button type="button" onClick={() => setCredentialMode('dedicated')} className={`rounded-xl border p-3 text-left text-xs ${
            credentialMode === 'dedicated' ? 'border-emerald-600 bg-emerald-950/30 text-white' : 'border-gray-800 bg-gray-950 text-gray-400'
          }`}>
            <span className="block font-bold">Dedicated connection</span>
            <span className="mt-1 block text-[11px] opacity-75">Use credentials isolated to this tenant.</span>
          </button>
        </div>

        {credentialMode === 'dedicated' && (
          <div className="grid gap-3 rounded-xl border border-gray-800 bg-gray-950 p-4 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-gray-400">
              Client ID
              <input type="text" autoComplete="off" value={clientIdInput} onChange={(e) => setClientIdInput(e.target.value)}
                placeholder={config.credentials?.maskedClientId || 'Client ID'} className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label className="space-y-1 text-xs text-gray-400">
              Client secret
              <input type="password" autoComplete="new-password" value={clientSecretInput} onChange={(e) => setClientSecretInput(e.target.value)}
                placeholder={config.credentials?.hasClientSecret ? 'Configured — enter to replace' : 'Client secret'} className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white" />
            </label>
            <label className="space-y-1 text-xs text-gray-400 sm:col-span-2">
              Webhook HMAC secret <span className="text-gray-600">(optional until provisioned)</span>
              <input type="password" autoComplete="new-password" value={webhookSecretInput} onChange={(e) => setWebhookSecretInput(e.target.value)}
                placeholder={config.credentials?.hasWebhookSecret ? 'Configured — enter to replace' : 'Webhook HMAC secret'} className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white" />
            </label>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={handleSaveCredentials} disabled={savingCredentials}
            className="rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-50">
            {savingCredentials ? 'Saving…' : 'Save connection'}
          </button>
          <button type="button" onClick={handleTestOAuth} disabled={testingOAuth}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${testingOAuth ? 'animate-spin' : ''}`} />
            {testingOAuth ? 'Testing…' : oauthReady ? 'Test again' : 'Test connection'}
          </button>
          {oauthReady && <span className="text-xs font-semibold text-emerald-400">Connected to Deliverect</span>}
        </div>
        {oauthResult && !oauthResult.success && <p className="text-xs text-red-300">{oauthResult.message}</p>}
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4" data-admin-ai-target="deliverect-account">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-white">2. Choose account</h3>
            <p className="text-xs text-gray-400">Find the Deliverect accounts available to this connection.</p>
          </div>
          <button type="button" onClick={handleDiscoverAccounts} disabled={syncingAccounts || !oauthReady}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${syncingAccounts ? 'animate-spin' : ''}`} />
            {syncingAccounts ? 'Finding…' : 'Find accounts'}
          </button>
        </div>

        {noAccountsWarning && <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">{noAccountsWarning}</div>}
        {persistenceWarning && <div className="rounded-xl border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-200">{persistenceWarning}</div>}

        {linkedAccounts.length > 0 ? (
          <div className="space-y-2">
            {linkedAccounts.map((acc: any) => {
              const id = acc.deliverectAccountId || acc.accountLinkId || acc._id;
              const selected = selectedAccountId === id;
              return (
                <button key={id} type="button" onClick={() => setSelectedAccountId(id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                    selected ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 bg-gray-950 hover:border-gray-700'
                  }`}>
                  <span>
                    <span className="block text-sm font-bold text-white">{acc.displayName || acc.name || 'Deliverect account'}</span>
                    <span className="block text-[11px] text-gray-500">{id}</span>
                  </span>
                  {selected && <CheckCircle2 className="h-4 w-4 text-blue-400" />}
                </button>
              );
            })}
            <div className="flex justify-end pt-1">
              <button type="button" onClick={handleSelectAccount} disabled={!selectedAccountId}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40">
                Use this account
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-800 bg-gray-950/60 p-4 text-center text-xs text-gray-500">
            {oauthReady ? 'Find accounts to continue.' : 'Test the connection first.'}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-4" data-admin-ai-target="deliverect-locations">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-white">3. Assign locations</h3>
            <p className="text-xs text-gray-400">Only assigned Deliverect locations belong to this tenant until explicitly changed.</p>
          </div>
          <button type="button" onClick={() => handleDiscoverStores()} disabled={discoveringStores || !selectedAccountId}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${discoveringStores ? 'animate-spin' : ''}`} />
            {discoveringStores ? 'Loading…' : 'Load locations'}
          </button>
        </div>

        {discoveredStores.length > 0 ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {discoveredStores.map((st: any) => {
                const channelLinkId = String(st.channelLinkId || '');
                const selected = selectedChannelLinkIds.includes(channelLinkId);
                return (
                  <label key={st.commerceStoreId || channelLinkId || st._id}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                      selected ? 'border-emerald-700 bg-emerald-950/25' : 'border-gray-800 bg-gray-950'
                    }`}>
                    <input type="checkbox" checked={selected} disabled={!channelLinkId}
                      onChange={() => setSelectedChannelLinkIds((current) => selected ? current.filter((id) => id !== channelLinkId) : [...current, channelLinkId])}
                      className="mt-0.5 h-4 w-4 rounded border-gray-600 text-emerald-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-white">{st.name || 'Location'}</span>
                      <span className="block truncate text-[11px] text-gray-500">Channel {channelLinkId || 'not available'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-gray-300"><strong className="text-white">{selectedChannelLinkIds.length}</strong> location{selectedChannelLinkIds.length === 1 ? '' : 's'} assigned</span>
              <button type="button" onClick={handleSelectAccount} disabled={!selectedAccountId}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40">
                Save locations
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-800 bg-gray-950/60 p-4 text-center text-xs text-gray-500">
            {selectedAccountId ? 'Load locations to choose which belong to this tenant.' : 'Choose an account first.'}
          </p>
        )}
      </section>

      <details className="rounded-2xl border border-gray-800 bg-gray-900">
        <summary className="cursor-pointer list-none p-5 text-sm font-bold text-gray-200">
          Advanced setup &amp; provisioning
          <span className="ml-2 text-xs font-normal text-gray-500">Webhooks, channel registration and Retail endpoint overrides</span>
        </summary>
        <div className="space-y-5 border-t border-gray-800 p-5">
          <DeliverectChannelSetupGuide tenantId={tenantId} />

          <div className="rounded-xl border border-gray-800 bg-gray-950 p-4 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white">Retail / Quest order endpoint override</h4>
              <p className="mt-1 text-[11px] text-gray-500">Platform superadmin configuration only. Leave blank to use the environment/profile default.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={retailBaseUrl} onChange={(e) => setRetailBaseUrl(e.target.value)} placeholder="Base URL override"
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white" />
              <input value={retailPathTemplate} onChange={(e) => setRetailPathTemplate(e.target.value)} placeholder="Path template override"
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={retailVersion} onChange={(e) => setRetailVersion(e.target.value as any)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-white">
                <option value="none">Default version</option>
                <option value="retail">retail</option>
                <option value="stable">stable</option>
                <option value="rapid">rapid</option>
              </select>
              <button type="button" onClick={() => saveRetailOrderEndpoint(false)} disabled={savingRetailEndpoint}
                className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                {savingRetailEndpoint ? 'Saving…' : 'Save override'}
              </button>
              <button type="button" onClick={() => saveRetailOrderEndpoint(true)} disabled={savingRetailEndpoint}
                className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-bold text-gray-300 disabled:opacity-50">
                Use default
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Connection diagnostics and test tooling have moved out of the connection workflow. Use Connection Status for operational health after setup.
          </p>
        </div>
      </details>
    </div>
  );
};
