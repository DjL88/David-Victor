import type { BundleProduct, Product } from './models';
import type { SelectedBundleModifier } from './bundleModels';
import { allocateProtectedBundlePrices, type ProtectedBundleAllocation } from './bundleAllocation';

export interface BasketDealInput { plu: string; quantity: number }
export interface AutomaticDealAllocation extends ProtectedBundleAllocation {
  scoreSavingMinor: number;
  scoreUnits: number;
}

const productPriceMinor = (product?: Product): number | undefined => {
  if (!product) return undefined;
  const value: any = product.price ?? product.basePrice ?? product.priceMinor;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  return value && Number.isInteger(value.amount) ? value.amount : undefined;
};

function buildCandidate(
  bundle: BundleProduct,
  pool: Map<string, number>,
  productByPlu: Map<string, Product>,
): AutomaticDealAllocation | null {
  const selections: SelectedBundleModifier[] = [];
  const local = new Map(pool);
  const sections = bundle.sections || bundle.modifierGroups || [];

  for (const section of sections.filter((s) => !s.isUpsell && s.min > 0)) {
    let needed = section.min;
    for (const modifier of section.modifiers) {
      const plu = String(modifier.standalonePlu || '').trim();
      const product = productByPlu.get(plu);
      const shelf = productPriceMinor(product);
      if (!plu || !product || product.active === false || product.stockStatus === 'OUT_OF_STOCK' || shelf === undefined) continue;
      const take = Math.min(local.get(plu) || 0, needed);
      if (take > 0) {
        selections.push({ modifierId: modifier.id, plu: modifier.plu, name: modifier.name, quantity: take, price: modifier.priceMinor ?? modifier.price ?? 0, priceMinor: modifier.priceMinor ?? modifier.price ?? 0, standalonePlu: plu, standalonePriceMinor: shelf, sectionId: section.id, sectionName: section.name });
        local.set(plu, (local.get(plu) || 0) - take);
        needed -= take;
      }
      if (!needed) break;
    }
    if (needed > 0) return null;
  }
  if (!selections.length) return null;

  // Optional upsells never determine whether the base deal qualifies. If their
  // product is present, include as many as the section permits. Their modifier
  // price is a conditional deal price; allocation clamps it to shelf price so
  // an upsell can discount but never surcharge the customer.
  for (const section of sections.filter((s) => s.isUpsell === true || s.min === 0)) {
    let room = Math.max(0, section.max ?? 0);
    if (!room) continue;
    for (const modifier of section.modifiers) {
      const declared = String(modifier.standalonePlu || '').trim();
      const modifierPlu = String(modifier.plu || '').trim();
      const product = productByPlu.get(declared) || productByPlu.get(modifierPlu);
      const plu = product?.plu || declared || modifierPlu;
      const shelf = productPriceMinor(product);
      if (!plu || product?.active === false || product?.stockStatus === 'OUT_OF_STOCK') continue;
      const available = local.get(plu) || 0;
      const take = Math.min(available, room);
      if (take <= 0) continue;
      const configuredUpsell = Math.max(0, Math.round(modifier.priceMinor ?? modifier.price ?? 0));
      // Optional deal pricing may discount a normal shelf product, but it must
      // never turn into a surcharge when the configured upsell price is stale
      // or higher than the destination store's current shelf price.
      const protectedUpsell = shelf === undefined ? configuredUpsell : Math.min(configuredUpsell, shelf);
      selections.push({ modifierId: modifier.id, plu: modifier.plu, name: modifier.name, quantity: take, price: protectedUpsell, priceMinor: protectedUpsell, standalonePlu: product?.plu, standalonePriceMinor: shelf ?? protectedUpsell, sectionId: section.id, sectionName: section.name });
      local.set(plu, available - take);
      room -= take;
      if (!room) break;
    }
  }

  try {
    const allocation = allocateProtectedBundlePrices(bundle, selections, 1);
    return { ...allocation, scoreSavingMinor: allocation.discountTotalMinor, scoreUnits: allocation.components.reduce((n,c)=>n+c.quantity,0) };
  } catch {
    return null;
  }
}

/** Stateless supermarket-style deal qualification. */
export function qualifyAutomaticDeals(
  items: BasketDealInput[],
  bundles: BundleProduct[],
  products: Product[],
): AutomaticDealAllocation[] {
  const remaining = new Map<string, number>();
  for (const item of items) remaining.set(item.plu, (remaining.get(item.plu) || 0) + Math.max(0, item.quantity));
  const productByPlu = new Map(products.map((product) => [product.plu, product]));
  const chosen: AutomaticDealAllocation[] = [];

  // Re-evaluate all deal types after each allocation. This supports repeated
  // instances (two meal-deal sets => two discounts) while ensuring a unit can
  // never be consumed twice. Greedy choice is deterministic and customer-first.
  while (true) {
    const candidates = bundles
      .filter((bundle) => bundle.stockStatus !== 'OUT_OF_STOCK')
      .map((bundle) => buildCandidate(bundle, remaining, productByPlu))
      .filter((candidate): candidate is AutomaticDealAllocation => Boolean(candidate))
      .sort((a,b) => b.scoreSavingMinor-a.scoreSavingMinor || b.scoreUnits-a.scoreUnits || a.bundleId.localeCompare(b.bundleId));
    const winner = candidates[0];
    if (!winner || winner.scoreSavingMinor <= 0) break;
    chosen.push(winner);
    for (const component of winner.components) {
      remaining.set(component.componentPlu, Math.max(0, (remaining.get(component.componentPlu) || 0) - component.quantity));
    }
  }
  return chosen;
}
