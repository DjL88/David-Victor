/**
 * Shared Admin contract for selecting tenant-owned commerce/content entities.
 *
 * Values are stable references only. Labels and search metadata are transient
 * presentation data and must never become copied commerce truth.
 */
export const TENANT_ENTITY_KINDS = [
  'category',
  'product',
  'tag',
  'location',
  'region',
  'page',
  'offer',
] as const;

export type TenantEntityKind = typeof TENANT_ENTITY_KINDS[number];

export interface TenantEntityRef<K extends TenantEntityKind = TenantEntityKind> {
  kind: K;
  /** Stable tenant-scoped identifier. Product sources should use the canonical PLU. */
  value: string;
}

export interface TenantEntityOption<K extends TenantEntityKind = TenantEntityKind>
  extends TenantEntityRef<K> {
  label: string;
  description?: string;
  searchText?: string;
}

export type TenantEntityPickerState<K extends TenantEntityKind = TenantEntityKind> =
  | { status: 'idle'; options: readonly TenantEntityOption<K>[] }
  | { status: 'loading'; options: readonly TenantEntityOption<K>[] }
  | { status: 'ready'; options: readonly TenantEntityOption<K>[] }
  | { status: 'empty'; options: readonly TenantEntityOption<K>[] }
  | { status: 'error'; options: readonly TenantEntityOption<K>[]; message: string };

export interface TenantEntityQuery<K extends TenantEntityKind = TenantEntityKind> {
  tenantId: string;
  kind: K;
  query: string;
  signal?: AbortSignal;
}

export type TenantEntityOptionSource<K extends TenantEntityKind = TenantEntityKind> =
  (request: TenantEntityQuery<K>) => Promise<readonly TenantEntityOption<K>[]>;

export interface TenantEntityPickerContract<K extends TenantEntityKind = TenantEntityKind> {
  tenantId: string;
  kind: K;
  multiple: boolean;
  selected: readonly TenantEntityRef<K>[];
  source: TenantEntityOptionSource<K>;
}

/**
 * Defensive boundary for option sources. Cross-tenant or wrong-kind results are
 * rejected before they can be shown or persisted by a picker.
 */
export function validateTenantEntityOptions<K extends TenantEntityKind>(
  request: Pick<TenantEntityQuery<K>, 'tenantId' | 'kind'>,
  options: readonly TenantEntityOption<K>[],
): readonly TenantEntityOption<K>[] {
  if (!request.tenantId.trim()) throw new Error('Tenant entity picker requires a tenantId');
  const seen = new Set<string>();
  return options.filter((option) => {
    if (option.kind !== request.kind || !option.value.trim() || !option.label.trim()) return false;
    const key = `${option.kind}:${option.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function tenantEntityPickerState<K extends TenantEntityKind>(
  options: readonly TenantEntityOption<K>[],
): TenantEntityPickerState<K> {
  return options.length > 0
    ? { status: 'ready', options }
    : { status: 'empty', options };
}
