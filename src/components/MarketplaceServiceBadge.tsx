import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { detectDeliveryMarketplace, type DeliveryMarketplaceIdentity } from '../commerce/deliveryMarketplace';

interface MarketplaceService {
  id: string;
  name: string;
  channel?: string | number;
  url?: string;
  marketplace?: string;
}

function BrandTile({ identity, label }: { identity: DeliveryMarketplaceIdentity; label: string }) {
  const [failed, setFailed] = useState(false);
  const iconUrl = identity.badgeIconUrl || identity.iconUrl;
  const initials = label.trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <span data-channel-icon className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white" aria-hidden="true">
      {iconUrl && !failed ? (
        <img
          src={iconUrl} alt="" width={32} height={32}
          className="h-8 w-8 object-contain"
          style={{ width: 32, height: 32, objectFit: 'contain' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span data-channel-icon-fallback className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-slate-50 text-[10px] font-semibold text-slate-500">
          {initials}
        </span>
      )}
    </span>
  );
}

function externalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
      ? url.href : undefined;
  } catch { return undefined; }
}

export const MarketplaceServiceBadge: React.FC<{ service: MarketplaceService }> = ({ service }) => {
  const marketplace = detectDeliveryMarketplace(service.marketplace, service.name, service.channel);
  const label = marketplace.key === 'other' ? service.name || 'Other channel' : marketplace.label;
  const href = externalUrl(service.url);
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <BrandTile key={`${marketplace.key}:${marketplace.badgeIconUrl || marketplace.iconUrl || ''}`} identity={marketplace} label={label} />
        <span className="min-w-0">
          <span className="block truncate">{label}</span>
          {marketplace.serviceKind === 'direct-delivery' && (
            <span className="block text-[10px] font-medium text-slate-500">Direct delivery</span>
          )}
          {marketplace.key !== 'other' && service.name !== marketplace.label && (
            <span className="block truncate text-[10px] font-medium opacity-65">{service.name}</span>
          )}
        </span>
      </span>
      {href && <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />}
    </>
  );
  const className = 'flex min-w-0 items-center justify-between gap-2 rounded-xl border p-3 text-sm font-bold';
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`${className} border-emerald-200 bg-emerald-50 text-emerald-800`}>
      {content}
    </a>
  ) : (
    <div className={`${className} border-gray-200 bg-gray-50 text-gray-700`}>{content}</div>
  );
};
