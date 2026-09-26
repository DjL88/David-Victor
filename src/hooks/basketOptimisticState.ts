export interface BasketQuantityItem {
  plu: string;
  quantity: number;
}

export function getDisplayedBasketQuantity(
  items: BasketQuantityItem[] | undefined,
  optimisticQuantities: Record<string, number>,
  plu: string
): number {
  const optimistic = optimisticQuantities[plu];
  if (optimistic !== undefined) return Math.max(0, optimistic);
  return Math.max(0, items?.find((item) => item.plu === plu)?.quantity || 0);
}

export function getDisplayedBasketItemCount(
  items: BasketQuantityItem[] | undefined,
  optimisticQuantities: Record<string, number>
): number {
  const quantities = new Map<string, number>();
  (items || []).forEach((item) => quantities.set(item.plu, Math.max(0, item.quantity)));
  Object.entries(optimisticQuantities).forEach(([plu, quantity]) => {
    quantities.set(plu, Math.max(0, quantity));
  });
  return Array.from(quantities.values()).reduce((sum, quantity) => sum + quantity, 0);
}
