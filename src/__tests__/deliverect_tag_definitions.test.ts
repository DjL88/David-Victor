import { describe, expect, it } from 'vitest';
import {
  mergeDeliverectTagDefinitions,
  normalizeDeliverectTagDefinitions,
} from '../../server/deliverect/DeliverectTagDefinitions';

describe('Deliverect allergen/tag definition normalization', () => {
  it('normalizes enum-to-integer maps', () => {
    const defs = normalizeDeliverectTagDefinitions({ EGGS: 104, MILK: 106, NUTS: 109 });
    expect(defs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '104', name: 'EGGS', isAllergen: true }),
      expect.objectContaining({ id: '106', name: 'MILK', isAllergen: true }),
      expect.objectContaining({ id: '109', name: 'NUTS', isAllergen: true }),
    ]));
  });

  it('normalizes integer-to-name maps', () => {
    const defs = normalizeDeliverectTagDefinitions({ '101': 'GLUTEN', '127': 'WHEAT', '4': 'VEGAN' });
    expect(defs).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '101', name: 'GLUTEN', isAllergen: true }),
      expect.objectContaining({ id: '127', name: 'WHEAT', isAllergen: true }),
      expect.objectContaining({ id: '4', name: 'VEGAN', isAllergen: false }),
    ]));
  });

  it('merges documented fallbacks so common staging IDs are readable', () => {
    const byId = new Map(mergeDeliverectTagDefinitions([]).map(d => [d.id, d.name]));
    expect(byId.get('104')).toBe('EGGS');
    expect(byId.get('106')).toBe('MILK');
    expect(byId.get('109')).toBe('NUTS');
    expect(byId.get('110')).toBe('PEANUTS');
    expect(byId.get('121')).toBe('OATS');
    expect(byId.get('127')).toBe('WHEAT');
    expect(byId.get('1128')).toBe('SUGAR_FREE');
    expect(byId.get('2002')).toBe('IBUPROFEN');
  });

  it('lets live metadata override a documented fallback', () => {
    const defs = mergeDeliverectTagDefinitions([{ id: 104, name: 'EGGS_LIVE' }]);
    expect(defs.find(d => d.id === '104')?.name).toBe('EGGS_LIVE');
  });
});
