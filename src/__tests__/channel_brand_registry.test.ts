import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CHANNEL_BRAND_REGISTRY,
  CHANNEL_NAME_ALIASES,
  detectDeliveryMarketplace,
  dispatchProviderIdentity,
  isStorefrontMarketplaceService,
  marketplaceForStore,
} from '../commerce/deliveryMarketplace';

describe('official channel identity registry', () => {
  it.each(Object.entries(CHANNEL_NAME_ALIASES))('resolves exact alias %s to %s', (alias, key) => {
    expect(detectDeliveryMarketplace(alias).key).toBe(key);
  });
  it.each([
    ['Uber_Direct', 'uber-direct'], ['Just Eat Go Birmingham', 'jet-go'],
    ['JET-GO', 'jet-go'], ['Thuisbezorgd.nl Amsterdam', 'thuisbezorgd'],
    ['Lieferando Berlin', 'lieferando'], ['Takeaway.com Brussels', 'takeaway'],
    ['Grubhub New York', 'grubhub'], ['Uber-Eats London', 'uber-eats'],
  ])('preserves product/region distinction for %s', (input, expected) => {
    expect(detectDeliveryMarketplace(input).key).toBe(expected);
  });
  it.each(['Uber', 'Go', 'Drive', 'My takeaway', 'DoorDash Drive', 'Wolt Drive', '__proto__', 'constructor', '19114'])('does not guess %s', input => {
    expect(detectDeliveryMarketplace(input).key).toBe('other');
  });
  it('does not concatenate names, coerce objects or infer numeric provider IDs', () => {
    expect(detectDeliveryMarketplace('Uber', 'Direct').key).toBe('other');
    expect(detectDeliveryMarketplace(19114, { toString: () => 'deliveroo' }).key).toBe('other');
    expect(detectDeliveryMarketplace(['', 'Deliveroo'] ).key).toBe('deliveroo');
  });
  it('retains explicit identity before loosely matching a human location label', () => {
    expect(detectDeliveryMarketplace('uber-direct', 'Uber Eats Glasgow').key).toBe('uber-direct');
    expect(detectDeliveryMarketplace('leitch-tech', 'Deliveroo test').isLeitchTech).toBe(true);
  });
  it('keeps direct services out of marketplace flags and reserves supplied artwork for tracking', () => {
    for (const key of ['uber-direct', 'jet-go'] as const) {
      expect(CHANNEL_BRAND_REGISTRY[key]).toMatchObject({
        serviceKind: 'direct-delivery', isThirdPartyMarketplace: false, isLeitchTech: false, assetStatus: 'user-provided',
      });
      expect(CHANNEL_BRAND_REGISTRY[key].iconUrl).toMatch(/^\/brand\/channels\/round\/(uber-direct|jet-go)\.png$/);
    }
  });
  it.each([
    ['ACTIVE', true], ['active', true], ['ONBOARDING', true], ['on-boarding', true],
    ['INACTIVE', false], ['SUSPENDED', false], ['TESTING', false], ['', false], [undefined, false],
  ])('shows marketplace status %s only when customer-facing', (status, visible) => {
    expect(isStorefrontMarketplaceService({ name: 'Deliveroo', status })).toBe(visible);
  });
  it.each(['Uber Direct', 'JET Go'])('never treats %s as a storefront marketplace', name => {
    expect(isStorefrontMarketplaceService({ name, status: 'ACTIVE', url: 'https://example.com' })).toBe(false);
  });
  it('maps direct dispatch providers to tracker artwork without accepting marketplaces', () => {
    expect(dispatchProviderIdentity({ dispatch: { providerId: 'uber-direct' } })?.key).toBe('uber-direct');
    expect(dispatchProviderIdentity({ delivery: { deliveryOption: { displayName: 'JET Go' } } })?.key).toBe('jet-go');
    expect(dispatchProviderIdentity({ dispatch: { providerDisplayName: 'Deliveroo' } })).toBeUndefined();
  });
  it('uses the assigned own channel link, not an unrelated store service', () => {
    const store = { channelLinkId: 'own', services: [
      { id: 'other', name: 'Deliveroo', marketplace: 'deliveroo' },
      { id: 'own', name: 'Leitch Tech', marketplace: 'leitch-tech' },
    ] };
    expect(marketplaceForStore(store).key).toBe('leitch-tech');
    expect(marketplaceForStore({ marketplace: '__proto__', provider: 'Wolt' }).key).toBe('wolt');
    expect(marketplaceForStore({ marketplace: 'uber-direct' }).key).toBe('uber-direct');
  });
  it('vendors all thirteen user-approved circular badges described by the channel map', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/brand/channels/round/channel-map.json'), 'utf8'));
    expect(manifest.baselineCssPixels).toBe(32);
    expect(manifest.channels).toHaveLength(13);
    const supplied = Object.values(CHANNEL_BRAND_REGISTRY).filter(entry => entry.assetStatus === 'user-provided');
    expect(supplied).toHaveLength(13);
    for (const entry of supplied) {
      expect(entry.iconUrl).toBe(`/brand/channels/round/${entry.key}.png`);
      expect(manifest.channels.find((item: any) => item.id === entry.key)).toBeDefined();
      expect(readFileSync(resolve('public', entry.iconUrl!.slice(1))).subarray(1, 4).toString()).toBe('PNG');
    }
    expect(CHANNEL_BRAND_REGISTRY.deliveroo.maxIconPixels).toBe(32);
  });
});
