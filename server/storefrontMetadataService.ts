import type { TenantConfig } from '../src/commerce/models';

export interface StorefrontMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl?: string;
  iconUrl?: string;
  themeColour?: string;
  locale: string;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function humaniseSlug(value: string): string {
  return decodeURIComponent(String(value || ''))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function routeLabel(pathname: string): string | null {
  const parts = String(pathname || '/').split('/').filter(Boolean);
  if (parts.length === 0) return null;

  if (parts[0] === 'search') return 'Search';
  if (parts[0] === 'aisle' && parts[1]) return humaniseSlug(parts[1]);
  if (parts[0] === 'p' && parts[1]) return 'Product';
  if (parts[0] === 'basket') return 'Basket';
  if (parts[0] === 'checkout') return 'Checkout';
  if (parts[0] === 'orders') return parts[1] ? 'Order' : 'Orders';
  if (parts[0] === 'account') return 'Account';

  return humaniseSlug(parts[parts.length - 1]);
}

export function buildStorefrontMetadata(
  tenant: TenantConfig,
  pathname: string,
  origin: string
): StorefrontMetadata {
  const label = routeLabel(pathname);
  const brandName = tenant.brandName || 'Storefront';
  const title = label ? `${label} | ${brandName}` : brandName;
  const description =
    tenant.tagline?.trim() ||
    `Shop ${brandName} online.`;

  const cleanOrigin = String(origin || '').replace(/\/+$/, '');
  const cleanPath = String(pathname || '/').startsWith('/') ? pathname : `/${pathname}`;

  return {
    title,
    description,
    canonicalUrl: `${cleanOrigin}${cleanPath}`,
    imageUrl: tenant.logoUrl || undefined,
    iconUrl: tenant.faviconUrl || tenant.iconUrl || undefined,
    themeColour: tenant.primaryColour || undefined,
    locale: tenant.locale || 'en-GB',
  };
}

function replaceOrInsertHeadTag(
  html: string,
  matcher: RegExp,
  replacement: string
): string {
  if (matcher.test(html)) return html.replace(matcher, replacement);
  return html.replace('</head>', `  ${replacement}\n  </head>`);
}

export function injectStorefrontMetadata(
  sourceHtml: string,
  metadata: StorefrontMetadata
): string {
  let html = sourceHtml;
  const title = escapeHtml(metadata.title);
  const description = escapeHtml(metadata.description);
  const canonical = escapeHtml(metadata.canonicalUrl);
  const locale = escapeHtml(metadata.locale.replace('-', '_'));

  html = html.replace(/<html([^>]*)\blang=["'][^"']*["']([^>]*)>/i, `<html$1lang="${escapeHtml(metadata.locale)}"$2>`);
  html = replaceOrInsertHeadTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+name=["']description["'][^>]*>/i,
    `<meta name="description" content="${description}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${title}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${description}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${canonical}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<meta\s+property=["']og:locale["'][^>]*>/i,
    `<meta property="og:locale" content="${locale}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<link\s+rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${canonical}" />`
  );
  html = replaceOrInsertHeadTag(
    html,
    /<link\s+rel=["']manifest["'][^>]*>/i,
    '<link rel="manifest" href="/manifest.webmanifest" />'
  );

  if (metadata.imageUrl) {
    html = replaceOrInsertHeadTag(
      html,
      /<meta\s+property=["']og:image["'][^>]*>/i,
      `<meta property="og:image" content="${escapeHtml(metadata.imageUrl)}" />`
    );
  }
  if (metadata.iconUrl) {
    html = replaceOrInsertHeadTag(
      html,
      /<link\s+rel=["'](?:icon|shortcut icon)["'][^>]*>/i,
      `<link rel="icon" href="${escapeHtml(metadata.iconUrl)}" />`
    );
  }
  if (metadata.themeColour) {
    html = replaceOrInsertHeadTag(
      html,
      /<meta\s+name=["']theme-color["'][^>]*>/i,
      `<meta name="theme-color" content="${escapeHtml(metadata.themeColour)}" />`
    );
  }

  return html;
}

export function buildStorefrontManifest(tenant: TenantConfig) {
  return {
    name: tenant.brandName,
    short_name: tenant.brandName.slice(0, 24),
    description: tenant.tagline || `Shop ${tenant.brandName} online.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: tenant.backgroundColour || '#ffffff',
    theme_color: tenant.primaryColour || '#111827',
    lang: tenant.locale || 'en-GB',
    icons: tenant.iconUrl
      ? [
          {
            src: tenant.iconUrl,
            sizes: 'any',
            purpose: 'any maskable',
          },
        ]
      : [],
  };
}
