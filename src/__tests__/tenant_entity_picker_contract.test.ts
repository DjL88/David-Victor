import { describe, expect, it } from 'vitest';
import {
  TENANT_ENTITY_KINDS,
  tenantEntityPickerState,
  validateTenantEntityOptions,
} from '../admin/tenantEntityPicker';

describe('tenant entity picker contract', () => {
  it('supports the shared authoring entity kinds', () => {
    expect(TENANT_ENTITY_KINDS).toEqual([
      'category', 'product', 'tag', 'location', 'region', 'page', 'offer',
    ]);
  });

  it('requires tenant scope before accepting dynamic options', () => {
    expect(() => validateTenantEntityOptions(
      { tenantId: '', kind: 'product' },
      [{ kind: 'product', value: 'PLU-1', label: 'Milk' }],
    )).toThrow(/tenantId/);
  });

  it('keeps persisted values stable and presentation labels transient', () => {
    const options = validateTenantEntityOptions(
      { tenantId: 'tenant-a', kind: 'product' },
      [
        { kind: 'product', value: 'PLU-1', label: 'Milk', searchText: 'Milk PLU-1' },
        { kind: 'product', value: 'PLU-1', label: 'Duplicate label' },
        { kind: 'category' as 'product', value: 'cat-1', label: 'Wrong kind' },
      ],
    );
    expect(options).toEqual([
      { kind: 'product', value: 'PLU-1', label: 'Milk', searchText: 'Milk PLU-1' },
    ]);
    expect({ kind: options[0].kind, value: options[0].value }).toEqual({
      kind: 'product',
      value: 'PLU-1',
    });
  });

  it('has explicit ready and empty semantics for accessible UIs', () => {
    expect(tenantEntityPickerState([]).status).toBe('empty');
    expect(tenantEntityPickerState([
      { kind: 'page', value: 'home', label: 'Home' },
    ]).status).toBe('ready');
  });
});
