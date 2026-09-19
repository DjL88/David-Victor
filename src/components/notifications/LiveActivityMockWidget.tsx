import React, { useState } from 'react';
import { OrderLiveStatus } from '../../commerce/notificationModels';
import { useTenant } from '../../tenant/TenantContext';
import {
  Clock,
  CheckCircle2,
  Truck,
  ShoppingBag,
  MapPin,
  ChevronRight,
  Smartphone,
} from 'lucide-react';

interface LiveActivityMockWidgetProps {
  status?: OrderLiveStatus;
  interactivePreview?: boolean;
  orderId?: string;
  storeName?: string;
}

export const LiveActivityMockWidget: React.FC<LiveActivityMockWidgetProps> = ({
  status: propStatus,
  interactivePreview = false,
  orderId,
  storeName,
}) => {
  const { tenant } = useTenant();

  const mockStages: OrderLiveStatus[] = [
    {
      orderId: 'ord-preview-1',
      orderReference: 'ORD-8942',
      stage: 'PICKING',
      headline: 'Picking your order · 8 of 12 items',
      detail: 'Store specialist is picking chilled dairy and fresh produce',
      progress: 55,
      eta: '22 mins',
      finalTotal: 34.80,
      updatedAt: 'Just now',
    },
    {
      orderId: 'ord-preview-2',
      orderReference: 'ORD-8942',
      stage: 'PACKED',
      headline: 'Order packed · Final total £38.20',
      detail: 'Lower Price Guarantee applied. Ready for courier dispatch',
      progress: 72,
      eta: '18 mins',
      finalTotal: 38.20,
      updatedAt: '2 mins ago',
    },
    {
      orderId: 'ord-preview-3',
      orderReference: 'ORD-8942',
      stage: 'COURIER_ASSIGNED',
      headline: 'Courier assigned · Arriving 18:24',
      courierName: 'Alex (EV Courier)',
      detail: 'Arriving at Moulsham Street loading bay',
      progress: 82,
      eta: '18:24',
      finalTotal: 38.20,
      updatedAt: '1 min ago',
    },
    {
      orderId: 'ord-preview-4',
      orderReference: 'ORD-8942',
      stage: 'ON_THE_WAY',
      headline: 'On the way · 12 minutes',
      courierName: 'Alex',
      detail: '1.4 miles away • Delivering to High St Flat 4',
      progress: 92,
      eta: '12 mins',
      finalTotal: 38.20,
      updatedAt: 'Just now',
    },
    {
      orderId: 'ord-preview-5',
      orderReference: 'ORD-8942',
      stage: 'ARRIVING',
      headline: 'Arriving now',
      courierName: 'Alex',
      detail: 'Driver is pulling up outside your building',
      progress: 98,
      eta: '1 min',
      finalTotal: 38.20,
      updatedAt: 'Just now',
    },
  ];

  const [previewStageIndex, setPreviewStageIndex] = useState(0);

  const activeStatus: OrderLiveStatus =
    propStatus || mockStages[previewStageIndex];

  return (
    <div className="space-y-3">
      {interactivePreview && (
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
          <span className="font-semibold text-gray-500 whitespace-nowrap flex items-center gap-1">
            <Smartphone className="w-3.5 h-3.5" />
            Live Activity Stage:
          </span>
          <div className="flex gap-1">
            {mockStages.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPreviewStageIndex(idx)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  previewStageIndex === idx
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {s.stage}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* iOS ActivityKit / Dynamic Island style container */}
      <div className="bg-gray-950 text-white rounded-3xl p-4 shadow-xl border border-gray-800/80 max-w-md mx-auto">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2.5 pb-2 border-b border-gray-800/60">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: tenant?.primaryColour || '#10b981' }}
            />
            <span className="font-bold text-white text-[11px] tracking-wide">
              {tenant?.brandName || 'Store'} Live Order
            </span>
            <span className="text-gray-500">• {activeStatus.orderReference}</span>
          </div>
          {activeStatus.eta && (
            <div className="flex items-center gap-1 font-mono text-[11px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/50">
              <Clock className="w-3 h-3" />
              <span>{activeStatus.eta}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"
            style={{ backgroundColor: `${tenant?.primaryColour || '#059669'}30` }}
          >
            {activeStatus.stage === 'PICKING' ? (
              <ShoppingBag className="w-5 h-5 text-emerald-400 animate-bounce" />
            ) : activeStatus.stage === 'PACKED' ? (
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
            ) : (
              <Truck className="w-5 h-5 text-indigo-400 animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-white tracking-tight leading-snug">
              {activeStatus.headline}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
              {activeStatus.detail}
            </p>

            {/* Live Progress Bar */}
            <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${activeStatus.progress || 50}%`,
                  backgroundColor: tenant?.primaryColour || '#10b981',
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-gray-500 mt-2 font-mono">
              <span>{activeStatus.courierName || 'Store Fulfillment'}</span>
              {typeof activeStatus.finalTotal === 'number' && (
                <span className="font-bold text-gray-300">
                  Total: £{(activeStatus.finalTotal || 0).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
