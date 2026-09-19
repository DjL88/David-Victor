import {
  Basket,
  BasketItem,
  Money,
  toMoney,
  Address,
  DeliveryOption,
  DeliverySlot,
  HostedPaymentSession,
  Order,
  FulfillmentSchedulingType,
} from '../../src/commerce/models';

export class BasketService {
  private static instance: BasketService;
  private baskets = new Map<string, Basket>();
  private orders = new Map<string, Order>();

  static getInstance(): BasketService {
    if (!BasketService.instance) {
      BasketService.instance = new BasketService();
    }
    return BasketService.instance;
  }

  async createBasket(
    storeId: string = 'store-01',
    fulfillmentType: 'delivery' | 'pickup' = 'delivery',
    currency: string = 'GBP'
  ): Promise<Basket> {
    const id = `bsk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const basket: Basket = {
      id,
      storeId,
      storeName: storeId === 'store-02' ? 'Market Lane Artisan Provisions' : 'Chelmsford Flagship Superstore',
      channelLinkId: storeId,
      fulfillmentType,
      items: [],
      subtotal: toMoney(0, currency),
      total: toMoney(fulfillmentType === 'delivery' ? 250 : 0, currency),
      discounts: [],
      charges: fulfillmentType === 'delivery' ? [
        {
          id: 'delivery-fee',
          type: 'deliveryFee',
          title: 'Standard Delivery',
          amount: toMoney(250, currency),
        }
      ] : [],
      restrictions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.baskets.set(id, basket);
    return basket;
  }

  async getBasket(basketId: string): Promise<Basket | null> {
    return this.baskets.get(basketId) || null;
  }

  async updateBasketItem(basketId: string, plu: string, quantity: number): Promise<Basket> {
    let basket = this.baskets.get(basketId);
    if (!basket) {
      basket = await this.createBasket('store-01', 'delivery');
    }

    const existingIndex = basket.items.findIndex((item) => item.plu === plu || item.id === plu);

    if (quantity <= 0) {
      if (existingIndex >= 0) {
        basket.items.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      basket.items[existingIndex].quantity = quantity;
      basket.items[existingIndex].totalPrice = toMoney(
        basket.items[existingIndex].price.amountMinor * quantity,
        basket.items[existingIndex].price.currency
      );
    } else {
      const defaultPrice = toMoney(350, basket.subtotal.currency);
      basket.items.push({
        id: `item_${Date.now()}_${plu}`,
        plu,
        name: `Product ${plu}`,
        quantity,
        price: defaultPrice,
        unitPrice: defaultPrice,
        totalPrice: toMoney(defaultPrice.amountMinor * quantity, defaultPrice.currency),
      });
    }

    this.recalculateBasket(basket);
    return basket;
  }

  async updateBasketItems(
    basketId: string,
    items: Array<{
      plu: string;
      quantity: number;
      menuId?: string;
      substitutionPreference?: any;
      substituteCandidatePlus?: string[];
      preferredSubstitutePlu?: string;
      preferredSubstituteName?: string;
      preferredSubstitutePrice?: Money;
      isCombo?: boolean;
      bundleId?: string;
      bundlePlu?: string;
      bundleName?: string;
      subItems?: any[];
      name?: string;
      price?: Money;
    }>
  ): Promise<Basket> {
    let basket = this.baskets.get(basketId);
    if (!basket) {
      basket = await this.createBasket('store-01', 'delivery');
    }

    for (const incoming of items) {
      const existingIndex = basket.items.findIndex(
        (i) => i.plu === incoming.plu || (incoming.bundleId && i.bundleId === incoming.bundleId)
      );

      if (incoming.quantity <= 0) {
        if (existingIndex >= 0) {
          basket.items.splice(existingIndex, 1);
        }
      } else if (existingIndex >= 0) {
        const item = basket.items[existingIndex];
        item.quantity = incoming.quantity;
        if (incoming.substitutionPreference) item.substitutionPreference = incoming.substitutionPreference;
        if (incoming.preferredSubstitutePlu) item.preferredSubstitutePlu = incoming.preferredSubstitutePlu;
        if (incoming.subItems) item.subItems = incoming.subItems;
        item.totalPrice = toMoney(item.price.amountMinor * item.quantity, item.price.currency);
      } else {
        const price = incoming.price || toMoney(450, basket.subtotal.currency);
        basket.items.push({
          id: `item_${Date.now()}_${incoming.plu}`,
          plu: incoming.plu,
          name: incoming.name || incoming.bundleName || `Product ${incoming.plu}`,
          quantity: incoming.quantity,
          price,
          unitPrice: price,
          totalPrice: toMoney(price.amountMinor * incoming.quantity, price.currency),
          substitutionPreference: incoming.substitutionPreference,
          substituteCandidatePlus: incoming.substituteCandidatePlus,
          preferredSubstitutePlu: incoming.preferredSubstitutePlu,
          preferredSubstituteName: incoming.preferredSubstituteName,
          preferredSubstitutePrice: incoming.preferredSubstitutePrice,
          isCombo: incoming.isCombo,
          bundleId: incoming.bundleId,
          bundlePlu: incoming.bundlePlu,
          bundleName: incoming.bundleName,
          subItems: incoming.subItems,
        });
      }
    }

    this.recalculateBasket(basket);
    return basket;
  }

  async updateBasketCustomer(
    basketId: string,
    customer: { name?: string; email?: string; phone?: string; companyName?: string; notes?: string }
  ): Promise<Basket> {
    const basket = await this.getBasket(basketId);
    if (!basket) throw new Error(`Basket ${basketId} not found`);
    basket.customer = { ...basket.customer, ...customer };
    basket.updatedAt = new Date().toISOString();
    return basket;
  }

  async updateBasketFulfillment(
    basketId: string,
    fulfillment: {
      fulfillmentType?: 'delivery' | 'pickup';
      type?: 'delivery' | 'pickup';
      address?: Address;
      slot?: DeliverySlot;
      slotId?: string;
    }
  ): Promise<Basket> {
    const basket = await this.getBasket(basketId);
    if (!basket) throw new Error(`Basket ${basketId} not found`);

    if (fulfillment.fulfillmentType || fulfillment.type) {
      basket.fulfillmentType = fulfillment.fulfillmentType || fulfillment.type!;
    }
    if (fulfillment.address) {
      basket.deliveryAddress = fulfillment.address;
    }
    if (fulfillment.slot) {
      basket.slot = fulfillment.slot;
    }

    this.recalculateBasket(basket);
    return basket;
  }

  async updateBasketStore(
    basketId: string,
    storeId: string,
    _options?: { confirmMigration?: boolean }
  ): Promise<{ basket: Basket; storeSwitchDiff: any }> {
    const basket = await this.getBasket(basketId);
    if (!basket) throw new Error(`Basket ${basketId} not found`);

    basket.storeId = storeId;
    basket.storeName = storeId === 'store-02' ? 'Market Lane Artisan Provisions' : 'Chelmsford Flagship Superstore';
    basket.channelLinkId = storeId;
    this.recalculateBasket(basket);

    return {
      basket,
      storeSwitchDiff: {
        retainedCount: basket.items.length,
        removedCount: 0,
        priceChangedCount: 0,
      },
    };
  }

  async updateDiscounts(
    basketId: string,
    options: { code?: string; remove?: boolean; discounts?: any[] }
  ): Promise<Basket> {
    const basket = await this.getBasket(basketId);
    if (!basket) throw new Error(`Basket ${basketId} not found`);

    if (options.remove) {
      basket.discounts = [];
    } else if (options.code) {
      const discountMinor = 300;
      basket.discounts = [
        {
          code: options.code.toUpperCase(),
          title: `Promo ${options.code.toUpperCase()}`,
          amount: toMoney(discountMinor, basket.subtotal.currency),
        },
      ];
    } else if (options.discounts) {
      basket.discounts = options.discounts;
    }

    this.recalculateBasket(basket);
    return basket;
  }

  async updateCharges(basketId: string, charges: any[]): Promise<Basket> {
    const basket = await this.getBasket(basketId);
    if (!basket) throw new Error(`Basket ${basketId} not found`);
    basket.charges = charges;
    this.recalculateBasket(basket);
    return basket;
  }

  async updateTip(basketId: string, tip: Money): Promise<Basket> {
    const basket = await this.getBasket(basketId);
    if (!basket) throw new Error(`Basket ${basketId} not found`);
    basket.tip = tip;
    this.recalculateBasket(basket);
    return basket;
  }

  async validateBasket(basketId: string): Promise<{ valid: boolean; issues: string[]; errors?: any[] }> {
    const basket = await this.getBasket(basketId);
    if (!basket) return { valid: false, issues: ['Basket not found'] };
    return { valid: true, issues: [] };
  }

  async reconcileBasket(
    basketId: string,
    destinationStoreId?: string
  ): Promise<{
    reconciled: boolean;
    basket: Basket;
    changes: any[];
  }> {
    const basket = await this.getBasket(basketId);
    if (!basket) throw new Error(`Basket ${basketId} not found`);

    if (destinationStoreId && destinationStoreId !== basket.storeId) {
      basket.storeId = destinationStoreId;
    }

    this.recalculateBasket(basket);
    return {
      reconciled: true,
      basket,
      changes: [],
    };
  }

  async getDeliveryOptions(
    _basketId: string,
    _address: Address,
    fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<DeliveryOption[]> {
    if (fulfillmentType === 'pickup') {
      return [
        {
          id: 'opt_pickup_free',
          title: 'Store Collection',
          price: toMoney(0, 'GBP'),
          estimatedMinutes: 20,
          type: 'pickup',
          isDefault: true,
        },
      ];
    }

    return [
      {
        id: 'opt_delivery_standard',
        title: 'Priority Courier Delivery',
        price: toMoney(250, 'GBP'),
        estimatedMinutes: 35,
        type: 'delivery',
        isDefault: true,
      },
      {
        id: 'opt_delivery_express',
        title: 'Rush Ultra-Fast Delivery',
        price: toMoney(499, 'GBP'),
        estimatedMinutes: 20,
        type: 'delivery',
        isDefault: false,
      },
    ];
  }

  async getAvailableSlots(
    _storeId: string,
    _fulfillmentType?: 'delivery' | 'pickup'
  ): Promise<{
    asapAvailable: boolean;
    asapEtaMinutes?: number;
    days: Array<{ dayLabel: string; dateString: string; slots: DeliverySlot[] }>;
    nextAvailableSlot?: DeliverySlot;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const slot1: DeliverySlot = {
      id: `slot_${today}_asap`,
      startTime: '10:00',
      endTime: '11:00',
      date: today,
      isAvailable: true,
      price: toMoney(250, 'GBP'),
      formattedTime: 'Today, 10:00 - 11:00',
    };
    const slot2: DeliverySlot = {
      id: `slot_${today}_noon`,
      startTime: '12:00',
      endTime: '13:00',
      date: today,
      isAvailable: true,
      price: toMoney(199, 'GBP'),
      formattedTime: 'Today, 12:00 - 13:00',
    };

    return {
      asapAvailable: true,
      asapEtaMinutes: 30,
      days: [
        {
          dayLabel: 'Today',
          dateString: today,
          slots: [slot1, slot2],
        },
      ],
      nextAvailableSlot: slot1,
    };
  }

  async createPaymentSession(
    basketId: string,
    amount?: Money,
    currency?: string
  ): Promise<HostedPaymentSession> {
    const basket = await this.getBasket(basketId);
    const sessionAmount = amount || (basket ? basket.total : toMoney(1000, currency || 'GBP'));
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    return {
      id: sessionId,
      sessionId,
      clientSecret: `secret_${sessionId}`,
      publishableKey: 'pk_live_dpay_sample_key',
      amount: sessionAmount,
      currency: sessionAmount.currency,
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      redirectUrl: `/orders/confirm?sessionId=${sessionId}`,
    };
  }

  async checkoutBasket(
    basketId: string,
    options?: {
      deliveryOptionId?: string;
      slotId?: string;
      schedulingType?: FulfillmentSchedulingType;
      paymentTokenRef?: string;
      authorizationMaximum?: Money;
      customerNotes?: string;
      deliveryAddress?: Address;
      dispatchValidationId?: string;
      dispatchValidationExpiresAt?: string;
    }
  ): Promise<Order> {
    const basket = await this.getBasket(basketId);
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const currency = basket?.subtotal.currency || 'GBP';

    const order: Order = {
      id: orderId,
      orderNumber: `BW-${Math.floor(100000 + Math.random() * 900000)}`,
      storeId: basket?.storeId || 'store-01',
      storeName: basket?.storeName || 'Chelmsford Flagship Superstore',
      status: 'SUBMITTED',
      fulfillmentType: basket?.fulfillmentType || 'delivery',
      deliveryAddress: options?.deliveryAddress || basket?.deliveryAddress,
      customer: basket?.customer || { name: 'Customer', email: 'guest@example.com' },
      items: basket ? [...basket.items] : [],
      subtotal: basket?.subtotal || toMoney(0, currency),
      total: basket?.total || toMoney(0, currency),
      charges: basket?.charges || [],
      discounts: basket?.discounts || [],
      tip: basket?.tip,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slot: basket?.slot,
    };

    this.orders.set(orderId, order);
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orders.get(orderId) || null;
  }

  async advancePickingDemo(orderId: string): Promise<Order | null> {
    const order = this.orders.get(orderId);
    if (!order) return null;

    if (order.status === 'SUBMITTED') order.status = 'ACCEPTED';
    else if (order.status === 'ACCEPTED') order.status = 'PICKING';
    else if (order.status === 'PICKING') order.status = 'PICKED';
    else if (order.status === 'PICKED') order.status = 'IN_TRANSIT';
    else if (order.status === 'IN_TRANSIT') order.status = 'DELIVERED';

    order.updatedAt = new Date().toISOString();
    return order;
  }

  private recalculateBasket(basket: Basket): void {
    const currency = basket.subtotal?.currency || 'GBP';
    let subtotalMinor = 0;

    for (const item of basket.items) {
      const itemTotalMinor = (item.price?.amountMinor || 0) * (item.quantity || 1);
      item.totalPrice = toMoney(itemTotalMinor, currency);
      subtotalMinor += itemTotalMinor;
    }

    basket.subtotal = toMoney(subtotalMinor, currency);

    let chargesMinor = 0;
    if (basket.charges && basket.charges.length > 0) {
      for (const charge of basket.charges) {
        chargesMinor += charge.amount?.amountMinor || 0;
      }
    } else if (basket.fulfillmentType === 'delivery') {
      chargesMinor = 250;
      basket.charges = [
        {
          id: 'delivery-fee',
          type: 'deliveryFee',
          title: 'Standard Delivery',
          amount: toMoney(250, currency),
        },
      ];
    }

    let discountsMinor = 0;
    if (basket.discounts) {
      for (const disc of basket.discounts) {
        discountsMinor += disc.amount?.amountMinor || 0;
      }
    }

    const tipMinor = basket.tip?.amountMinor || 0;
    const totalMinor = Math.max(0, subtotalMinor + chargesMinor + tipMinor - discountsMinor);

    basket.total = toMoney(totalMinor, currency);
    basket.updatedAt = new Date().toISOString();
  }
}

export const defaultBasketService = BasketService.getInstance();
