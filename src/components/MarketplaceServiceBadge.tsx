import React, { useState } from 'react';
import { detectDeliveryMarketplace, type DeliveryMarketplaceIdentity } from '../commerce/deliveryMarketplace';

interface MarketplaceService {
  id: string;
  name: string;
  channel?: string | number;
  url?: string;
  marketplace?: string;
  status?: string | number;
}

export function ChannelBrandIcon({ identity, label }: { identity: DeliveryMarketplaceIdentity; label: string }) {
  const [failed, setFailed] = useState(false);
  const pixels = identity.maxIconPixels || 40;
  const initials = label.trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white" aria-hidden="true">
      {identity.iconUrl && !failed ? (
        <img
          src={identity.iconUrl} alt="" width={pixels} height={pixels}
          className="h-8 w-8 rounded-full object-contain"
          style={{ width: pixels, height: pixels, objectFit: 'contain' }}
          onError={() => setFailed(true)}
        />
      ) : (
        <span data-channel-icon-fallback className="text-[10px] font-semibold text-slate-500">{initials}</span>
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
  const content = <ChannelBrandIcon key={`${marketplace.key}:${marketplace.iconUrl || ''}`} identity={marketplace} label={label} />;
  const className = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600';
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer"
      aria-label={`Open ${label} in a new window`} title={label}
      className={className}>
      {content}
    </a>
  ) : (
    <span aria-label={`${label} (no customer link available)`} title={label} className={className}>{content}</span>
  );
};
