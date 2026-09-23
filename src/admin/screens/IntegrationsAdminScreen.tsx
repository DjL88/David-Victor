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

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link2 className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-bold text-white">Deliverect Setup</h2>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Multi-tenant live staging orchestration: Credentials → OAuth Token → Linked Account → Commerce Stores.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 border ${currentStatus.bg}`}
            >
              <span className={`w-2 h-2 rounded-full ${currentStatus.dot}`} />
              {currentStatus.label}
            </span>
          </div>
        </div>

        {/* Multi-step visual progress bar */}
        <div className="mt-6 pt-6 border-t border-gray-800 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div
            className={`p-3 rounded-xl border text-xs ${
              config.environment
                ? 'bg-gray-800/80 border-gray-700 text-gray-200'
                : 'bg-gray-900 border-gray-800 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span className="w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Credentials</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Staging Secret Manager</p>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs ${
              platformOauthVerified ||
              config.status === 'OAUTH_VERIFIED' ||
              config.status === 'ACCOUNT_MAPPED' ||
              config.status === 'COMMERCE_VERIFIED' ||
              config.status === 'CONNECTED'
                ? 'bg-amber-950/40 border-amber-700/60 text-amber-200'
                : 'bg-gray-900 border-gray-800 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  platformOauthVerified ||
                  config.status === 'OAUTH_VERIFIED' ||
                  config.status === 'ACCOUNT_MAPPED' ||
                  config.status === 'COMMERCE_VERIFIED' ||
                  config.status === 'CONNECTED'
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                2
              </span>
              <span>OAuth Handshake</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Client Credentials Token</p>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs ${
              config.status === 'ACCOUNT_MAPPED' ||
              config.status === 'COMMERCE_VERIFIED' ||
              config.status === 'CONNECTED'
                ? 'bg-blue-950/40 border-blue-700/60 text-blue-200'
                : 'bg-gray-900 border-gray-800 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  config.status === 'ACCOUNT_MAPPED' ||
                  config.status === 'COMMERCE_VERIFIED' ||
                  config.status === 'CONNECTED'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                3
              </span>
              <span>Linked Account</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Get Linked Accounts</p>
          </div>

          <div
            className={`p-3 rounded-xl border text-xs ${
              config.status === 'COMMERCE_VERIFIED' || config.status === 'CONNECTED'
                ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                : 'bg-gray-900 border-gray-800 text-gray-500'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  config.status === 'COMMERCE_VERIFIED' || config.status === 'CONNECTED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                4
              </span>
              <span>Commerce Stores</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Get Stores & Channels</p>
          </div>
        </div>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-3 bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-xl text-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Integration settings persisted securely to Firestore.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-red-950/80 border border-red-700 text-red-200 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <DeliverectChannelSetupGuide tenantId={tenantId} />

      {/* Main integration panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Progressive Steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 1: Environment & Credential Overview */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center">
                  <Key className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">1. Connection details</h3>
                  <p className="text-xs text-gray-400">Server-side credentials managed securely in Secret Manager</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((prev: any) => ({ ...prev, environment: 'staging' }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    (config.environment || 'staging') === 'staging'
                      ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  STAGING
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev: any) => ({ ...prev, environment: 'production' }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
                    config.environment === 'production'
                      ? 'bg-amber-950 border-amber-600 text-amber-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  PRODUCTION
                </button>
              </div>
            </div>

            <div className="p-4 bg-gray-950 border border-gray-800 rounded-xl text-xs space-y-4">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <Lock className="w-4 h-4" />
                <span>Tenant credential source</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCredentialMode('platform')}
                  className={`p-3 rounded-xl border text-left ${credentialMode === 'platform' ? 'border-emerald-600 bg-emerald-950/40 text-white' : 'border-gray-800 text-gray-400'}`}
                >
                  <span className="block font-semibold">Platform credentials</span>
                  <span className="block text-[11px] mt-1 opacity-80">Use the shared Deliverect partner credentials.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCredentialMode('dedicated')}
                  className={`p-3 rounded-xl border text-left ${credentialMode === 'dedicated' ? 'border-emerald-600 bg-emerald-950/40 text-white' : 'border-gray-800 text-gray-400'}`}
                >
                  <span className="block font-semibold">Dedicated credentials</span>
                  <span className="block text-[11px] mt-1 opacity-80">Use credentials isolated to this tenant.</span>
                </button>
              </div>

              {credentialMode === 'dedicated' && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-gray-400">Client ID</span>
                    <input type="text" autoComplete="off" value={clientIdInput} onChange={(e) => setClientIdInput(e.target.value)} placeholder={config.credentials?.maskedClientId || 'Deliverect Client ID'} className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white" />
                  </label>
                  <label className="space-y-1">
                    <span className="text-gray-400">Client Secret</span>
                    <input type="password" autoComplete="new-password" value={clientSecretInput} onChange={(e) => setClientSecretInput(e.target.value)} placeholder={config.credentials?.hasClientSecret ? 'Configured — enter to replace' : 'Client Secret'} className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white" />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-gray-400">Webhook Secret <span className="text-gray-600">(optional until webhook provisioning)</span></span>
                    <input type="password" autoComplete="new-password" value={webhookSecretInput} onChange={(e) => setWebhookSecretInput(e.target.value)} placeholder={config.credentials?.hasWebhookSecret ? 'Configured — enter to replace' : 'Webhook HMAC secret'} className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-white" />
                  </label>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-gray-400 text-[11px] leading-relaxed">
                  Secrets are written server-side to Google Secret Manager and are never returned to the browser. Dedicated mode fails closed rather than falling back to platform credentials.
                </p>
                <button type="button" onClick={handleSaveCredentials} disabled={savingCredentials} className="shrink-0 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50">
                  {savingCredentials ? 'Saving…' : 'Save credentials'}
                </button>
              </div>
            </div>
          </div>

          {/* STEP 2: Test connection */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">2. Test connection</h3>
                  <p className="text-xs text-gray-400">Requests OAuth token using client credentials grant & caches it</p>
                </div>
              </div>

              {platformOauthVerified ||
              config.status === 'OAUTH_VERIFIED' ||
              config.status === 'ACCOUNT_MAPPED' ||
              config.status === 'COMMERCE_VERIFIED' ||
              config.status === 'CONNECTED' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  OAUTH VERIFIED
                </span>
              ) : null}
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Executes a genuine OAuth token request against the Deliverect OAuth endpoint (<code className="text-amber-300">https://api.staging.deliverect.com/oauth/token</code>). On success, caches token and returns safe diagnostic latency. Does not require linked accounts to exist.
            </p>

            {oauthResult && (
              <div
                className={`p-4 rounded-xl text-xs border space-y-2 ${
                  oauthResult.success
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                    : 'bg-red-950/40 border-red-800/80 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {oauthResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  )}
                  <span>{oauthResult.message}</span>
                </div>
                {oauthResult.success && (
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-amber-300/80 pt-1 font-mono">
                    <div>Latency: {oauthResult.latencyMs}ms</div>
                    <div>Environment: {oauthResult.environment}</div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleTestOAuth}
                disabled={testingOAuth}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50 transition shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${testingOAuth ? 'animate-spin' : ''}`} />
                <span>{testingOAuth ? 'Acquiring Token...' : 'Test connection'}</span>
              </button>
            </div>
          </div>

          {/* STEP 3: Discover & Select Deliverect Account */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">3. Choose Deliverect account</h3>
                  <p className="text-xs text-gray-400">Query Deliverect Commerce Get Linked Accounts</p>
                </div>
              </div>

              {config.status === 'ACCOUNT_MAPPED' ||
              config.status === 'COMMERCE_VERIFIED' ||
              config.status === 'CONNECTED' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ACCOUNT MAPPED
                </span>
              ) : null}
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Calls Deliverect Commerce <code className="text-blue-300">/accounts</code> to discover authorized brand accounts. Never requires manually guessing or typing account IDs.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDiscoverAccounts}
                disabled={syncingAccounts}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAccounts ? 'animate-spin' : ''}`} />
                <span>{syncingAccounts ? 'Querying Upstream Accounts...' : 'Find accounts'}</span>
              </button>
              {linkedAccounts.length > 0 && (
                <span className="text-xs text-emerald-400 font-medium">
                  {linkedAccounts.length} account{linkedAccounts.length === 1 ? '' : 's'} discovered
                </span>
              )}
            </div>

            {noAccountsWarning && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-300">Zero Linked Accounts Discovered</div>
                  <div className="text-amber-200/90 leading-relaxed">{noAccountsWarning}</div>
                </div>
              </div>
            )}

            {persistenceWarning && (
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-amber-300">Discovery Succeeded, Persistence Partial Failure (IAM Notice)</div>
                  <div className="text-amber-200/90 leading-relaxed">{persistenceWarning}</div>
                </div>
              </div>
            )}

            {linkedAccounts.length > 0 ? (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-gray-300">
                  Select Deliverect Account for Brand:
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {linkedAccounts.map((acc: any) => {
                    const id = acc.deliverectAccountId || acc.accountLinkId || acc._id;
                    const isSelected = selectedAccountId === id;
                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedAccountId(id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-950/60 border-blue-500 text-white'
                            : 'bg-gray-950 border-gray-800 text-gray-300 hover:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="deliverectAccount"
                            checked={isSelected}
                            onChange={() => setSelectedAccountId(id)}
                            className="text-blue-500 focus:ring-0"
                          />
                          <div>
                            <div className="font-semibold text-sm text-white flex items-center gap-2">
                              {acc.displayName || acc.name || 'Deliverect Brand Account'}
                              {isSelected && (
                                <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  Selected
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-gray-400">Account ID: {id}</div>
                          </div>
                        </div>

                        <span className="text-xs font-mono text-gray-400">
                          {acc.status || 'ACTIVE'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleSelectAccount}
                    disabled={!selectedAccountId}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold cursor-pointer disabled:opacity-50 transition shadow-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Map Account to Tenant</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-950 border border-gray-800/80 rounded-xl text-xs text-gray-400 text-center">
                Click &quot;Find accounts&quot; above to query Deliverect staging with your verified OAuth credentials.
              </div>
            )}
          </div>

          {/* STEP 4: Import locations */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center">
                  <Store className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">4. Import locations</h3>
                  <p className="text-xs text-gray-400">Fetch real stores, channel links, and physical locations</p>
                </div>
              </div>

              {config.status === 'COMMERCE_VERIFIED' || config.status === 'CONNECTED' ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  COMMERCE VERIFIED
                </span>
              ) : null}
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              Uses the verified Commerce <code className="text-emerald-300">/commerce/&#123;accountId&#125;/stores</code> contract to retrieve operational stores, channel links, and availability without inventing synthetic IDs.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleDiscoverStores()}
                disabled={discoveringStores}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${discoveringStores ? 'animate-spin' : ''}`} />
                <span>{discoveringStores ? 'Discovering Stores...' : 'Import locations'}</span>
              </button>
              {discoveredStores.length > 0 && (
                <span className="text-xs text-emerald-400 font-semibold">
                  {discoveredStores.length} store{discoveredStores.length === 1 ? '' : 's'} discovered
                </span>
              )}
            </div>

            {discoveredStores.length > 0 ? (
              <div className="space-y-3 pt-2">
                <div className="overflow-x-auto rounded-xl border border-gray-800">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-gray-950 text-gray-400 border-b border-gray-800 font-medium">
                      <tr>
                        <th className="p-3">Use</th>
                        <th className="p-3">Store Name</th>
                        <th className="p-3">Channel Link ID</th>
                        <th className="p-3">Location ID</th>
                        <th className="p-3">Capabilities</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 bg-gray-900/50">
                      {discoveredStores.map((st: any) => {
                        const storeId = st.commerceStoreId || st.channelLinkId || st._id;
                        const channelLinkId = String(st.channelLinkId || '');
                        const isAssigned = selectedChannelLinkIds.includes(channelLinkId);
                        return (
                          <tr key={storeId} className="hover:bg-gray-800/40">
                            <td className="p-3"><input type="checkbox" checked={isAssigned} disabled={!channelLinkId} aria-label={`Assign ${st.name || 'store'} to this brand`} onChange={() => setSelectedChannelLinkIds((current) => isAssigned ? current.filter((id) => id !== channelLinkId) : [...current, channelLinkId])} className="w-4 h-4 rounded border-gray-600 text-emerald-500" /></td>
                            <td className="p-3 font-semibold text-white flex items-center gap-2">
                              <Store className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              {st.name || 'Store'}
                            </td>
                            <td className="p-3 font-mono text-emerald-300 text-[11px]">
                              {st.channelLinkId || 'N/A'}
                            </td>
                            <td className="p-3 font-mono text-gray-400 text-[11px]">
                              {st.physicalLocationId || st.locationId || 'N/A'}
                            </td>
                            <td className="p-3 text-[11px]">
                              <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                                {Array.isArray(st.fulfillmentCapabilitiesProjection)
                                  ? st.fulfillmentCapabilitiesProjection.join(', ')
                                  : typeof st.fulfillmentCapabilitiesProjection === 'object' && st.fulfillmentCapabilitiesProjection !== null
                                  ? Object.entries(st.fulfillmentCapabilitiesProjection)
                                      .filter(([_, enabled]) => Boolean(enabled))
                                      .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
                                      .join(', ') || 'None'
                                  : 'Delivery, Collection'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                                {st.stateProjection?.status || 'ONLINE'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
                  <div><div className="text-sm font-bold text-white">{selectedChannelLinkIds.length} store{selectedChannelLinkIds.length === 1 ? '' : 's'} assigned to this brand</div><p className="text-[11px] text-gray-400 mt-1">Only checked stores and their catalogues will be visible to this tenant.</p></div>
                  <button type="button" onClick={handleSelectAccount} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2"><Save className="w-4 h-4" />Save assigned stores</button>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-950 border border-gray-800/80 rounded-xl text-xs text-gray-400 text-center">
                Once a Deliverect Account is selected in Step 3, click &quot;Import locations&quot; to fetch and map live stores.
              </div>
            )}
          </div>

          {/* Step 5: Place Test Pickup Order Probe */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan-900/60 border border-cyan-700/50 text-cyan-300 font-bold text-xs flex items-center justify-center">
                  5
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-cyan-400" />
                    <span>Place Test Pickup Order</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Executes an isolated pickup test order via Deliverect Commerce API without changing live customer checkout
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block text-gray-400 font-medium mb-1">Target Store / Location</label>
                <select
                  value={testOrderChannelLinkId || selectedChannelLinkIds[0] || ''}
                  onChange={(e) => setTestOrderChannelLinkId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                >
                  {discoveredStores.length === 0 && <option value="">Auto-select first available store</option>}
                  {discoveredStores.map((st: any) => (
                    <option key={st.channelLinkId || st.id} value={st.channelLinkId}>
                      {st.name || 'Store'} ({st.channelLinkId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label className="block text-gray-400 font-medium">Test Basket Items</label>
                
                {/* Primary Item */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Menu ID (optional)"
                    value={testOrderMenuId}
                    onChange={(e) => setTestOrderMenuId(e.target.value)}
                    className="w-2/5 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="PLU (e.g. LATTE-01)"
                    value={testOrderPlu}
                    onChange={(e) => setTestOrderPlu(e.target.value)}
                    className="w-2/5 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={testOrderQuantity}
                    onChange={(e) => setTestOrderQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-1/5 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    placeholder="Qty"
                  />
                </div>

                {/* Additional Items */}
                {testOrderAdditionalItems.map((item) => (
                  <div key={item.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Menu ID (optional)"
                      value={item.menuId}
                      onChange={(e) => updateTestOrderItem(item.id, 'menuId', e.target.value)}
                      className="w-2/5 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="text"
                      placeholder="PLU (e.g. ESPRESSO-02)"
                      value={item.plu}
                      onChange={(e) => updateTestOrderItem(item.id, 'plu', e.target.value)}
                      className="w-2/5 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={item.quantity}
                      onChange={(e) => updateTestOrderItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-1/5 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      onClick={() => removeTestOrderItem(item.id)}
                      className="p-2 text-gray-500 hover:text-rose-400 transition-colors"
                      title="Remove Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={addTestOrderItem}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Row</span>
                  </button>
                  <p className="text-[10px] text-gray-500">Leave PLU empty to auto-discover first item from store catalog</p>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Customer Name & Phone</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={testOrderCustomerName}
                    onChange={(e) => setTestOrderCustomerName(e.target.value)}
                    className="w-1/2 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    placeholder="Phone Number"
                    value={testOrderCustomerPhone}
                    onChange={(e) => setTestOrderCustomerPhone(e.target.value)}
                    className="w-1/2 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-medium mb-1">Customer Email</label>
                <input
                  type="email"
                  placeholder="test@bwydi.com"
                  value={testOrderCustomerEmail}
                  onChange={(e) => setTestOrderCustomerEmail(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-800">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testOrderPerformCheckout}
                  onChange={(e) => setTestOrderPerformCheckout(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-700 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Perform Unpaid Checkout (<code className="text-cyan-400">isPrepaid: false</code>)</span>
              </label>

              <button
                type="button"
                onClick={handlePlaceTestOrder}
                disabled={placingTestOrder}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-cyan-900/20"
              >
                {placingTestOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Test Order...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Place Test Order</span>
                  </>
                )}
              </button>
            </div>

            {testOrderError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Test Order Failed</div>
                  <div className="mt-0.5 font-mono text-[11px]">{testOrderError}</div>
                </div>
              </div>
            )}

            {testOrderResult && (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Test Pickup Order Placed Successfully</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRawTestOrderJson(!showRawTestOrderJson)}
                    className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>{showRawTestOrderJson ? 'Hide Raw Payload' : 'View Raw Deliverect Payload'}</span>
                    {showRawTestOrderJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-2 bg-gray-950/80 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px]">BASKET ID</div>
                    <div className="font-mono font-semibold text-emerald-400 truncate text-[11px]">{testOrderResult.basketId || 'N/A'}</div>
                  </div>
                  <div className="p-2 bg-gray-950/80 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px]">AUTHORITATIVE TOTAL</div>
                    <div className="font-mono font-bold text-white text-[11px]">
                      £{(Number(testOrderResult.totalMinor || testOrderResult.reconciledBasket?.payment?.total || testOrderResult.basket?.paymentSummary?.basketTotal || 0) / 100).toFixed(2)}
                    </div>
                  </div>
                  <div className="p-2 bg-gray-950/80 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px]">CHANNEL ORDER ID</div>
                    <div className="font-mono font-semibold text-gray-300 truncate text-[11px]">{testOrderResult.channelOrderId || 'N/A'}</div>
                  </div>
                  <div className="p-2 bg-gray-950/80 rounded-lg border border-gray-800">
                    <div className="text-gray-500 text-[10px]">DISPLAY ID</div>
                    <div className="font-mono font-bold text-amber-400 text-[11px]">{testOrderResult.channelOrderDisplayId || 'N/A'}</div>
                  </div>
                </div>

                {/* Requested vs Reconciled items view */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs border-t border-emerald-900/40">
                  <div className="p-3 bg-gray-950/80 rounded-xl border border-gray-800/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Requested Items</div>
                    <ul className="space-y-1 font-mono text-[11px] text-gray-300">
                      {(testOrderResult.resolved?.items || [
                        { menuId: testOrderResult.resolved?.menuId, plu: testOrderResult.resolved?.plu, quantity: testOrderResult.resolved?.quantity || 1 }
                      ]).map((item: any, idx: number) => (
                        <li key={idx} className="flex justify-between items-center bg-gray-900/60 px-2.5 py-1 rounded border border-gray-800/50">
                          <span className="truncate">{item.plu || 'Auto-Discovered PLU'}</span>
                          <span className="text-cyan-400 font-bold ml-2">x{item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 bg-gray-950/80 rounded-xl border border-gray-800/80 space-y-1.5">
                    <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex justify-between">
                      <span>Deliverect Reconciled Items</span>
                    </div>
                    {(() => {
                      const reconciledItems = testOrderResult.reconciledBasket?.items || testOrderResult.basket?.items || [];
                      if (!reconciledItems.length) {
                        return <div className="text-[11px] text-gray-500 italic">No reconciled item details returned</div>;
                      }
                      return (
                        <ul className="space-y-1 font-mono text-[11px] text-gray-300">
                          {reconciledItems.map((item: any, idx: number) => (
                            <li key={idx} className="flex justify-between items-center bg-gray-900/60 px-2.5 py-1 rounded border border-gray-800/50">
                              <span className="truncate">{item.name || item.plu || item.itemPlu || `Item #${idx + 1}`}</span>
                              <span className="text-emerald-400 font-bold ml-2">x{item.quantity || item.qty || 1}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                </div>

                {showRawTestOrderJson && (
                  <pre className="p-3 bg-gray-950 border border-gray-800 rounded-xl text-[10px] font-mono text-gray-300 overflow-x-auto max-h-60">
                    {JSON.stringify(testOrderResult, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Architecture, Firestore & Diagnostic Summary */}
        <div className="space-y-6">
          {/* Integration Status Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center">
                <Database className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Data isolation</h3>
                <p className="text-xs text-gray-400">Tenant-Scoped Persistence</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-gray-400">Tenant:</span>
                <span className="font-mono text-emerald-400 text-[11px] font-semibold">{tenantId}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-gray-400">Status:</span>
                <span className="font-semibold text-white">{config.status || 'UNCONFIGURED'}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-gray-400">Selected Account:</span>
                <span className="font-mono text-gray-300 text-[11px] truncate max-w-[150px]">
                  {config.deliverectAccountId || 'None'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-gray-800">
                <span className="text-gray-400">Stores Mapped:</span>
                <span className="font-semibold text-emerald-400">{discoveredStores.length}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-gray-400">Last Synced:</span>
                <span className="text-gray-400 text-[11px]">
                  {config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleTimeString() : 'Not synced yet'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-[11px] text-gray-400 space-y-1.5">
              <div className="font-semibold text-gray-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Authoritative Upstream Policy</span>
              </div>
              <p>
                In staging and production, the platform does not allow mock fallback. Deliverect is authoritative for all menu items, prices, and inventory availability.
              </p>
            </div>
          </div>

          {/* Quest Retail callback provisioning */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center shrink-0">
                <Radio className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Quest order webhooks</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Copy these exact URLs into Deliverect Partner Integration → Order info.
                </p>
              </div>
            </div>

            {[
              {
                key: 'pickingStatus',
                label: 'Order picking status webhook URL',
                method: 'POST',
                value: questRetailWebhookUrls.pickingStatus,
              },
              {
                key: 'amendments',
                label: 'Order amendments webhook URL',
                method: 'POST',
                value: questRetailWebhookUrls.amendments,
              },
              {
                key: 'substitutions',
                label: 'Order substitutions endpoint URL',
                method: 'GET',
                value: questRetailWebhookUrls.substitutions,
              },
            ].map((row) => (
              <div key={row.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold text-gray-300">
                    {row.label}
                  </label>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-cyan-300 border border-gray-700">
                    {row.method}
                  </span>
                </div>
                <div className="flex items-stretch gap-2">
                  <input
                    type="text"
                    readOnly
                    value={row.value}
                    className="min-w-0 flex-1 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-[10px] font-mono text-gray-300 focus:outline-none focus:border-cyan-700"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    type="button"
                    onClick={() => copyQuestWebhook(row.key, row.value)}
                    className="px-3 rounded-xl border border-gray-700 bg-gray-950 hover:bg-gray-800 text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 text-[11px] font-semibold"
                    title={`Copy ${row.label}`}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedWebhookKey === row.key ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}

            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-900/60 text-[11px] text-cyan-100/80 space-y-1">
              <div className="font-semibold text-cyan-300">Staging callback security</div>
              <p>
                The BFF verifies Deliverect HMAC signatures. In staging it also supports Deliverect&apos;s documented channelLinkId signing fallback when no dedicated HMAC secret is configured.
              </p>
            </div>
          </div>

          {/* Quick diagnostics summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Live Staging Verification</h4>
              <button
                onClick={runCommerceDiagnostics}
                disabled={diagnosticsLoading}
                className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                title="Refresh Live Catalog Diagnostics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${diagnosticsLoading ? 'animate-spin' : ''}`} />
                <span>Diagnostics</span>
              </button>
            </div>
            <button onClick={downloadRawMenu} disabled={diagnosticsLoading || discoveredStores.length === 0} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-700 bg-gray-950 text-xs font-semibold text-cyan-300 hover:border-cyan-700 disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> Download received menu JSON
            </button>
            <button onClick={runMenuInspection} disabled={diagnosticsLoading || discoveredStores.length === 0} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-700 bg-gray-950 text-xs font-semibold text-purple-300 hover:border-purple-700 disabled:opacity-40">
              <Layers className="w-3.5 h-3.5" /> Inspect published menu
            </button>
            <div className="space-y-2.5 text-xs text-gray-400">
              <div className="flex items-center justify-between">
                <span>OAuth Token:</span>
                <span className={oauthResult?.success || config.status !== 'UNCONFIGURED' ? 'text-amber-400 font-semibold' : 'text-gray-500'}>
                  {oauthResult?.success || config.status !== 'UNCONFIGURED' ? 'Active' : 'Not Tested'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Accounts Sync:</span>
                <span className={linkedAccounts.length > 0 ? 'text-blue-400 font-semibold' : 'text-gray-500'}>
                  {linkedAccounts.length > 0 ? `${linkedAccounts.length} Discovered` : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Store Mapping:</span>
                <span className={discoveredStores.length > 0 ? 'text-emerald-400 font-semibold' : 'text-gray-500'}>
                  {discoveredStores.length > 0 ? `${discoveredStores.length} Stores` : 'Pending'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-gray-800 pt-2">
                <span title="Commerce root menu published from Deliverect's master/primary location. This is a published browse menu, not the tenant product master.">Published Root Menu:</span>
                <span className={commerceDiagnostics?.rootCatalog ? 'text-purple-400 font-semibold' : 'text-gray-500'}>
                  {commerceDiagnostics?.rootCatalog
                    ? `${commerceDiagnostics.rootCatalog.menusCount || 1} Menu (${commerceDiagnostics.rootCatalog.categoriesCount} cats)`
                    : 'Awaiting Run'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Store Menu:</span>
                <span className={commerceDiagnostics?.storeCatalog ? 'text-cyan-400 font-semibold' : 'text-gray-500'}>
                  {commerceDiagnostics?.storeCatalog
                    ? `${commerceDiagnostics.storeCatalog.menusCount || 1} Menu (${commerceDiagnostics.storeCatalog.categoriesCount} cats)`
                    : 'Awaiting Run'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span title="Count from the currently retrieved published Commerce menu/store menu. Hosted Channel menu pushes become the authoritative channel catalogue once received.">Published Products:</span>
                <span className={commerceDiagnostics?.totalProductsCount ? 'text-emerald-400 font-bold' : 'text-gray-500'}>
                  {commerceDiagnostics?.totalProductsCount
                    ? `${commerceDiagnostics.totalProductsCount} Live Items`
                    : 'Pending'}
                </span>
              </div>
            </div>

            {diagnosticsError && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800 text-[11px] text-rose-300">
                {diagnosticsError}
              </div>
            )}

            {commerceDiagnostics && commerceDiagnostics.totalProductsCount > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-800 text-[11px] text-gray-400 space-y-1">
                <div className="text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Real Upstream Staging Verified
                </div>
                <div className="text-gray-500 truncate">
                  Store Channel: {commerceDiagnostics.stores?.items?.[0]?.channelLinkId || 'N/A'}
                </div>
                {commerceDiagnostics.stores?.items?.[0]?.brandStoreId && (
                  <div className="text-gray-500 truncate">
                    Friendly Store ID: {commerceDiagnostics.stores.items[0].brandStoreId}
                  </div>
                )}
              </div>
            )}

            {menuInspection?.inspection && (
              <div className="mt-3 pt-3 border-t border-gray-800 text-[11px] text-gray-400 space-y-1.5">
                <div className="font-semibold text-purple-300">
                  Menu Inspector · {menuInspection.inspection.menuName || menuInspection.inspection.menuId}
                </div>
                <div>
                  {menuInspection.inspection.categoryCount} categories · {menuInspection.inspection.productCount} products
                </div>
                <div>
                  Native hierarchy: {menuInspection.inspection.nativeHierarchyDetected ? 'Yes (subCategories present)' : 'No — sequential fallback required'}
                </div>
                <div>
                  Structure issues: {menuInspection.inspection.issues?.length || 0}
                </div>
                <div>
                  Merchandising flag: {menuInspection.inspection.merchandisingSummary?.explicitCategoryCount > 0 ? 'Explicit field detected' : 'Not exposed by received Commerce menu'}
                </div>
                {menuInspection.inspection.numericProductTagIds?.length > 0 && (
                  <div className="text-amber-400">
                    Numeric tag IDs in raw menu: {menuInspection.inspection.numericProductTagIds.join(', ')}
                  </div>
                )}
                <p className="text-gray-500">
                  {menuInspection.inspection.merchandisingSummary?.note}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
