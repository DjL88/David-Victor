/**
 * Deterministic Retail/Quest order contract projector.
 *
 * Pure on purpose: certification tests can prove the exact Channel API payload
 * without credentials, network calls, clocks or Firestore.
 */
import { buildQuestItemUnavailableActions } from './DeliverectBasketMapper';

export interface RetailQuestContractInput {
  channelOrderId: string;
  channelOrderDisplayId: string;
  fulfillmentType: 'pickup' | 'delivery';
  fulfillmentTime?: string;
  totalMinor: number;
  hasOnlineAuthorization: boolean;
  customerNotes?: string;
  dispatchValidationId?: string;
  customer?: { name?: string; email?: string; phone?: string; companyName?: string };
  deliveryAddress?: {
    street?: string; line1?: string; formattedAddress?: string;
    postalCode?: string; postcode?: string; city?: string; country?: string;
    latitude?: number; longitude?: number;
  };
  items: Array<{
    plu: string; name?: string; quantity: number; unitPriceMinor: number; note?: string;
    substitutionPreference?: string;
    itemUnavailableActions?: string[];
    deliverectUnavailableActions?: string[];
    preferredSubstitutePlu?: string;
    preferredSubstituteName?: string;
    preferredSubstitutePriceMinor?: number;
  }>;
}

export function projectRetailQuestOrder(input: RetailQuestContractInput): any {
  if (!input.channelOrderId || !input.channelOrderDisplayId) throw new Error('Retail order references are required.');
  if (!Number.isInteger(input.totalMinor) || input.totalMinor < 0) throw new Error('Retail order total must be non-negative minor units.');
  const scheduled = input.fulfillmentTime ? new Date(input.fulfillmentTime) : undefined;
  if (scheduled && Number.isNaN(scheduled.getTime())) throw new Error('Retail fulfillmentTime must be ISO-compatible.');
  if (input.fulfillmentType === 'delivery' && !input.deliveryAddress) throw new Error('Retail delivery requires an address.');

  const items = input.items.map((item) => {
    if (!item.plu || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.unitPriceMinor) || item.unitPriceMinor < 0) {
      throw new Error('Retail item requires PLU, positive integer quantity and non-negative integer unit price.');
    }
    const preference = item.substitutionPreference || 'BEST_MATCH';
    const actions = item.itemUnavailableActions?.length
      ? item.itemUnavailableActions
      : item.deliverectUnavailableActions?.length
        ? item.deliverectUnavailableActions
        : buildQuestItemUnavailableActions(preference);
    return {
      plu: item.plu,
      name: item.name || item.plu,
      price: item.unitPriceMinor,
      quantity: item.quantity,
      ...(item.note ? { remark: item.note } : {}),
      itemUnavailableActions: actions,
      // Match the proven Snappy Retail order shape. Customer-selected choices
      // are deliberately served by our substitutions callback instead of the
      // unsupported ITEM_SUBSTITUTION_CUSTOMER order action.
      subItems: [],
    };
  });

  const payload: any = {
    channelOrderId: input.channelOrderId,
    channelOrderDisplayId: input.channelOrderDisplayId,
    orderType: input.fulfillmentType === 'delivery' ? 2 : 1,
    deliveryIsAsap: !input.fulfillmentTime,
    ...(input.fulfillmentTime
      ? input.fulfillmentType === 'delivery'
        ? { deliveryTime: new Date(input.fulfillmentTime).toISOString() }
        : { pickupTime: new Date(input.fulfillmentTime).toISOString() }
      : {}),
    courier: 'restaurant',
    decimalDigits: 2,
    payment: {
      amount: input.totalMinor,
      type: 0,
      due: input.hasOnlineAuthorization ? 0 : input.totalMinor,
      rebate: 0,
    },
    items,
    orderIsAlreadyPaid: input.hasOnlineAuthorization,
    ...(input.customerNotes ? { note: input.customerNotes } : {}),
    ...(input.customer ? { customer: {
      name: input.customer.name,
      email: input.customer.email,
      phoneNumber: input.customer.phone,
      companyName: input.customer.companyName,
    }} : {}),
    ...(input.dispatchValidationId ? { validationId: input.dispatchValidationId } : {}),
  };

  if (input.fulfillmentType === 'delivery') {
    const a = input.deliveryAddress!;
    payload.deliveryAddress = {
      street: a.street || a.line1 || a.formattedAddress,
      postalCode: a.postalCode || a.postcode,
      city: a.city,
      country: a.country,
      ...(typeof a.latitude === 'number' && typeof a.longitude === 'number'
        ? { coordinates: [{ latitude: a.latitude, longitude: a.longitude }] }
        : {}),
    };
  }
  return payload;
}
