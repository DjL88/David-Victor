/**
 * PLU and Item Name Display Normalization Utilities.
 *
 * Requirements:
 * Merge items with PLU DAV1015###PRNT as DAV1015 for display purposes.
 * These are provided as Bundle items, but are in fact the same item.
 * The ###PRNT should not be seen as new items or separate inventory.
 * When added to the basket, the customer just sees the main item.
 */

export function getDisplayPlu(plu?: string): string {
  if (!plu) return '';
  return plu.replace(/###PRNT$/i, '').trim();
}

export function isBundlePrintAlias(plu?: string): boolean {
  if (!plu) return false;
  return /###PRNT$/i.test(plu);
}

export function getCleanItemName(name?: string, plu?: string): string {
  const raw = name || plu || 'Item';
  return raw.replace(/###PRNT/gi, '').trim();
}
