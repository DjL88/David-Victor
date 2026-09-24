export type ConfigurationLayerKind = 'PLATFORM' | 'MARKET' | 'RETAILER' | 'REGION' | 'LOCATION' | 'OPERATIONAL_OVERRIDE';

export interface ConfigurationScope {
  tenantId?: string;
  environment?: string;
  marketId?: string;
  regionId?: string;
  locationId?: string;
}

export interface ConfigurationLayer<T extends Record<string, unknown>> {
  kind: ConfigurationLayerKind;
  id: string;
  scope: ConfigurationScope;
  values: Partial<T>;
  effectiveFrom?: string;
  effectiveUntil?: string;
}

export interface ResolvedConfiguration<T extends Record<string, unknown>> {
  values: T;
  appliedLayers: Array<{ kind: ConfigurationLayerKind; id: string }>;
}

const PRECEDENCE: Record<ConfigurationLayerKind, number> = {
  PLATFORM: 0, MARKET: 1, RETAILER: 2, REGION: 3, LOCATION: 4, OPERATIONAL_OVERRIDE: 5,
};

function active(layer: ConfigurationLayer<Record<string, unknown>>, now: number): boolean {
  const from = layer.effectiveFrom ? Date.parse(layer.effectiveFrom) : Number.NEGATIVE_INFINITY;
  const until = layer.effectiveUntil ? Date.parse(layer.effectiveUntil) : Number.POSITIVE_INFINITY;
  if (Number.isNaN(from) || Number.isNaN(until)) throw new Error(`Configuration layer "${layer.id}" has an invalid effective date.`);
  return now >= from && now < until;
}

function assertContext(layer: ConfigurationLayer<Record<string, unknown>>, context: ConfigurationScope): void {
  const keys: Array<keyof ConfigurationScope> = ['tenantId', 'environment', 'marketId', 'regionId', 'locationId'];
  for (const key of keys) {
    const expected = context[key];
    const actual = layer.scope[key];
    if (actual !== undefined && expected !== undefined && actual !== expected) {
      throw new Error(`Configuration layer "${layer.id}" ${key} "${actual}" does not match requested "${expected}".`);
    }
  }
  if (layer.kind !== 'PLATFORM' && context.tenantId && !layer.scope.tenantId) throw new Error(`Configuration layer "${layer.id}" must declare tenantId outside PLATFORM scope.`);
  if (layer.kind !== 'PLATFORM' && context.environment && !layer.scope.environment) throw new Error(`Configuration layer "${layer.id}" must declare environment outside PLATFORM scope.`);
}

export function resolveLayeredConfiguration<T extends Record<string, unknown>>(
  platformDefaults: T,
  layers: Array<ConfigurationLayer<T>>,
  context: ConfigurationScope,
  at: Date = new Date()
): ResolvedConfiguration<T> {
  const applicable = layers
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => {
      assertContext(layer as ConfigurationLayer<Record<string, unknown>>, context);
      return active(layer as ConfigurationLayer<Record<string, unknown>>, at.getTime());
    })
    .sort((a, b) => PRECEDENCE[a.layer.kind] - PRECEDENCE[b.layer.kind] || a.index - b.index);

  return {
    values: applicable.reduce<T>((resolved, { layer }) => ({ ...resolved, ...layer.values }), { ...platformDefaults }),
    appliedLayers: [{ kind: 'PLATFORM', id: 'platform-defaults' }, ...applicable.map(({ layer }) => ({ kind: layer.kind, id: layer.id }))],
  };
}
