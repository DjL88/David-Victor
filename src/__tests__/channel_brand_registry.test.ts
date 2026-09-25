import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { CHANNEL_BRAND_REGISTRY, CHANNEL_NAME_ALIASES, detectDeliveryMarketplace, marketplaceForStore } from '../commerce/deliveryMarketplace';

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
  it('keeps direct services out of marketplace flags while giving them compact presentation badges', () => {
    expect(CHANNEL_BRAND_REGISTRY['uber-direct']).toMatchObject({
      serviceKind: 'direct-delivery', isThirdPartyMarketplace: false, isLeitchTech: false,
      assetStatus: 'pending', badgeIconUrl: '/brand/channels/round/uber-direct.svg',
    });
    expect(CHANNEL_BRAND_REGISTRY['jet-go']).toMatchObject({
      serviceKind: 'direct-delivery', isThirdPartyMarketplace: false, isLeitchTech: false,
      assetStatus: 'pending', badgeIconUrl: '/brand/channels/round/jet-go.svg',
    });
    expect(CHANNEL_BRAND_REGISTRY['uber-direct'].iconUrl).toBeUndefined();
    expect(CHANNEL_BRAND_REGISTRY['jet-go'].iconUrl).toBeUndefined();
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
  it('vendors eleven official-source files with matching provenance checksums and round wrappers', () => {
    const manifest = JSON.parse(readFileSync(resolve('public/brand/channels/sources.json'), 'utf8'));
    expect(manifest.entries).toHaveLength(11);
    const official = Object.values(CHANNEL_BRAND_REGISTRY).filter(entry => entry.assetStatus === 'official-source');
    expect(official).toHaveLength(11);
    for (const entry of official) {
      expect(entry.iconUrl).toMatch(/^\/brand\/channels\/[a-z-]+\.(png|webp|svg)$/);
      expect(entry.badgeIconUrl).toMatch(/^\/brand\/channels\/round\/[a-z-]+\.svg$/);
      const source = manifest.entries.find((item: any) => item.id === entry.key);
      expect(source.asset).toBe(entry.iconUrl);
      expect(source.sourcePage).toMatch(/^https:\/\//);
      const filePath = resolve('public', entry.iconUrl!.slice(1));
      const rawBytes = readFileSync(filePath);
      // Git may materialise text SVGs with CRLF on Windows while the reviewed
      // repository/deployment bytes use LF. Normalise text line endings before
      // checking provenance; raster assets remain byte-for-byte verified.
      const bytes = entry.iconUrl!.endsWith('.svg')
        ? Buffer.from(rawBytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
        : rawBytes;
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.assetSha256);
      expect(readFileSync(resolve('public', entry.badgeIconUrl!.slice(1)), 'utf8')).toContain('<svg');
    }
    expect(CHANNEL_BRAND_REGISTRY.deliveroo.maxIconPixels).toBe(32);
  });
  it('keeps the round library map complete and preserves the requested Snappy/JET presentation', () => {
    const map = JSON.parse(readFileSync(resolve('public/brand/channels/round/map.json'), 'utf8'));
    expect(map.size).toBe(32);
    expect(Object.keys(map.channels)).toHaveLength(13);
    expect(map.channels['snappy-shopper']).toBe('snappy-shopper.svg');
    expect(map.channels['jet-go']).toBe('jet-go.svg');

    const snappySource = readFileSync(resolve('public/brand/channels/snappy-shopper.webp')).toString('base64');
    const snappyRound = readFileSync(resolve('public/brand/channels/round/snappy-shopper.svg'), 'utf8');
    expect(snappyRound).toContain('#8DBFC0');
    expect(snappyRound).toContain(snappySource);

    const justEatSource = readFileSync(resolve('public/brand/channels/just-eat.webp')).toString('base64');
    const jetGoRound = readFileSync(resolve('public/brand/channels/round/jet-go.svg'), 'utf8');
    expect(jetGoRound).toContain(justEatSource);
  });
});
