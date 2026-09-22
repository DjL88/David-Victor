import type { BundleProduct, Product } from './models';
import type { SelectedBundleModifier } from './bundleModels';
import { allocateProtectedBundlePrices, type ProtectedBundleAllocation } from './bundleAllocation';

export interface BasketDealInput { plu: string; quantity: number }
export interface AutomaticDealAllocation extends ProtectedBundleAllocation {
  scoreSavingMinor: number;
  scoreUnits: number;
}

/**
 * Stateless supermarket-style deal qualification.
 * Basket lines are the source of truth; allocations are derived afresh after
 * every mutation/store change. A physical unit may be consumed by one deal only.
 */
export function qualifyAutomaticDeals(
  items: BasketDealInput[],
  bundles: BundleProduct[],
  products: Product[],
): AutomaticDealAllocation[] {
  const pool = new Map<string, number>();
  for (const item of items) pool.set(item.plu, (pool.get(item.plu) || 0) + Math.max(0, item.quantity));

  const productByPlu = new Map(products.map((product) => [product.plu, product]));
  const priceMinor = (product?: Product): number | undefined => {
    if (!product) return undefined;
    const value: any = product.price ?? product.basePrice ?? product.priceMinor;
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    return value && Number.isInteger(value.amount) ? value.amount : undefined;
  };

  // Build every currently satisfiable single-instance candidate first.
  const candidates: AutomaticDealAllocation[] = [];
  for (const bundle of bundles) {
    if (bundle.stockStatus === 'OUT_OF_STOCK') continue;
    const selections: SelectedBundleModifier[] = [];
    let valid = true;
    for (const section of (bundle.sections || bundle.modifierGroups || []).filter((s) => !s.isUpsell && s.min > 0)) {
      let remaining = section.min;
      for (const modifier of section.modifiers) {
        const plu = String(modifier.standalonePlu || '').trim();
        const product = productByPlu.get(plu);
        const shelf = priceMinor(product);
        if (!plu || !product || product.active === false || product.stockStatus === 'OUT_OF_STOCK' || shelf === undefined) continue;
        const take = Math.min(pool.get(plu) || 0, remaining);
        if (take > 0) {
          selections.push({ modifierId: modifier.id, plu: modifier.plu, name: modifier.name, quantity: take, price: modifier.priceMinor ?? modifier.price ?? 0, priceMinor: modifier.priceMinor ?? modifier.price ?? 0, standalonePlu: plu, standalonePriceMinor: shelf, sectionId: section.id, sectionName: section.name });
          remaining -= take;
        }
        if (remaining === 0) break;
      }
      if (remaining > 0) { valid = false; break; }
    }
    if (!valid || selections.length === 0) continue;
    try {
      const allocation = allocateProtectedBundlePrices(bundle, selections, 1);
      candidates.push({ ...allocation, scoreSavingMinor: allocation.discountTotalMinor, scoreUnits: allocation.components.reduce((n,c)=>n+c.quantity,0) });
    } catch { /* malformed deal cannot poison basket qualification */ }
  }

  // Best customer saving wins, then strongest coverage, then stable bundle ID.
  candidates.sort((a,b) => b.scoreSavingMinor-a.scoreSavingMinor || b.scoreUnits-a.scoreUnits || a.bundleId.localeCompare(b.bundleId));

  const remaining = new Map(pool);
  const chosen: AutomaticDealAllocation[] = [];
  for (const candidate of candidates) {
    if (candidate.components.every((c)=>(remaining.get(c.componentPlu)||0)>=c.quantity)) {
      chosen.push(candidate);
      candidate.components.forEach((c)=>remaining.set(c.componentPlu,(remaining.get(c.componentPlu)||0)-c.quantity));
    }
  }
  return chosen;
}
