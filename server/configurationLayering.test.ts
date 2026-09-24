import { describe, expect, it } from 'vitest';
import { resolveLayeredConfiguration, type ConfigurationLayer } from './configurationLayering';

type Config = Record<string, unknown> & {
  label?: string;
  currency?: string;
  enabled?: boolean;
};

const context = {
  tenantId: 'tenant-a',
  environment: 'production',
  marketId: 'market-a',
  regionId: 'region-a',
  locationId: 'location-a',
};

describe('resolveLayeredConfiguration', () => {
  it('applies the global precedence deterministically', () => {
    const layers: Array<ConfigurationLayer<Config>> = [
      { kind: 'LOCATION', id: 'location', scope: context, values: { label: 'location' } },
      { kind: 'MARKET', id: 'market', scope: { tenantId: 'tenant-a', environment: 'production', marketId: 'market-a' }, values: { label: 'market', currency: 'EUR' } },
      { kind: 'RETAILER', id: 'retailer', scope: { tenantId: 'tenant-a', environment: 'production' }, values: { label: 'retailer' } },
      { kind: 'REGION', id: 'region', scope: { tenantId: 'tenant-a', environment: 'production', marketId: 'market-a', regionId: 'region-a' }, values: { label: 'region' } },
      { kind: 'OPERATIONAL_OVERRIDE', id: 'override', scope: context, values: { label: 'override', enabled: false } },
    ];

    const resolved = resolveLayeredConfiguration<Config>(
      { label: 'platform', enabled: true },
      layers,
      context,
      new Date('2026-09-25T00:00:00Z')
    );

    expect(resolved.values).toEqual({ label: 'override', currency: 'EUR', enabled: false });
    expect(resolved.appliedLayers.map((layer) => layer.kind)).toEqual([
      'PLATFORM', 'MARKET', 'RETAILER', 'REGION', 'LOCATION', 'OPERATIONAL_OVERRIDE',
    ]);
  });

  it('fails closed when a scoped layer cannot be proven to match the request context', () => {
    const layer: ConfigurationLayer<Config> = {
      kind: 'MARKET',
      id: 'market',
      scope: { tenantId: 'tenant-a', environment: 'production', marketId: 'market-a' },
      values: { enabled: true },
    };

    expect(() => resolveLayeredConfiguration({}, [layer], {
      tenantId: 'tenant-a',
      environment: 'production',
    })).toThrow(/requested context does not/);

    expect(() => resolveLayeredConfiguration({}, [layer], {
      tenantId: 'tenant-b',
      environment: 'production',
      marketId: 'market-a',
    })).toThrow(/does not match requested/);
  });

  it('requires structural scope identifiers and keeps platform layers global', () => {
    const missingMarket: ConfigurationLayer<Config> = {
      kind: 'MARKET',
      id: 'bad-market',
      scope: { tenantId: 'tenant-a', environment: 'production' },
      values: {},
    };
    expect(() => resolveLayeredConfiguration({}, [missingMarket], context)).toThrow(/must declare marketId/);

    const narrowedPlatform: ConfigurationLayer<Config> = {
      kind: 'PLATFORM',
      id: 'bad-platform',
      scope: { tenantId: 'tenant-a' },
      values: {},
    };
    expect(() => resolveLayeredConfiguration({}, [narrowedPlatform], context)).toThrow(/cannot narrow PLATFORM scope/);
  });

  it('honours effective windows and rejects invalid windows', () => {
    const scheduled: ConfigurationLayer<Config> = {
      kind: 'RETAILER',
      id: 'scheduled',
      scope: { tenantId: 'tenant-a', environment: 'production' },
      values: { label: 'scheduled' },
      effectiveFrom: '2026-09-25T01:00:00Z',
      effectiveUntil: '2026-09-25T02:00:00Z',
    };

    expect(resolveLayeredConfiguration({ label: 'platform' }, [scheduled], context, new Date('2026-09-25T00:30:00Z')).values.label).toBe('platform');
    expect(resolveLayeredConfiguration({ label: 'platform' }, [scheduled], context, new Date('2026-09-25T01:30:00Z')).values.label).toBe('scheduled');

    expect(() => resolveLayeredConfiguration({}, [{
      ...scheduled,
      id: 'invalid-window',
      effectiveFrom: '2026-09-25T02:00:00Z',
      effectiveUntil: '2026-09-25T01:00:00Z',
    }], context)).toThrow(/effectiveFrom must be before effectiveUntil/);
  });
});
