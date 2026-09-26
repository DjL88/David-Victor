import React, { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import type { Order, PickingItem } from '../../commerce/models';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { useI18n } from '../../i18n/I18nContext';
import { changedLinePrice, observedMoney, safeProductImage, snapshotProductImage } from './trackerEvidence';
import { useTrackerCopy } from './trackerCopy';

// Images are optional enrichment from LTx's existing store-scoped read endpoint.
// Never poll the catalogue for each order-status update or fan out unbounded reads.
let imageReads = 0;
const waitingImageReads: Array<() => void> = [];
function enqueueImageRead<T>(read: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const start = () => {
      imageReads += 1;
      void Promise.resolve().then(read).then(resolve, reject).finally(() => {
        imageReads -= 1;
        waitingImageReads.shift()?.();
      });
    };
    if (imageReads < 4) start(); else waitingImageReads.push(start);
  });
}

export function OrderProductImage({ order, plu, name, snapshot }: {
  order: Order; plu: string; name: string; snapshot?: unknown;
}) {
  const copy = useTrackerCopy();
  const suppliedImage = snapshotProductImage(order, plu, snapshot);
  const scope = `${order.tenantId}:${order.storeId}:${order.id}:${plu}`;
  const [enriched, setEnriched] = useState<{ scope: string; src: string } | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = suppliedImage || (enriched?.scope === scope ? enriched.src : undefined);

  useEffect(() => {
    if (suppliedImage || !plu || !order.tenantId || !order.storeId) return;
    let disposed = false;
    void enqueueImageRead(async () => {
      if (disposed) return;
      const result = await getCommerceClient().getProduct(plu, order.storeId);
      if (disposed || result?.product?.plu !== plu) return;
      const product = result.product;
      const image = safeProductImage(product.imageUrl || product.image || product.images?.[0]);
      if (image) setEnriched({ scope, src: image });
    }).catch(() => { /* Missing catalogue imagery must never block the order. */ });
    return () => { disposed = true; };
  }, [scope, suppliedImage, plu, order.tenantId, order.storeId]);

  return <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-white">
    {src && failedSource !== src
      ? <img src={src} alt={name} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailedSource(src)} />
      : <span role="img" aria-label={`${copy('tracker.imageUnavailable')}: ${name}`}><Package className="h-6 w-6 text-gray-300" aria-hidden="true" /></span>}
  </div>;
}

export function OrderPickingItems({ order }: { order: Order }) {
  const { t, locale, formatCurrency } = useI18n();
  const copy = useTrackerCopy();
  const money = (value: unknown) => {
    const amount = observedMoney(value);
    return amount ? formatCurrency(amount.amount, amount.currency) : t('product.priceUnavailable');
  };
  const quantity = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value) : '—';

  const renderQuantity = (value: number, label: string, unit?: string) => <span
    className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-extrabold text-gray-900"
    aria-label={`${label}: ${quantity(value)}${unit ? ` ${unit}` : ''}`}>
    × {quantity(value)}{unit ? ` ${unit}` : ''}
  </span>;

  const stateLabel = (item: PickingItem) => {
    switch (item.state) {
      case 'PICKED': return t('tracking.picked');
      case 'SUBSTITUTED': return item.substitution?.decisionStatus === 'PENDING_CUSTOMER' ? t('tracking.pending') : t('tracking.substituted');
      case 'QUANTITY_AMENDED': return t('tracking.quantityAdjusted');
      case 'REMOVED': return copy('tracker.removed');
      default: return t('tracking.awaitingPicker');
    }
  };

  return <div className="space-y-3" aria-label={t('tracking.pickingItems')}>
    {(order.picking?.items || []).map((item) => {
      const removed = item.state === 'REMOVED';
      const substituted = item.state === 'SUBSTITUTED' && Boolean(item.substitution);
      const originalPlu = item.substitution?.originalPlu || item.plu;
      const originalName = item.substitution?.originalName || item.name || originalPlu;
      const originalImage = item.plu === originalPlu ? item.imageUrl : undefined;
      const finalPrice = item.state === 'PENDING' ? item.originalPrice : item.finalPrice;
      const substitution = item.substitution;
      const replacementImage = substitution ? (substitution as unknown as { substituteImageUrl?: string }).substituteImageUrl : undefined;
      return <article key={item.id} data-order-item={item.id}
        className={`rounded-2xl border p-4 text-xs ${removed ? 'border-gray-200 bg-gray-50' : substituted ? 'border-indigo-200 bg-indigo-50/30' : item.state === 'QUANTITY_AMENDED' ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200 bg-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <OrderProductImage key={`${order.tenantId}:${order.id}:${originalPlu}`} order={order} plu={originalPlu} name={originalName} snapshot={originalImage} />
            <div className="min-w-0 flex-1">
              {substituted && <p className="mb-1 text-[10px] font-semibold uppercase text-gray-500">{copy('tracker.original')}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={`font-bold ${removed ? 'text-gray-600' : 'text-gray-950'}`}>{originalName}</h3>
                {renderQuantity(item.originalQuantity, t('tracking.requested'), item.unit)}
              </div>
              <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">{stateLabel(item)}</span>
              {item.state === 'QUANTITY_AMENDED' && <p className="mt-2 text-amber-900">
                <strong>{copy('tracker.quantityChange')}:</strong> {quantity(item.originalQuantity)} → {quantity(item.pickedQuantity)}
                {item.amendment?.reason ? ` · ${item.amendment.reason}` : ''}
              </p>}
              {item.state !== 'PENDING' && !substituted && <div className="mt-2 flex items-center gap-2 text-gray-600">
                <span>{t('tracking.supplied')}</span>{renderQuantity(removed ? 0 : item.pickedQuantity, t('tracking.supplied'), item.unit)}
              </div>}
            </div>
          </div>
          <div className="ml-auto text-right" aria-label={copy('tracker.currentLineTotal')}>
            <strong className="block text-sm text-gray-950">{money(finalPrice)}</strong>
            {(changedLinePrice(item) || removed) && observedMoney(item.originalPrice) && <s className="mt-1 block text-[11px] text-gray-500">{money(item.originalPrice)}</s>}
          </div>
        </div>
        {substituted && substitution && <div className="mt-3 flex items-start gap-3 rounded-xl border border-indigo-100 bg-white p-3">
          <OrderProductImage key={`${order.tenantId}:${order.id}:${substitution.substitutePlu}`} order={order} plu={substitution.substitutePlu} name={substitution.substituteName || substitution.substitutePlu} snapshot={replacementImage} />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase text-indigo-700">{copy('tracker.replacement')}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2"><strong>{substitution.substituteName || substitution.substitutePlu}</strong>
              {renderQuantity(item.pickedQuantity, t('tracking.supplied'), item.unit)}
            </div>
            {substitution.reason && <p className="mt-1 text-gray-600">{substitution.reason}</p>}
            <p className="mt-2 font-semibold text-gray-800">{copy('tracker.currentLineTotal')}: {money(item.finalPrice)}</p>
          </div>
        </div>}
      </article>;
    })}
  </div>;
}
