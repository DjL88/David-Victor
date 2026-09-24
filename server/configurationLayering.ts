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
  if (from >= until) throw new Error(`Configuration layer "${layer.id}" effectiveFrom must be before effectiveUntil.`);
  return now >= from && now < until;
}

function requireScope(layer: ConfigurationLayer<Record<string, unknown>>, key: keyof ConfigurationScope): void {
  if (!layer.scope[key]) throw new Error(`Configuration layer "${layer.id}" must declare ${key} for ${layer.kind} scope.`);
}

function assertContext(layer: ConfigurationLayer<Record<string, unknown>>, context: ConfigurationScope): void {
  if (layer.kind === 'PLATFORM') {
    if (Object.values(layer.scope).some((value) => value !== undefined)) {
      throw new Error(`Configuration layer "${layer.id}" cannot narrow PLATFORM scope.`);
    }
    return;
  }

  requireScope(layer, 'tenantId');
  requireScope(layer, 'environment');
  if (layer.kind === 'MARKET' || layer.kind === 'REGION' || layer.kind === 'LOCATION' || layer.kind === 'OPERATIONAL_OVERRIDE') requireScope(layer, 'marketId');
  if (layer.kind === 'REGION') requireScope(layer, 'regionId');
  if (layer.kind === 'LOCATION') requireScope(layer, 'locationId');

  const keys: Array<keyof ConfigurationScope> = ['tenantId', 'environment', 'marketId', 'regionId', 'locationId'];
  for (const key of keys) {
    const actual = layer.scope[key];
    if (actual === undefined) continue;
    const expected = context[key];
    if (expected === undefined) {
      throw new Error(`Configuration layer "${layer.id}" declares ${key} but requested context does not.`);
    }
    if (actual !== expected) {
      throw new Error(`Configuration layer "${layer.id}" ${key} "${actual}" does not match requested "${expected}".`);
    }
  }
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
