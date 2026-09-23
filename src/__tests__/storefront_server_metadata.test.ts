import { describe, expect, it } from 'vitest';
import type { TenantConfig } from '../commerce/models';
import {
  buildStorefrontManifest,
  buildStorefrontMetadata,
  injectStorefrontMetadata,
} from '../../server/storefrontMetadataService';

const tenant: TenantConfig = {
  tenantId: 'brand-alpha',
  brandName: 'Square Shaped',
  tagline: 'Good things, delivered.',
  logoUrl: 'https://cdn.example/logo.png',
  iconUrl: 'https://cdn.example/icon.png',
  primaryColour: '#123456',
  secondaryColour: '#abcdef',
  backgroundColour: '#ffffff',
  textColour: '#111111',
  fontFamily: 'Inter',
  borderRadius: '12px',
  country: 'GB',
  currency: 'GBP',
  currencySymbol: '£',
  locale: 'en-GB',
  supportDetails: {
    email: 'help@example.com',
    phone: '01234 567890',
    openingHours: 'Mon-Sun',
  },
  featureFlags: {
    enableStories: true,
    enableRootCatalogBrowse: true,
    enableCollection: true,
    allowStoreSwitchingWithBasket: true,
    enableNutritionalInfo: true,
    enableDeposits: true,
    enableAgeVerification: true,
    enableSearchSuggestions: true,
  },
};

describe('server storefront metadata', () => {
  it('builds branded route metadata before React loads', () => {
    expect(
      buildStorefrontMetadata(tenant, '/aisle/fresh-food', 'https://shop.example.com')
    ).toMatchObject({
      title: 'Fresh Food | Square Shaped',
      description: 'Good things, delivered.',
      canonicalUrl: 'https://shop.example.com/aisle/fresh-food',
      imageUrl: 'https://cdn.example/logo.png',
      iconUrl: 'https://cdn.example/icon.png',
      themeColour: '#123456',
      locale: 'en-GB',
    });
  });

  it('replaces generic index metadata with tenant branding', () => {
    const source = `<!doctype html><html lang="en"><head>
      <title>Generic</title>
      <meta name="description" content="Generic description" />
      <meta property="og:title" content="Generic" />
      <meta property="og:description" content="Generic" />
    </head><body></body></html>`;

    const meta = buildStorefrontMetadata(tenant, '/p/DLV1006', 'https://shop.example.com');
    const html = injectStorefrontMetadata(source, meta);

    expect(html).toContain('<title>Product | Square Shaped</title>');
    expect(html).toContain('content="Good things, delivered."');
    expect(html).toContain('rel="canonical" href="https://shop.example.com/p/DLV1006"');
    expect(html).toContain('property="og:image" content="https://cdn.example/logo.png"');
    expect(html).toContain('name="theme-color" content="#123456"');
    expect(html).not.toContain('<title>Generic</title>');
  });

  it('creates a branded install manifest', () => {
    expect(buildStorefrontManifest(tenant)).toMatchObject({
      name: 'Square Shaped',
      short_name: 'Square Shaped',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#123456',
      lang: 'en-GB',
    });
  });
});
