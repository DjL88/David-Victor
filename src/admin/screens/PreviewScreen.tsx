import React, { useState, useEffect } from 'react';
import { TenantConfig, Store, Product } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';

const defaultCommerceClient = getCommerceClient() as any;
import { Eye, Smartphone, Monitor, RefreshCw, ShoppingBag, ArrowRight } from 'lucide-react';
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

  useEffect(() => {
    loadPreviewData();
  }, [tenantId]);

  const loadPreviewData = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  if (loading || !config) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading preview environment...</span>
      </div>
    );
  }

  const selectedStore = stores.find((s) => s.id === selectedStoreId) || stores[0];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            <span>Storefront Live Sandbox Preview</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Simulates the guest-facing storefront with the current tenant's branding, active stories, and live fee policies.
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
                  Curated Essentials
                </span>
                <h3 className="text-sm font-black leading-tight">Essex Artisan Harvest Drop</h3>
                <p className="text-[11px] opacity-90">
                  Delivered in 20–30 mins from our micro-hub.
                </p>
              </div>

              {/* Product Grid */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-900 block">Popular Groceries</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/60 flex flex-col justify-between space-y-2"
                    >
                      <img
                        src={p.images?.[0] || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200'}
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
              <span className="text-gray-500 font-semibold">Authoritative Basket Active</span>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center gap-1 shadow-xs"
                style={{ backgroundColor: config.primaryColour }}
              >
                <span>View Storefront</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
