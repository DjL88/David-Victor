/**
 * Grocery-specific post-checkout lifecycle models.
 * Separates Basket from Order and models payment tokenization/authorization,
 * Quest picking lifecycle, substitution preferences & pricing policies,
 * fulfillment scheduling, and multi-option courier dispatch.
 */

import { Basket, Address, Store, Product, BasketItem, CourierInfo, Money, toMoney, moneyFromMajor, moneyToMajor, moneyToMinor } from './models';

// ==========================================
// 1. PAYMENT STATE MODEL
// ==========================================

export type PaymentStateStatus =
  | 'TOKEN_REQUIRED'
  | 'TOKENIZED'
  | 'AUTHORIZING'
  | 'AUTHORIZED'
  | 'REAUTHORIZING'
  | 'CAPTURE_PENDING'
  | 'CAPTURED'
  | 'REFUSED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RELEASED'
  | 'PAYMENT_ACTION_REQUIRED';

export interface OrderPaymentInfo {
  paymentId: string;
  paymentTokenReference?: string;
  state: PaymentStateStatus;
  currency: string;
  authorizedAmount: Money;
  authorizationMaximum: Money;
  finalAmount: Money;
  capturedAmount: Money;
  releasedAmount?: Money;
  method?: string; // e.g., 'Deliverect Pay • Apple Pay / Visa **** 4242'
  history: Array<{
    state: PaymentStateStatus;
    timestamp: string;
    amount?: Money;
    note?: string;
  }>;
  refusalReason?: string;
  failureReason?: string;
}

// ==========================================
// 2. SUBSTITUTION PRICING & PREFERENCES
// ==========================================

export type SubstitutionPricePolicy =
  | 'LOWER_OF_ORIGINAL_AND_SUBSTITUTE'
  | 'SUBSTITUTE_PRICE'
  | 'ORIGINAL_PRICE'
  | 'CUSTOM_RULE';

export type SubstitutionPreferenceType =
  | 'BEST_MATCH'
  | 'CUSTOMER_SELECTED'
  | 'REMOVE_IF_UNAVAILABLE'
  | 'CANCEL_ORDER_IF_UNAVAILABLE'
  | 'DO_NOT_SUBSTITUTE';

/**
 * Calculates the customer-approved authorization maximum.
 * ARCHITECTURAL RULE:
 * authorizationMaximum must be derived strictly from customer-approved possible spend:
 * - Customer-selected substitute price differentials
 * - Configured catch-weight tolerance where applicable
 * - Authoritative known fees
 * BEST_MATCH with lower-price guarantee requires NO arbitrary price uplift (buffer rate defaults to 0).
 * Payment reauthorization occurs when: final payable amount > currently authorized amount.
 */
export function calculateAuthorizationMaximum(
  basketTotal: Money,
  substitutionsAllowed: boolean = true,
  catchWeightOrPolicyBufferPercentage: number = 0,
  currency: string = 'GBP',
  extraPreChosenBuffer?: Money
): {
  authorizationMaximum: Money;
  bufferAmount: Money;
  baseBufferAmount?: Money;
  extraPreChosenBufferAmount?: Money;
} {
  const totalAmountPence = moneyToMinor(basketTotal);
  const totalCurr = basketTotal?.currency || currency;
  const total = toMoney(totalAmountPence, totalCurr);
  const extraBufferPence = extraPreChosenBuffer != null ? moneyToMinor(extraPreChosenBuffer) : 0;
  
  if (!substitutionsAllowed && catchWeightOrPolicyBufferPercentage <= 0) {
    const authorizationMaximum = toMoney(total.amount + extraBufferPence, total.currency);
    return {
      authorizationMaximum,
      bufferAmount: toMoney(extraBufferPence, total.currency),
      baseBufferAmount: toMoney(0, total.currency),
      extraPreChosenBufferAmount: toMoney(extraBufferPence, total.currency),
    };
  }

  const baseBufferPence = Math.round(total.amount * Math.max(0, catchWeightOrPolicyBufferPercentage));
  const totalBufferPence = baseBufferPence + extraBufferPence;
  const bufferAmount = toMoney(totalBufferPence, total.currency);
  const authorizationMaximum = toMoney(total.amount + totalBufferPence, total.currency);

  return {
    authorizationMaximum,
    bufferAmount,
    baseBufferAmount: toMoney(baseBufferPence, total.currency),
    extraPreChosenBufferAmount: toMoney(extraBufferPence, total.currency),
  };
}

/**
 * Metadata mapping for Deliverect Retail / Quest API mappings
 */
export type DeliverectSubstitutionMapping =
  | 'ITEM_SUBSTITUTION'
  | 'ITEM_SUBSTITUTION_CATALOG'
  | 'ITEM_SUBSTITUTION_CUSTOMER'
  | 'ITEM_REMOVE'
  | 'CANCEL_ORDER'
  | 'ITEM_AMENDMENT';

export interface ItemSubstitutionConfig {
  preference: SubstitutionPreferenceType;
  substituteCandidatePlus?: string[];
  substituteCandidates?: Product[];
  deliverectMapping?: DeliverectSubstitutionMapping;
}

export interface TenantSubstitutionPolicy {
  enabled: boolean;
  allowBestMatch: boolean;
  allowCustomerSelected: boolean;
  defaultPreference: SubstitutionPreferenceType;
  bestMatchPricePolicy: SubstitutionPricePolicy;
  customerSelectedPricePolicy: SubstitutionPricePolicy;
  maxCustomerCandidates: number;
  allowCancelOrderPreference: boolean;
  defaultBufferPercentage?: number;
}

// ==========================================
// 3. QUEST PICKING MODEL
// ==========================================

export type PickingItemState =
  | 'PENDING'
  | 'PICKED'
  | 'QUANTITY_AMENDED'
  | 'SUBSTITUTED'
  | 'REMOVED';

export interface PickingSubstitution {
  type: 'BEST_MATCH' | 'CUSTOMER_SELECTED';
  originalPlu: string;
  originalName: string;
  originalPrice: Money;
  substitutePlu: string;
  substituteName: string;
  substitutePrice: Money;
  chargedPrice: Money; // calculated via tenant substitution pricing policy
  reason?: string;
}

export interface PickingAmendment {
  originalQuantity: number;
  suppliedQuantity: number;
  reason?: string;
}

export interface PickingItem {
  id: string;
  plu: string;
  name: string;
  imageUrl?: string;
  originalQuantity: number;
  pickedQuantity: number;
  originalPrice: Money;
  finalPrice: Money;
  state: PickingItemState;
  substitutionPreference?: SubstitutionPreferenceType;
  preferredSubstitutePlu?: string;
  preferredSubstituteName?: string;
  substitution?: PickingSubstitution;
  amendment?: PickingAmendment;
  unit?: string;
}

export interface PickingState {
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startedAt?: string;
  completedAt?: string;
  totalItems: number;
  itemsPicked: number;
  hasChanges: boolean;
  items: PickingItem[];
}

export type PickingEventType =
  | 'ORDER_ACCEPTED'
  | 'PICKING_STARTED'
  | 'ITEM_PICKED'
  | 'QUANTITY_REDUCED'
  | 'ITEM_REMOVED'
  | 'BEST_MATCH_SUBSTITUTION'
  | 'CUSTOMER_SELECTED_SUBSTITUTION'
  | 'ORDER_CANCELLED_UNAVAILABLE_ITEM'
  | 'PICKING_COMPLETED';

export interface PickingEvent {
  id: string;
  sequence: number;
  type: PickingEventType;
  payload: any;
  timestamp: string;
}

// ==========================================
// 4. DELIVERY OPTIONS & DISPATCH SCHEDULING
// ==========================================

export interface DeliveryOption {
  id: string;
  providerId?: string;
  providerName?: string;
  displayName: string;
  price: Money;
  pickupEta?: string;
  deliveryEta?: string;
  validationId?: string;
  dispatchValidationId?: string;
  expiresAt?: string;
  recommended?: boolean;
  recommendationReason?: string; // e.g., 'FASTEST' | 'BEST VALUE'
}

export type DispatchSchedulingMode =
  | 'RESERVE_AT_ORDER'
  | 'ASSIGN_NEAR_FULFILMENT';

export interface OrderDeliveryInfo {
  deliveryOption: DeliveryOption;
  dispatchSchedulingMode: DispatchSchedulingMode;
  courier?: {
    name?: string;
    phone?: string;
    eta?: string;
    currentCoordinates?: { latitude: number; longitude: number };
    vehicleType?: string;
  };
  trackingUrl?: string;
  isConfirmed: boolean;
  provisionalNotice?: string;
}

// ==========================================
// 4.1 DISPATCH STATE MACHINE
// ==========================================

export type DispatchState =
  | 'NOT_REQUESTED'
  | 'QUOTED'
  | 'SCHEDULED'
  | 'ASSIGNING'
  | 'ASSIGNED'
  | 'PICKUP_EN_ROUTE'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'FAILED';

export interface DispatchPinRequirement {
  required: boolean;
  instruction: string; // Customer-safe instructions only! Never plaintext secret PIN
  status: 'PENDING' | 'VERIFIED';
}

export interface DispatchAgeVerificationRequirement {
  required: boolean;
  minimumAge?: number;
  status: 'NOT_REQUIRED' | 'PENDING_COURIER_CHECK' | 'VERIFIED' | 'FAILED';
  instruction?: string;
}

export interface DispatchTimestamps {
  quotedAt?: string;
  scheduledAt?: string;
  assignedAt?: string;
  pickupEnRouteAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  failedAt?: string;
  updatedAt: string;
}

export interface DispatchStateRecord {
  state: DispatchState;
  providerId: string;
  providerDisplayName: string;
  quoteId?: string;
  deliveryJobId?: string;
  eta?: string;
  etaMinutes?: number;
  trackingUrl?: string;
  proofOfDeliveryUrl?: string;
  pinRequirement?: DispatchPinRequirement;
  ageVerificationRequirement?: DispatchAgeVerificationRequirement;
  attemptCount: number;
  lastError?: string;
  idempotencyKeys: string[];
  timestamps: DispatchTimestamps;
  scheduledFor?: string;
  targetPickupTime?: string;
  createdAt: string;
}

// ==========================================
// 5. FULFILLMENT SCHEDULING & SLOTS
// ==========================================

export type FulfillmentSchedulingType = 'ASAP' | 'SCHEDULED';

export interface SchedulingPolicy {
  enabled: boolean;
  acceptsAsapOrders: boolean;
  acceptsPreOrders: boolean;
  acceptsSameDayPreOrders: boolean;
  minimumLeadTimeMinutes: number;
  maximumDaysInAdvance: number;
  slotLengthMinutes: number;
  capacityPerSlot?: number;
  allowOrderingWhileClosed: boolean;
}

export interface DeliverySlot {
  id: string;
  dayLabel: string; // 'Today', 'Tomorrow', 'Wed 18 Sep'
  dateString: string; // 'YYYY-MM-DD'
  startTime: string; // '16:00'
  endTime: string; // '16:30'
  formatted: string; // '16:00 – 16:30'
  isAvailable: boolean;
  availableCapacity?: number;
  isEmphasized?: boolean;
  fee?: Money; // Optional authoritative slot fee
}

// ==========================================
// 6. ORDER AGGREGATE
// ==========================================

export type CustomerOrderStatus =
  | 'CHECKOUT_SUBMITTING'
  | 'CHECKOUT_PENDING_CONFIRMATION'
  | 'SUBMITTED'
  | 'ORDER_CONFIRMED'
  | 'CONFIRMED'
  | 'STORE_ACCEPTED'
  | 'ACCEPTED'
  | 'PICKING'
  | 'PICKING_STARTED'
  | 'PICKING_WITH_CHANGES'
  | 'PICKED'
  | 'PICKING_COMPLETE'
  | 'READY'
  | 'READY_FOR_PICKUP'
  | 'PAYMENT_FINALISING'
  | 'READY_FOR_COURIER'
  | 'COURIER_ASSIGNED'
  | 'DISPATCHING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'ORDER_CANCELLED'
  | 'ORDER_CANCELLED_UNAVAILABLE_ITEM'
  | 'FAILED'
  | 'AWAITING_PAYMENT_ACTION'
  // Legacy checkout tracking statuses:
  | 'orderAccepted'
  | 'preparing'
  | 'readyForPickup'
  | 'courierAssigned'
  | 'courierAtStore'
  | 'outForDelivery'
  | 'delivered'
  | 'cancelled';

export interface OrderSnapshot {
  subtotal: Money;
  charges: Array<{ id: string; title: string; amount: Money; type: string }>;
  discounts: Array<{ id?: string; code: string; title: string; amount: Money }>;
  depositTotal?: Money;
  bagFee?: Money;
  serviceCharge?: Money;
  deliveryCharge?: Money;
  tip?: Money;
  total: Money;
  itemCount: number;
}

export interface OrderEvent {
  id: string;
  timestamp: string;
  status: CustomerOrderStatus;
  title: string;
  description?: string;
  note?: string;
}

export interface Order {
  id: string;
  displayId: string; // e.g. '#ORD-84920'
  orderReference?: string;
  tenantId: string;
  storeId: string;
  storeName: string;
  status: CustomerOrderStatus;
  statusHistory?: Array<{ status: CustomerOrderStatus; timestamp: string }>;
  fulfillment: {
    type: 'delivery' | 'pickup';
    address?: Address;
    deliveryOption?: DeliveryOption;
    schedulingMode?: DispatchSchedulingMode;
    scheduledSlot?: DeliverySlot;
  };
  scheduledTime: {
    type: FulfillmentSchedulingType;
    slot?: DeliverySlot;
    asapEtaMinutes?: number;
    requestedAt: string;
  };
  originalBasket: Basket;
  currentOrder: OrderSnapshot;
  finalOrder?: OrderSnapshot;
  payment: OrderPaymentInfo;
  paymentSummary?: {
    method: string;
    totalPaid: number;
    transactionRef: string;
    currency: string;
  };
  picking: PickingState;
  delivery?: OrderDeliveryInfo;
  dispatch?: DispatchStateRecord;
  events: OrderEvent[];
  createdAt: string;
  updatedAt: string;

  // Backwards compatibility fields for existing checkout status tracking
  basket?: Basket;
  items?: BasketItem[];
  deliveryAddress?: Address;
  courier?: CourierInfo;
  orderAcceptedAt?: string;
}

export type DemoScenario = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
