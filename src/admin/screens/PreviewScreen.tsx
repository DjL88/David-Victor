import React, { useState, useEffect } from 'react';
import { TenantConfig, Store, Product } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';

const defaultCommerceClient = getCommerceClient() as any;
import { Eye, Smartphone, Monitor, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface PreviewScreenProps {
  tenantId: string;
}

export const PreviewScreen: React.FC<PreviewScreenProps> = ({ tenantId }) => {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [deviceView, setDeviceView] = useState<'mobile' | 'desktop'>('mobile');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadPreviewData();
  }, [tenantId]);

  const loadPreviewData = async () => {
    setLoading(true);
    setError('');
    try {
      const branding = await defaultAdminClient.getBranding(tenantId);
      const storeList = await defaultAdminClient.getStores(tenantId);
      const productList = await defaultCommerceClient.getProducts();

      setConfig(branding);
      setStores(storeList);
      if (storeList.length > 0) {
        setSelectedStoreId(storeList[0].id);
      }
      setProducts(productList.slice(0, 8));
    } catch (err) {
      console.error(err);
      setError('Unable to load the storefront preview.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading preview environment...</span>
      </div>
    );
  }

  if (!config) {
    return <div className="p-8 text-center"><div role="alert" className="text-sm font-semibold text-rose-700">{error || 'Storefront preview is unavailable.'}</div><button type="button" onClick={loadPreviewData} className="mt-3 text-xs font-bold text-indigo-700 underline">Retry</button></div>;
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || stores[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            <span>Storefront preview</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Preview this brand's current storefront styling and a sample of its available content.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Store selector */}
          <select
            value={selectedStoreId}
            onChange={(e) => setSelectedStoreId(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold bg-white"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.isOpen ? 'Open' : 'Closed'})
              </option>
            ))}
          </select>

          {/* Device toggle */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setDeviceView('mobile')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                deviceView === 'mobile' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceView('desktop')}
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                deviceView === 'desktop' ? 'bg-white shadow-xs text-gray-900' : 'text-gray-500'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
          </div>
        </div>
      </div>

      {/* PREVIEW CONTAINER */}
      <div className="flex justify-center">
        <div
          className={`transition-all duration-300 ${
            deviceView === 'mobile'
              ? 'w-full max-w-sm rounded-[36px] border-8 border-gray-900 p-3 bg-gray-900 shadow-2xl'
              : 'w-full max-w-4xl rounded-2xl border border-gray-200 p-4 bg-gray-100 shadow-lg'
          }`}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden min-h-[560px] flex flex-col justify-between"
            style={{ fontFamily: config.fontFamily }}
          >
            {/* Storefront Header */}
            <div
              className="p-4 text-white space-y-2"
              style={{ backgroundColor: config.primaryColour }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black text-sm">
                    {config.brandName[0]}
                  </div>
                  <div>
                    <h2 className="text-sm font-black leading-tight">{config.brandName}</h2>
                    <span className="text-[10px] opacity-80">{selectedStore?.name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold">
                    ETA {selectedStore?.deliveryEta}
                  </span>
                </div>
              </div>
            </div>

            {/* Content Feed */}
            <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[440px]">
              {/* Inspiration Banner */}
              <div
                className="p-3.5 text-white rounded-2xl space-y-1 relative overflow-hidden"
                style={{
                  backgroundColor: config.primaryColour,
                  borderRadius: config.borderRadius,
                }}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                  Featured
                </span>
                <h3 className="text-sm font-black leading-tight">{config.tagline || config.brandName}</h3>
                <p className="text-[11px] opacity-90">Preview of your current brand styling.</p>
              </div>

              {/* Product Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-900 block">Products</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 flex flex-col justify-between space-y-2"
                    >
                      <img
                        src={p.images?.[0] || config.logoUrl || ''}
                        alt={p.name}
                        className="w-full h-20 object-cover rounded-lg bg-white"
                      />
                      <div>
                        <h4 className="text-[11px] font-bold text-gray-900 truncate">{p.name}</h4>
                        <span className="text-xs font-black text-gray-900 block">
                          {formatCurrency(p.price, '£')}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="w-full py-1 rounded-lg text-[10px] font-bold text-white shadow-2xs"
                        style={{ backgroundColor: config.primaryColour }}
                      >
                        Add to Basket
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Preview Bar */}
            <div className="p-3 border-t border-gray-100 bg-white flex items-center justify-between text-xs">
              <span className="text-gray-500 font-semibold">Preview only — actions are disabled</span>
              <span className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-[10px]">Admin preview</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
