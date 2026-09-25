import React from 'react';
import { ExternalLink } from 'lucide-react';
import { detectDeliveryMarketplace } from '../commerce/deliveryMarketplace';

interface MarketplaceService {
  id: string;
  name: string;
  channel?: string | number;
  url?: string;
  marketplace?: string;
}

export const MarketplaceServiceBadge: React.FC<{ service: MarketplaceService }> = ({ service }) => {
  const marketplace = detectDeliveryMarketplace(service.marketplace, service.name, service.channel);
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
          style={{ border: `1px solid ${marketplace.colour}33` }}
        >
          {marketplace.iconUrl ? (
            <img
              src={marketplace.iconUrl}
              alt=""
              className="h-5 w-5 object-contain"
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className="text-[10px] font-black" style={{ color: marketplace.colour }}>
              {marketplace.label.slice(0, 2).toUpperCase()}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate">{marketplace.key === 'other' ? service.name : marketplace.label}</span>
          {marketplace.key !== 'other' && service.name !== marketplace.label && (
            <span className="block truncate text-[10px] font-medium opacity-65">{service.name}</span>
          )}
        </span>
      </span>
      {service.url && <ExternalLink className="h-4 w-4 shrink-0" />}
    </>
  );

  const className = 'flex items-center justify-between gap-2 rounded-xl border p-3 text-sm font-bold';
  return service.url ? (
    <a
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} border-emerald-200 bg-emerald-50 text-emerald-800`}
    >
      {content}
    </a>
  ) : (
    <div className={`${className} border-gray-200 bg-gray-50 text-gray-700`}>{content}</div>
  );
};
