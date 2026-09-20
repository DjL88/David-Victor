import { beforeEach, describe, expect, it } from 'vitest';
import { BasketService } from '../../server/basket/BasketService';
import { moneyToMinor, toMoney } from '../commerce/models';

describe('basket truth and reconciliation', () => {
  let service: BasketService;

  beforeEach(() => {
    service = new BasketService();
  });

  it('adds, increments, decrements and removes an authoritative item', async () => {
    const basket = await service.createBasket('store-a', 'pickup', 'GBP');
    let updated = await service.updateBasketItem(basket.id, 'COKE', 1, { name: 'Coke', price: toMoney(200, 'GBP') });
    expect(updated.items[0]).toMatchObject({ plu: 'COKE', quantity: 1 });
    expect(moneyToMinor(updated.items[0].price)).toBe(200);

    updated = await service.updateBasketItem(basket.id, 'COKE', 2);
    expect(updated.items[0].quantity).toBe(2);
    updated = await service.updateBasketItem(basket.id, 'COKE', 1);
    expect(updated.items[0].quantity).toBe(1);
    updated = await service.updateBasketItem(basket.id, 'COKE', 0);
    expect(updated.items).toHaveLength(0);
  });

  it('rejects an unknown PLU rather than inventing a £1 item', async () => {
    const basket = await service.createBasket('store-a', 'pickup', 'GBP');
    await expect(service.updateBasketItem(basket.id, 'UNKNOWN', 1)).rejects.toMatchObject({
      code: 'PRODUCT_NOT_AVAILABLE',
      statusCode: 409,
    });
    expect((await service.getBasket(basket.id))?.items).toHaveLength(0);
  });

  it('preserves unavailable lines and refreshes a different-store price', async () => {
    const basket = await service.createBasket('store-a', 'pickup', 'GBP');
    await service.updateBasketItem(basket.id, 'COKE', 1, { name: 'Coke', price: toMoney(200, 'GBP') });
    await service.updateBasketItem(basket.id, 'CRISPS', 1, { name: 'Crisps', price: toMoney(150, 'GBP') });

    const result = await service.reconcileBasket(basket.id, 'store-b', new Map([
      ['COKE', { name: 'Coke', price: toMoney(220, 'GBP'), available: true }],
      ['CRISPS', { name: 'Crisps', price: toMoney(150, 'GBP'), available: false }],
    ]));

    expect(result.basket.items).toHaveLength(2);
    expect(result.basket.items.find((item) => item.plu === 'COKE')?.availabilityState).toBe('PRICE_CHANGED');
    expect(moneyToMinor(result.basket.items.find((item) => item.plu === 'COKE')!.price)).toBe(220);
    expect(result.basket.items.find((item) => item.plu === 'CRISPS')?.availabilityState).toBe('UNAVAILABLE_AT_STORE');
  });

  it('marks an excessive requested quantity without deleting the line', async () => {
    const basket = await service.createBasket('store-a', 'pickup', 'GBP');
    await service.updateBasketItem(basket.id, 'COKE', 4, { name: 'Coke', price: toMoney(200, 'GBP') });
    const result = await service.reconcileBasket(basket.id, 'store-b', new Map([
      ['COKE', { name: 'Coke', price: toMoney(200, 'GBP'), available: true, maxQuantity: 2 }],
    ]));
    expect(result.basket.items[0].quantity).toBe(4);
    expect(result.basket.items[0].availabilityState).toBe('QUANTITY_UNAVAILABLE');
  });
});
