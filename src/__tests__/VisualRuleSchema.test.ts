import { describe, expect, it } from 'vitest';
import { SaveVisualRuleSchema } from '../../server/api/schemas';

const validRule = {
  id: 'rule-1',
  name: 'Alcohol controls',
  enabled: true,
  countries: ['GB'],
  priority: 100,
  matchConditions: [
    { field: 'isAlcohol', operator: 'equals', value: 'true' },
    { field: 'category', operator: 'contains', value: 'wine' },
  ],
  actions: [
    { type: 'MINIMUM_AGE', minimumAge: 18 },
    { type: 'EXCLUDE_FROM_DISCOUNTS' },
    { type: 'PREVENT_RECOMMENDATION' },
  ],
};

describe('SaveVisualRuleSchema', () => {
  it('accepts multi-condition multi-action rules', () => {
    expect(SaveVisualRuleSchema.parse(validRule)).toMatchObject(validRule);
  });
  it('normalizes country codes', () => {
    expect(SaveVisualRuleSchema.parse({ ...validRule, countries: ['gb', 'ie'] }).countries).toEqual(['GB', 'IE']);
  });
  it('rejects empty conditions', () => {
    expect(() => SaveVisualRuleSchema.parse({ ...validRule, matchConditions: [] })).toThrow();
  });
  it('rejects blank condition values', () => {
    expect(() => SaveVisualRuleSchema.parse({ ...validRule, matchConditions: [{ field: 'productTag', operator: 'equals', value: '   ' }] })).toThrow();
  });
  it('rejects rules without actions', () => {
    expect(() => SaveVisualRuleSchema.parse({ ...validRule, actions: [] })).toThrow();
  });
  it('rejects unsupported actions', () => {
    expect(() => SaveVisualRuleSchema.parse({ ...validRule, actions: [{ type: 'DO_SOMETHING_UNSAFE' }] })).toThrow();
  });
  it('rejects invalid quantity boundaries', () => {
    expect(() => SaveVisualRuleSchema.parse({ ...validRule, actions: [{ type: 'MAX_QUANTITY_PER_ORDER', maximum: 0 }] })).toThrow();
  });
  it('rejects unexpected payload fields', () => {
    expect(() => SaveVisualRuleSchema.parse({ ...validRule, tenantId: 'other-brand' })).toThrow();
  });
});
