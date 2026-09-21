import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Basket,
  Store,
  Address,
  Order,
  OrderTrackingStatus,
  CheckoutStatus,
  DeliverySlot,
  SubstitutionPreferenceType,
  calculateAuthorizationMaximum,
  calculatePreChosenAlternativeExtraBuffer,
  moneyToMajor,
} from '../../commerce/models';
import { useTenantStyles } from '../../tenant/useTenant';
import { formatCurrency } from '../../utils/formatters';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { defaultPaymentClient } from '../../commerce/PaymentClient';
import { useCatalog } from '../../hooks/useCatalog';
import { CheckoutRecommendations } from './CheckoutRecommendations';
import { ReverseDealPromptCard } from '../deals/ReverseDealPromptCard';
import { calculateReverseDeals } from '../../commerce/reverseDealEngine';
import { DeliverectDeal } from '../../commerce/dealModels';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { OrderTrackingView } from '../orders/OrderTrackingView';
import { ItemUnavailablePreferenceModal } from '../cart/ItemUnavailablePreferenceModal';
import { evaluateBasketSnoozeStatus } from '../../services/snoozeCheckService';
import { defaultAnalyticsClient, AnalyticsEventType } from '../../analytics';
import {
  X,
  MapPin,
  Store as StoreIcon,
  Truck,
  CreditCard,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Tag,
  Heart,
  ChevronRight,
  ChevronDown,
  Phone,
  Clock,
  ExternalLink,
  Package,
  ShoppingBag,
  Sliders,
  Calendar,
  Check,
  Repeat,
} from 'lucide-react';

const defaultCommerceClient = getCommerceClient() as any;

interface CheckoutModalProps {
  isOpen: boolean;
  basket: Basket | null;
  store: Store | null;
  deliveryAddress: Address;
  onClose: () => void;
  onOrderSuccess: (orderId: string) => void;
  onBasketUpdated?: (basket: Basket) => void;
  onStoreSwitched?: (newStoreId: string) => void;
  onOpenDealPopup?: (deal: DeliverectDeal) => void;
}

type CheckoutPhase =
  | 'review'
  | 'hosted_payment'
  | 'polling_status'
  | 'order_failed'
  | 'tracking';

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  basket: initialBasket,
  store: initialStore,
  deliveryAddress,
  onClose,
  onOrderSuccess,
  onBasketUpdated,
  onStoreSwitched,
  onOpenDealPopup,
}) => {
  const { primaryBtnStyle, currencySymbol, brandName } = useTenantStyles();

  // Local authoritative basket & store state
  const [basket, setBasket] = useState<Basket | null>(initialBasket);
  const [store, setStore] = useState<Store | null>(initialStore);
  const { products: storeProducts } = useCatalog(store?.id);
  const [phase, setPhase] = useState<CheckoutPhase>('review');

  // Confirmed Order Tracking
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [isAdvancingStatus, setIsAdvancingStatus] = useState<boolean>(false);

  // Revalidation state
  const [secondsRemaining, setSecondsRemaining] = useState<number>(180);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [revalidationError, setRevalidationError] = useState<string | null>(null);
  const [alternativeStores, setAlternativeStores] = useState<Store[]>([]);
  const [collectionEligible, setCollectionEligible] = useState<boolean>(true);

  // Tip & Promo
  const [tipAmount, setTipAmount] = useState<number>(basket?.tip ? moneyToMajor(basket.tip) : 0);
  const [promoCode, setPromoCode] = useState<string>('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoSuccess, setPromoSuccess] = useState<string | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState<boolean>(false);

  // Payment Session & Polling
  const [sessionId, setSessionId] = useState<string>('');
  const [hostedRedirectUrl, setHostedRedirectUrl] = useState<string>('');
  const [checkoutStatus, setCheckoutStatus] = useState<CheckoutStatus>('preparing_payment');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing payment session...');
  const [failureReason, setFailureReason] = useState<string>('');

  // QA Simulation Drawer Toggle
  const [showSimPanel, setShowSimPanel] = useState<boolean>(false);
  const [simDispatchExpired, setSimDispatchExpired] = useState<boolean>(false);
  const [simDispatchUnavailable, setSimDispatchUnavailable] = useState<boolean>(false);
  const [simPaymentFailure, setSimPaymentFailure] = useState<boolean>(false);

  // Grocery Scheduling & Substitution Preferences
  const [schedulingType, setSchedulingType] = useState<'ASAP' | 'SCHEDULED'>('ASAP');
  const [availableSlots, setAvailableSlots] = useState<DeliverySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<DeliverySlot | null>(null);
  const [showSubstitutions, setShowSubstitutions] = useState<boolean>(false);
  const [isAuthorizingDirect, setIsAuthorizingDirect] = useState<boolean>(false);

  // Reverse Deal Calculations across active checkout items
  const allCheckoutItems = useMemo(() => {
    return basket?.items || [];
  }, [basket?.items]);

  const checkoutDiscounts = useMemo(() => {
    return basket?.discounts || [];
  }, [basket?.discounts]);

  const reverseDealResults = useMemo(() => {
    return calculateReverseDeals(allCheckoutItems, storeProducts, undefined, checkoutDiscounts);
  }, [allCheckoutItems, storeProducts, checkoutDiscounts]);

  // Load available delivery / pickup slots
  useEffect(() => {
    if (!isOpen || !store || !basket) return;
    defaultCommerceClient
      .getAvailableSlots(store.id, basket.fulfillmentType)
      .then((res) => {
        const flatSlots = res.days.flatMap((d) => d.slots);
        setAvailableSlots(flatSlots);
        if (flatSlots.length > 0 && !selectedSlot) {
          setSelectedSlot(res.nextAvailableSlot || flatSlots[0]);
        }
      })
      .catch((err) => console.error('Failed to load slots', err));
  }, [isOpen, store?.id, basket?.fulfillmentType]);

  // Active item being customized with Deliveroo-style unavailable preference modal
  const [editingSubstitutionItem, setEditingSubstitutionItem] = useState<{
    item: any;
    storeId?: string;
  } | null>(null);

  // Deliveroo-style Pre-Authorisation buffer for higher-value pre-chosen substitutes
  const preChosenBufferInfo = useMemo(() => {
    return calculatePreChosenAlternativeExtraBuffer(
      basket?.items || [],
      basket?.currency || 'GBP'
    );
  }, [basket?.items, basket?.currency]);

  const handleUpdateItemSubstitution = async (
    plu: string,
    pref: SubstitutionPreferenceType,
    preferredSubstitutePlu?: string,
    preferredSubstituteName?: string,
    preferredSubstitutePrice?: number
  ) => {
    if (!basket) return;
    try {
      const updated = await defaultCommerceClient.setBasketItemSubstitution(
        basket.id,
        plu,
        pref,
        undefined,
        preferredSubstitutePlu,
        preferredSubstituteName,
        preferredSubstitutePrice
      );
      setBasket(updated);
      onBasketUpdated?.(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // Real-time evaluation of basket snooze and availability status on calculate checkout
  const snoozeAudit = useMemo(() => {
    return evaluateBasketSnoozeStatus(basket);
  }, [basket]);

  const [isSwapping, setIsSwapping] = useState(false);

  const handleSwapItem = async (originalPlu: string, substitutePlu: string) => {
    if (!basket) return;
    setIsSwapping(true);
    try {
      const origItem = basket.items.find((i) => i.plu === originalPlu);
      const qty = origItem ? origItem.quantity : 1;
      let updated = await defaultCommerceClient.removeBasketItem(basket.id, originalPlu);
      updated = await defaultCommerceClient.updateBasketItem(updated.id, substitutePlu, qty);
      setBasket(updated);
      onBasketUpdated?.(updated);
    } catch (err) {
      console.error('Failed to swap item in checkout:', err);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleSwapAllAvailableSubstitutes = async () => {
    if (!basket || !snoozeAudit.availableSwaps.length) return;
    setIsSwapping(true);
    try {
      let current = basket;
      for (const swap of snoozeAudit.availableSwaps) {
        current = await defaultCommerceClient.removeBasketItem(current.id, swap.originalPlu);
        current = await defaultCommerceClient.updateBasketItem(current.id, swap.substitutePlu, swap.quantity);
      }
      setBasket(current);
      onBasketUpdated?.(current);
    } catch (err) {
      console.error('Failed to swap all substitutes:', err);
    } finally {
      setIsSwapping(false);
    }
  };

  const handleRemoveUnavailableItem = async (plu: string) => {
    if (!basket) return;
    setIsSwapping(true);
    try {
      const updated = await defaultCommerceClient.removeBasketItem(basket.id, plu);
      setBasket(updated);
      onBasketUpdated?.(updated);
    } catch (err) {
      console.error('Failed to remove unavailable item:', err);
    } finally {
      setIsSwapping(false);
    }
  };

  // Revalidate Delivery function
  const handleRevalidateDelivery = useCallback(async () => {
    if (!basket) return;
    setIsRevalidating(true);
    setRevalidationError(null);
    setAlternativeStores([]);

    try {
      const result = await defaultCommerceClient.revalidateDelivery(
        basket.id,
        deliveryAddress
      );

      if (result.available) {
        const updated = await defaultCommerceClient.getBasket(basket.id);
        if (result.dispatchValidationId) {
          updated.dispatchValidationId = result.dispatchValidationId;
        }
        if (result.dispatchValidationExpiresAt) {
          updated.dispatchValidationExpiresAt = result.dispatchValidationExpiresAt;
        }
        setBasket(updated);
        onBasketUpdated?.(updated);
        setRevalidationError(null);
      } else {
        setRevalidationError(
          result.reason || 'Delivery quote expired or unavailable. No couriers available.'
        );
        if (result.alternativeStores) {
          setAlternativeStores(result.alternativeStores);
        }
        setCollectionEligible(result.collectionEligible ?? false);
      }
    } catch (err: any) {
      setRevalidationError(err.message || 'Failed to revalidate delivery');
    } finally {
      setIsRevalidating(false);
    }
  }, [basket, deliveryAddress, onBasketUpdated]);

  const handleDirectAuthorizeCheckout = async () => {
    if (snoozeAudit.hasSnoozedOrUnavailableItems) {
      setRevalidationError('Please swap or remove out-of-stock items before placing your order.');
      return;
    }

    if (!basket) return;

    // Authoritative check before payment pre-authorisation: never silently assume availability
    if (basket.fulfillmentType !== 'pickup') {
      setIsAuthorizingDirect(true);
      setRevalidationError(null);
      try {
        const quoteCheck = await defaultCommerceClient.revalidateDelivery(
          basket.id,
          deliveryAddress
        );
        if (!quoteCheck.available) {
          setRevalidationError(
            quoteCheck.reason ||
              'Courier dispatch is currently unavailable for this delivery location. Progression blocked. Please retry or choose collection.'
          );
          if (quoteCheck.alternativeStores) setAlternativeStores(quoteCheck.alternativeStores);
          setCollectionEligible(quoteCheck.collectionEligible ?? true);
          setIsAuthorizingDirect(false);
          return;
        }
        if (quoteCheck.dispatchValidationId) {
          basket.dispatchValidationId = quoteCheck.dispatchValidationId;
          basket.dispatchValidationExpiresAt = quoteCheck.dispatchValidationExpiresAt;
        }
      } catch (err: any) {
        setRevalidationError(
          `Unable to verify courier dispatch availability: ${err.message || 'Service unavailable'}. Please retry.`
        );
        setIsAuthorizingDirect(false);
        return;
      }
    }

    setIsAuthorizingDirect(true);
    setRevalidationError(null);

    try {
      const subPolicy = await defaultCommerceClient.getSubstitutionPolicy?.(basket.storeId);
      const policyBuffer = subPolicy?.defaultBufferPercentage ?? 0;
      const { authorizationMaximum } = calculateAuthorizationMaximum(
        basket.total,
        true,
        policyBuffer,
        basket.currency,
        preChosenBufferInfo.extraBufferAmount
      );
      const token = await defaultPaymentClient.createToken({
        type: 'CARD',
        cardholderName: 'Valued Customer',
        last4: '4242',
      });
      const order = await defaultCommerceClient.checkoutBasket(basket.id, {
        paymentTokenRef: token.token,
        authorizationMaximum,
        schedulingType,
        slotId: schedulingType === 'SCHEDULED' ? selectedSlot?.id : undefined,
        deliveryAddress,
        dispatchValidationId: basket.dispatchValidationId,
        dispatchValidationExpiresAt: basket.dispatchValidationExpiresAt,
      });
      setConfirmedOrder(order);
      defaultAnalyticsClient.track({
        type: AnalyticsEventType.ORDER_SUBMITTED,
        storeId: store?.id,
        orderReferenceHash: order.orderReference || order.id,
        properties: {
          totalAmount: order.pricing?.total?.amount ? order.pricing.total.amount / 100 : 0,
          currency: order.pricing?.total?.currency || 'GBP',
          itemCount: order.items?.length || 0,
          fulfillmentType: order.fulfillmentType || 'DELIVERY',
        },
      });
      onOrderSuccess(order.id);
      setPhase('tracking');
    } catch (err: any) {
      setRevalidationError(err.message || 'Payment authorization failed');
    } finally {
      setIsAuthorizingDirect(false);
    }
  };

  // Keep basket and store synced with props and track CHECKOUT_STARTED
  useEffect(() => {
    if (initialBasket) setBasket(initialBasket);
    if (initialStore) setStore(initialStore);
    if (isOpen) {
      defaultAnalyticsClient.track({
        type: AnalyticsEventType.CHECKOUT_STARTED,
        storeId: initialStore?.id || store?.id,
        properties: {
          itemCount: initialBasket?.items?.length || basket?.items?.length || 0,
          subtotalAmount: (initialBasket as any)?.pricing?.subtotal?.amount || initialBasket?.subtotal?.amount || basket?.subtotal?.amount || 0,
          currency: (initialBasket as any)?.pricing?.subtotal?.currency || initialBasket?.subtotal?.currency || initialBasket?.currency || basket?.currency || 'GBP',
        },
      });
    }
  }, [initialBasket, initialStore, isOpen]);

  // Dispatch countdown timer
  useEffect(() => {
    if (!isOpen || !basket?.dispatchValidationExpiresAt) return;

    const interval = setInterval(() => {
      const expiresAt = new Date(basket.dispatchValidationExpiresAt!).getTime();
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsRemaining(diff);

      if (diff === 0 && !isRevalidating && phase === 'review') {
        // Auto-revalidate when expired
        handleRevalidateDelivery();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, basket?.dispatchValidationExpiresAt, isRevalidating, phase, handleRevalidateDelivery]);

  // Review phase availability check: Check delivery availability/quotes when the basket is reviewed
  useEffect(() => {
    if (isOpen && phase === 'review' && basket && basket.fulfillmentType !== 'pickup') {
      const isExpired =
        !basket.dispatchValidationExpiresAt ||
        new Date(basket.dispatchValidationExpiresAt).getTime() <= Date.now();
      if (isExpired || !basket.dispatchValidationId) {
        handleRevalidateDelivery();
      }
    }
  }, [isOpen, phase, basket?.id, basket?.fulfillmentType, handleRevalidateDelivery]);

  // Handle Tip selection
  const handleSelectTip = async (amount: number) => {
    if (!basket) return;
    setTipAmount(amount);
    try {
      const updated = await defaultCommerceClient.applyTip(basket.id, amount);
      setBasket(updated);
      onBasketUpdated?.(updated);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Promo code
  const handleApplyPromo = async () => {
    if (!basket || !promoCode.trim()) return;
    setIsApplyingPromo(true);
    setPromoError(null);
    setPromoSuccess(null);

    try {
      const updated = await defaultCommerceClient.applyPromoCode(basket.id, promoCode.trim());
      setBasket(updated);
      onBasketUpdated?.(updated);
      setPromoSuccess(`Promo code applied!`);
      setPromoCode('');
    } catch (err: any) {
      setPromoError(err.message || 'Invalid promo code');
    } finally {
      setIsApplyingPromo(false);
    }
  };

  // Add upsell recommendation into current checkout basket
  const handleAddItemFromRecommendations = async (product: any) => {
    if (!basket) return;
    try {
      const updated = await defaultCommerceClient.updateBasketItem(basket.id, product.plu, 1);
      setBasket(updated);
      onBasketUpdated?.(updated);
    } catch (err: any) {
      console.error('Failed to add recommendation to basket', err);
    }
  };

  // Initiate Hosted Payment Session
  const handleInitiatePayment = async () => {
    if (!basket) return;

    if (snoozeAudit.hasSnoozedOrUnavailableItems) {
      setRevalidationError('Please swap or remove out-of-stock items before proceeding to payment.');
      return;
    }

    // Authoritative check before payment pre-authorisation: never silently assume availability
    if (basket.fulfillmentType !== 'pickup') {
      setIsRevalidating(true);
      setRevalidationError(null);
      try {
        const quoteCheck = await defaultCommerceClient.revalidateDelivery(
          basket.id,
          deliveryAddress
        );
        if (!quoteCheck.available) {
          setRevalidationError(
            quoteCheck.reason ||
              'Courier dispatch is currently unavailable for this delivery location. Progression blocked. Please retry or choose collection.'
          );
          if (quoteCheck.alternativeStores) setAlternativeStores(quoteCheck.alternativeStores);
          setCollectionEligible(quoteCheck.collectionEligible ?? true);
          setIsRevalidating(false);
          return;
        }
        if (quoteCheck.dispatchValidationId) {
          basket.dispatchValidationId = quoteCheck.dispatchValidationId;
          basket.dispatchValidationExpiresAt = quoteCheck.dispatchValidationExpiresAt;
        }
      } catch (err: any) {
        setRevalidationError(
          `Unable to verify courier dispatch availability: ${err.message || 'Service unavailable'}. Please retry.`
        );
        setIsRevalidating(false);
        return;
      } finally {
        setIsRevalidating(false);
      }
    }

    try {
      const session = await defaultCommerceClient.createPaymentSession(basket.id);
      setSessionId(session.sessionId);
      setHostedRedirectUrl(session.redirectUrl);
      setPhase('hosted_payment');
    } catch (err: any) {
      setRevalidationError(err.message || 'Could not initiate checkout session');
    }
  };

  // Simulate Hosted Payment Completion
  const handleCompleteHostedPayment = async () => {
    setPhase('polling_status');
    setStatusMessage('Preparing payment...');

    // Asynchronous polling loop matching Deliverect Pay webhook pattern
    const pollInterval = setInterval(async () => {
      try {
        const res = await defaultCommerceClient.getCheckoutStatus(sessionId);
        setCheckoutStatus(res.status);

        if (res.status === 'preparing_payment') {
          setStatusMessage('Communicating with payment gateway...');
        } else if (res.status === 'payment_authorised') {
          setStatusMessage('Payment authorised by bank. Securing dispatch slot...');
        } else if (res.status === 'placing_order') {
          setStatusMessage('Placing order with store & dispatching courier...');
        } else if (res.status === 'order_confirmed') {
          clearInterval(pollInterval);
          setStatusMessage('Order confirmed!');
          if (res.orderId) {
            const order = await defaultCommerceClient.getOrder(res.orderId);
            setConfirmedOrder(order);
            onOrderSuccess(res.orderId);
          }
          setPhase('tracking');
        } else if (res.status === 'order_failed') {
          clearInterval(pollInterval);
          setFailureReason(res.failureReason || 'Payment failed');
          setPhase('order_failed');
        }
      } catch (err: any) {
        clearInterval(pollInterval);
        setFailureReason(err.message || 'Payment status error');
        setPhase('order_failed');
      }
    }, 1200);
  };

  // Advance Order Status (for live testing)
  const handleAdvanceOrder = async () => {
    if (!confirmedOrder) return;
    setIsAdvancingStatus(true);
    try {
      const updated = await defaultCommerceClient.advanceOrderStatus(confirmedOrder.id);
      setConfirmedOrder({ ...updated });
    } finally {
      setIsAdvancingStatus(false);
    }
  };

  // Switch to alternative store
  const handleSwitchStore = async (newStoreId: string) => {
    onStoreSwitched?.(newStoreId);
    setRevalidationError(null);
    setAlternativeStores([]);
  };

  // Switch to collection
  const handleSwitchToCollection = async () => {
    if (!basket) return;
    try {
      const updated = await defaultCommerceClient.switchBasketFulfillment(basket.id, 'pickup');
      setBasket(updated);
      onBasketUpdated?.(updated);
      setRevalidationError(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Simulation flags update
  const handleToggleSimFlag = (flag: string, value: boolean) => {
    if (flag === 'simDispatchExpired') {
      setSimDispatchExpired(value);
      defaultCommerceClient.setSimulationFlags({ simulateDispatchExpired: value });
      if (value && basket) {
        basket.dispatchValidationExpiresAt = new Date(Date.now() - 5000).toISOString();
        setSecondsRemaining(0);
      }
    } else if (flag === 'simDispatchUnavailable') {
      setSimDispatchUnavailable(value);
      defaultCommerceClient.setSimulationFlags({ simulateDispatchUnavailable: value });
    } else if (flag === 'simPaymentFailure') {
      setSimPaymentFailure(value);
      defaultCommerceClient.setSimulationFlags({ simulatePaymentFailure: value });
    }
  };

  if (!isOpen || !basket) return null;

  return (
    <div
      id="checkout-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-x-hidden"
    >
      <div
        id="checkout-card"
        className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto overflow-x-hidden"
      >
        {/* TOP HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {phase === 'tracking'
                  ? 'Order Tracking'
                  : phase === 'hosted_payment'
                  ? 'Deliverect Pay Hosted Checkout'
                  : phase === 'polling_status'
                  ? 'Confirming Order'
                  : 'Secure Checkout'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'review' && (
              <button
                type="button"
                onClick={() => setShowSimPanel(!showSimPanel)}
                className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1"
                title="Toggle QA simulation options"
              >
                <Sliders className="w-3 h-3" />
                <span>Simulate</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SIMULATION QA CONTROLS */}
        {showSimPanel && phase === 'review' && (
          <div className="p-3 mb-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
            <span className="font-bold text-amber-900 block">QA / Edge Case Simulations:</span>
            <div className="grid grid-cols-1 gap-1.5">
              <label className="flex items-center gap-2 text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simDispatchExpired}
                  onChange={(e) => handleToggleSimFlag('simDispatchExpired', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Simulate Dispatch Quote Expired</span>
              </label>
              <label className="flex items-center gap-2 text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simDispatchUnavailable}
                  onChange={(e) => handleToggleSimFlag('simDispatchUnavailable', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Simulate No Couriers Available (Dispatch Unavailable)</span>
              </label>
              <label className="flex items-center gap-2 text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simPaymentFailure}
                  onChange={(e) => handleToggleSimFlag('simPaymentFailure', e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Simulate Payment Card Decline (3DS Failure)</span>
              </label>
            </div>
          </div>
        )}

        {/* PHASE 1: REVIEW & AUTHORITATIVE CHARGES */}
        {phase === 'review' && (
          <div className="space-y-4">
            {/* SNOOZE / OUT OF STOCK & SUBSTITUTION SWAP PROMPT */}
            {snoozeAudit.hasSnoozedOrUnavailableItems && (
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300/80 shadow-xs space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-950 font-extrabold text-sm">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Item Availability & Substitution Notice</span>
                  </div>
                  {snoozeAudit.availableSwaps.length > 1 && (
                    <button
                      type="button"
                      disabled={isSwapping}
                      onClick={handleSwapAllAvailableSubstitutes}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                    >
                      Swap All to In-Stock Substitutes ({snoozeAudit.availableSwaps.length})
                    </button>
                  )}
                </div>

                <p className="text-amber-800 text-[11px] leading-relaxed">
                  We checked real-time store availability and found item(s) that cannot be fulfilled. If you selected an alternative product, you can swap it now with one click:
                </p>

                <div className="space-y-2">
                  {snoozeAudit.affectedItems.map((aff) => {
                    const swap = snoozeAudit.availableSwaps.find((s) => s.originalPlu === aff.plu);

                    return (
                      <div
                        key={aff.plu}
                        className="p-3 rounded-xl bg-white border border-amber-200 shadow-2xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-gray-900 block">{aff.name}</span>
                            <span className="text-[11px] text-amber-700 font-medium">
                              {aff.reason === 'snoozed' ? 'Temporarily snoozed by store' : 'Out of stock at this store'}
                              {aff.snoozedUntil ? ` (until ${new Date(aff.snoozedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isSwapping}
                            onClick={() => handleRemoveUnavailableItem(aff.plu)}
                            className="px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded-lg font-semibold transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>

                        {swap ? (
                          <div className="pt-2 border-t border-amber-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                Chosen replacement: <strong>{swap.substituteName}</strong> is in stock!
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={isSwapping}
                              onClick={() => handleSwapItem(swap.originalPlu, swap.substitutePlu)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs cursor-pointer flex items-center gap-1.5 transition-colors"
                            >
                              <Repeat className="w-3.5 h-3.5" />
                              <span>Swap to {swap.substituteName}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-amber-100 flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-gray-500">
                              {aff.preferredSubstitutePlu
                                ? 'Your chosen substitute is also currently unavailable.'
                                : 'No substitute preference was configured.'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const foundItem = basket?.items.find((i) => i.plu === aff.plu);
                                if (foundItem) {
                                  setEditingSubstitutionItem({ item: foundItem, storeId: basket?.storeId });
                                }
                              }}
                              className="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-[11px] transition-colors cursor-pointer"
                            >
                              Choose Substitute
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Delivery address & store card */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-900 block">Delivery Address</span>
                  <span className="text-gray-600 truncate block">
                    {deliveryAddress.formattedAddress}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2 border-t border-gray-200/60">
                <StoreIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-gray-900 block">Fulfilling Store</span>
                  <span className="text-gray-600 block">
                    {store?.name} {store?.deliveryEta ? `• ETA ${store.deliveryEta}` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* FULFILLMENT SCHEDULING (ASAP vs SCHEDULED) */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-950 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Fulfillment Timing</span>
                </span>
                <span className="text-[11px] text-gray-500 font-medium">
                  {schedulingType === 'ASAP' ? 'Immediate Priority' : 'Pre-Order Slot'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSchedulingType('ASAP')}
                  className={`p-2.5 rounded-xl text-left border font-semibold text-xs transition-all ${
                    schedulingType === 'ASAP'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <strong className="block font-bold">ASAP Delivery</strong>
                  {store?.deliveryEta && (
                    <span className="text-[11px] text-gray-500 block">ETA: {store.deliveryEta}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSchedulingType('SCHEDULED')}
                  className={`p-2.5 rounded-xl text-left border font-semibold text-xs transition-all ${
                    schedulingType === 'SCHEDULED'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 ring-1 ring-emerald-500'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <strong className="block font-bold">Scheduled Slot</strong>
                  <span className="text-[11px] text-gray-500 block">
                    {selectedSlot ? `${selectedSlot.dayLabel} ${selectedSlot.formatted}` : 'Select date/time'}
                  </span>
                </button>
              </div>

              {schedulingType === 'SCHEDULED' && availableSlots.length > 0 && (
                <div className="pt-2 border-t border-gray-200/60 space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Select Reservation Window:
                  </label>
                  <select
                    value={selectedSlot?.id || ''}
                    onChange={(e) => {
                      const found = availableSlots.find((s) => s.id === e.target.value);
                      if (found) setSelectedSlot(found);
                    }}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-emerald-600"
                  >
                    {availableSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.dayLabel} ({slot.dateString}) • {slot.formatted}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* GROCERY SUBSTITUTION PREFERENCES */}
            <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setShowSubstitutions(!showSubstitutions)}
              >
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-gray-900 block">Substitution Preferences</span>
                    <span className="text-[10px] text-gray-500">
                      Best-Match Price Guarantee: you always pay the lower price!
                    </span>
                  </div>
                </div>
                <button type="button" className="text-gray-400 hover:text-gray-600 p-1">
                  <ChevronDown className={`w-4 h-4 transition-transform ${showSubstitutions ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showSubstitutions && (
                <div className="pt-2 border-t border-gray-200/60 space-y-2">
                  <div className="text-[11px] text-gray-500 pb-1">
                    Choose what our in-store shopper should do if any item is out of stock:
                  </div>
                  {basket.items.map((item) => {
                    const priceDiff =
                      item.substitutionPreference === 'CUSTOMER_SELECTED' &&
                      item.preferredSubstitutePrice != null &&
                      moneyToMajor(item.preferredSubstitutePrice) > moneyToMajor(item.unitPrice || item.price)
                        ? (moneyToMajor(item.preferredSubstitutePrice) - moneyToMajor(item.unitPrice || item.price)) * (item.quantity || 1)
                        : 0;

                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-2xl bg-white border border-gray-200/80 shadow-2xs space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900 block truncate">{item?.name || item?.plu || 'Item'}</span>
                              {item.isCombo && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  Combo
                                </span>
                              )}
                            </div>
                            {item.subItems && item.subItems.length > 0 && (
                              <div className="text-[10px] text-gray-500 truncate">
                                {item.subItems.map((s) => `${s.quantity > 1 ? `${s.quantity}× ` : ''}${s.name}`).join(' • ')}
                              </div>
                            )}
                            <span className="text-gray-500 text-[11px] block">
                              Qty: {item?.quantity || 1} • {formatCurrency(item.price, currencySymbol)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingSubstitutionItem({ item, storeId: basket.storeId })}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-200 transition-colors shrink-0 cursor-pointer"
                          >
                            Choose options
                          </button>
                        </div>

                        {/* Deliveroo Option Status */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100 text-[11px]">
                          <span className="text-gray-600 font-medium truncate">
                            {item.substitutionPreference === 'CUSTOMER_SELECTED'
                              ? `Pre-chosen: ${item.preferredSubstituteName || item.preferredSubstitutePlu || 'Alternative'}`
                              : item.substitutionPreference === 'REMOVE_IF_UNAVAILABLE'
                              ? 'Remove & refund item'
                              : item.substitutionPreference === 'CANCEL_ORDER_IF_UNAVAILABLE'
                              ? 'Cancel entire order'
                              : 'Best match (Same or lower price guarantee)'}
                          </span>

                          {priceDiff > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-950 shrink-0">
                              +£{priceDiff.toFixed(2)} buffer
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DISPATCH REVALIDATION BANNER */}
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center justify-between ${
                secondsRemaining > 30
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : secondsRemaining > 0
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-bold block">
                    {secondsRemaining > 0
                      ? `Dispatch quote guaranteed: ${Math.floor(secondsRemaining / 60)}m ${
                          secondsRemaining % 60
                        }s`
                      : 'Dispatch quote expired'}
                  </span>
                  <span className="text-[10px] opacity-80">
                    Authoritative Deliverect Dispatch slot confirmation
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRevalidateDelivery}
                disabled={isRevalidating}
                className="px-2.5 py-1.5 rounded-xl bg-white text-gray-800 font-bold text-[11px] shadow-xs hover:bg-gray-50 flex items-center gap-1 shrink-0 border border-gray-200"
              >
                <RefreshCw className={`w-3 h-3 ${isRevalidating ? 'animate-spin' : ''}`} />
                <span>{isRevalidating ? 'Checking...' : 'Recheck'}</span>
              </button>
            </div>

            {/* REVALIDATION ERROR & RECOVERY */}
            {revalidationError && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs space-y-2">
                <div className="flex items-start gap-2 text-red-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Dispatch Unavailable</span>
                    <span className="text-red-700">{revalidationError}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleRevalidateDelivery}
                    disabled={isRevalidating}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRevalidating ? 'animate-spin' : ''}`} />
                    <span>{isRevalidating ? 'Checking Availability...' : 'Retry Availability Check'}</span>
                  </button>
                  {collectionEligible && (
                    <button
                      type="button"
                      onClick={handleSwitchToCollection}
                      className="flex-1 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs shadow-xs hover:bg-gray-800 cursor-pointer"
                    >
                      Switch to Pickup
                    </button>
                  )}
                </div>

                {alternativeStores.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-red-200/70 space-y-1">
                    <span className="font-semibold text-red-900 block text-[11px]">
                      Available stores with couriers:
                    </span>
                    {alternativeStores.map((alt) => (
                      <button
                        key={alt.id}
                        type="button"
                        onClick={() => handleSwitchStore(alt.id)}
                        className="w-full text-left p-2 rounded-xl bg-white border border-red-200 hover:bg-red-50/50 flex justify-between items-center text-xs text-gray-800 font-medium cursor-pointer"
                      >
                        <span>{alt?.name || 'Partner Store'}</span>
                        <span className="text-emerald-700 font-bold text-[11px]">Switch & Order</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TIP SELECTION */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs">
              <span className="font-bold text-gray-900 block mb-2 flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>Tip your courier (100% goes to driver)</span>
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[0, 1.0, 2.0, 3.0].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleSelectTip(amt)}
                    className={`py-2 rounded-xl font-bold text-xs transition-all ${
                      tipAmount === amt
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {amt === 0 ? 'None' : `+£${amt.toFixed(2)}`}
                  </button>
                ))}
              </div>
            </div>

            {/* PROMO CODE INPUT */}
            <div className="p-3 rounded-2xl bg-gray-50 border border-gray-100 text-xs">
              <span className="font-bold text-gray-900 block mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-gray-600" />
                <span>Promo or Gift Code</span>
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. SAVE5 or FREEDELIV"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs uppercase placeholder:normal-case font-semibold focus:outline-emerald-600"
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={isApplyingPromo || !promoCode.trim()}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs disabled:opacity-50 hover:bg-gray-800 shrink-0"
                >
                  {isApplyingPromo ? 'Applying...' : 'Apply'}
                </button>
              </div>
              {promoSuccess && <span className="text-emerald-700 font-bold block mt-1">{promoSuccess}</span>}
              {promoError && <span className="text-red-600 font-bold block mt-1">{promoError}</span>}
            </div>

            {/* REVERSE DEAL MEAL PROMPTS (2 of 3 items in basket -> prompt 3rd unless HFSS) */}
            {reverseDealResults.eligible.length > 0 && (
              <div className="space-y-2">
                {reverseDealResults.eligible.map((prompt) => (
                  <ReverseDealPromptCard
                    key={prompt.deal.id}
                    prompt={prompt}
                    variant="checkout"
                    currencySymbol={currencySymbol}
                    onAddMissingItem={handleAddItemFromRecommendations}
                    onOpenDealPopup={(deal) => {
                      onClose();
                      onOpenDealPopup?.(deal);
                    }}
                  />
                ))}
              </div>
            )}

            {/* HFSS REGULATORY RESTRICTION NOTICE */}
            {reverseDealResults.hfssBlocked.length > 0 && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2 text-[11px] text-slate-700">
                <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
                <span>
                  <strong>HFSS Statutory Compliance:</strong> {reverseDealResults.hfssBlocked.length} promotional combo opportunity excluded from checkout upsells under UK Food Placement Regulations (contains confectionery / high sugar/salt items).
                </span>
              </div>
            )}

            {/* CONTEXT-AWARE CHECKOUT UP-SELL RECOMMENDATIONS PROTECTED BY ERROR BOUNDARY */}
            <ErrorBoundary fallback={null}>
              <CheckoutRecommendations
                basketItems={basket?.items}
                candidateProducts={storeProducts}
                onAddRecommendation={handleAddItemFromRecommendations}
              />
            </ErrorBoundary>

            {/* AUTHORITATIVE TOTALS BREAKDOWN */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
              <div className="flex justify-between text-gray-700">
                <span>Items Subtotal ({basket.items.length})</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(basket.subtotal, currencySymbol)}
                </span>
              </div>

              {(basket.discounts || []).map((d) => (
                <div key={d.id} className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount ({d.title})</span>
                  <span>-{formatCurrency(d.amount, currencySymbol)}</span>
                </div>
              ))}

              {basket.charges.map((c) => (
                <div key={c.id} className="flex justify-between text-gray-600">
                  <div>
                    <span>{c.title}</span>
                    {c.description && (
                      <span className="text-[10px] text-gray-400 block">{c.description}</span>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(c.amount, currencySymbol)}
                  </span>
                </div>
              ))}

              {basket.depositTotal && moneyToMajor(basket.depositTotal) > 0 ? (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Refundable DRS Bottle Deposit</span>
                  <span>+{formatCurrency(basket.depositTotal, currencySymbol)}</span>
                </div>
              ) : null}

              <div className="flex justify-between pt-3 border-t border-gray-200 text-sm font-extrabold text-gray-900">
                <span>Authoritative Payable Total</span>
                <span className="text-lg font-black text-gray-950">
                  {formatCurrency(basket.total, currencySymbol)}
                </span>
              </div>
            </div>

            {/* GROCERY AUTHORIZATION NOTICE */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1 text-emerald-950">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Retail Grocery Payment Model</span>
              </div>
              <p className="text-[11px] text-emerald-900 leading-relaxed">
                You are <strong>not charged immediately</strong>. We pre-authorize up to{' '}
                <strong>
                  {formatCurrency(
                    calculateAuthorizationMaximum(
                      basket.total,
                      true,
                      0,
                      basket.currency,
                      preChosenBufferInfo.extraBufferAmount
                    ).authorizationMaximum,
                    currencySymbol
                  )}
                </strong>{' '}
                (estimated total
                {preChosenBufferInfo.extraBufferMajor > 0 ? (
                  <> + £{preChosenBufferInfo.extraBufferMajor.toFixed(2)} pre-chosen alternative buffer</>
                ) : null}
                ). The final amount will only be captured when store picking completes.
              </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                id="direct-auth-pay-btn"
                onClick={handleDirectAuthorizeCheckout}
                disabled={
                  isAuthorizingDirect ||
                  isRevalidating ||
                  Boolean(revalidationError) ||
                  (basket.fulfillmentType !== 'pickup' && secondsRemaining <= 0) ||
                  snoozeAudit.hasSnoozedOrUnavailableItems ||
                  isSwapping
                }
                style={primaryBtnStyle}
                className="w-full py-4 rounded-2xl font-bold text-sm shadow-md active:scale-98 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isAuthorizingDirect ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authorizing & Submitting...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {snoozeAudit.hasSnoozedOrUnavailableItems
                        ? 'Resolve Out of Stock Items Above'
                        : revalidationError || (basket.fulfillmentType !== 'pickup' && secondsRemaining <= 0)
                        ? 'Courier Dispatch Unavailable - Retry Above'
                        : `Authorize & Place Order (up to ${formatCurrency(
                            calculateAuthorizationMaximum(
                              basket.total,
                              true,
                              0,
                              basket.currency,
                              preChosenBufferInfo.extraBufferAmount
                            ).authorizationMaximum,
                            currencySymbol
                          )})`}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="initiate-pay-btn"
                onClick={handleInitiatePayment}
                disabled={
                  isAuthorizingDirect ||
                  isRevalidating ||
                  Boolean(revalidationError) ||
                  (basket.fulfillmentType !== 'pickup' && secondsRemaining <= 0) ||
                  snoozeAudit.hasSnoozedOrUnavailableItems ||
                  isSwapping
                }
                className="w-full py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <span>Or use Deliverect Pay Hosted Session</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Zero raw card exposure • PCI Tokenized Pre-Authorization</span>
              </div>
            </div>
          </div>
        )}

        {/* PHASE 2: HOSTED PAYMENT REDIRECT SIMULATION */}
        {phase === 'hosted_payment' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CreditCard className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900">Deliverect Pay Hosted Session</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                A secure hosted payment session has been created by our Backend-for-Frontend.
              </p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-gray-100 text-[11px] font-mono text-gray-600">
                Session: {sessionId}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 text-left text-xs space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between">
                <span className="text-gray-500">Brand:</span>
                <span className="font-bold text-gray-900">{brandName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount Due:</span>
                <span className="font-extrabold text-gray-900">
                  {formatCurrency(basket.total, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Supported Wallets:</span>
                <span className="font-medium text-gray-700">Apple Pay, Google Pay, 3DS Cards</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 max-w-sm mx-auto">
              <button
                type="button"
                id="complete-hosted-pay-btn"
                onClick={handleCompleteHostedPayment}
                style={primaryBtnStyle}
                className="w-full py-3.5 rounded-2xl font-bold text-sm shadow-md"
              >
                Complete Payment on Deliverect Pay
              </button>

              <button
                type="button"
                onClick={() => setPhase('review')}
                className="w-full py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel & Return to Basket
              </button>
            </div>
          </div>
        )}

        {/* PHASE 3: ASYNCHRONOUS WEBHOOK POLLING */}
        {phase === 'polling_status' && (
          <div className="text-center py-10 space-y-5">
            <Loader2 className="w-14 h-14 text-emerald-600 animate-spin mx-auto" />

            <div>
              <h3 className="text-lg font-black text-gray-900 mb-1">Processing Order</h3>
              <p className="text-xs font-semibold text-emerald-700">{statusMessage}</p>
            </div>

            {/* Stepper showing async states */}
            <div className="max-w-xs mx-auto text-left space-y-2 text-xs">
              {[
                { key: 'preparing_payment', label: 'Preparing payment' },
                { key: 'payment_authorised', label: 'Payment authorised' },
                { key: 'placing_order', label: 'Placing order with store' },
                { key: 'order_confirmed', label: 'Order confirmed' },
              ].map((step, idx) => {
                const isCurrent = checkoutStatus === step.key;
                const isPassed =
                  (step.key === 'preparing_payment' &&
                    ['payment_authorised', 'placing_order', 'order_confirmed'].includes(
                      checkoutStatus
                    )) ||
                  (step.key === 'payment_authorised' &&
                    ['placing_order', 'order_confirmed'].includes(checkoutStatus)) ||
                  (step.key === 'placing_order' && checkoutStatus === 'order_confirmed');

                return (
                  <div key={step.key} className="flex items-center gap-2.5">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isPassed
                          ? 'bg-emerald-600 text-white'
                          : isCurrent
                          ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-600 animate-pulse'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isPassed ? '✓' : idx + 1}
                    </div>
                    <span
                      className={`font-semibold ${
                        isCurrent
                          ? 'text-emerald-900 font-bold'
                          : isPassed
                          ? 'text-gray-800'
                          : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PHASE 4: PAYMENT FAILED */}
        {phase === 'order_failed' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-black text-gray-900">Payment Unsuccessful</h3>
              <p className="text-xs text-red-700 font-semibold mt-1">{failureReason}</p>
              <p className="text-xs text-gray-500 mt-2 max-w-xs mx-auto">
                No charges were captured on your account. Your basket items have been preserved.
              </p>
            </div>

            <div className="pt-3 space-y-2 max-w-sm mx-auto">
              <button
                type="button"
                onClick={() => {
                  setSimPaymentFailure(false);
                  defaultCommerceClient.setSimulationFlags({ simulatePaymentFailure: false });
                  setPhase('review');
                }}
                style={primaryBtnStyle}
                className="w-full py-3.5 rounded-2xl font-bold text-sm shadow-md"
              >
                Try Payment Again
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Close & Keep Basket
              </button>
            </div>
          </div>
        )}

        {/* PHASE 5: REAL-TIME ASYNCHRONOUS ORDER TRACKING & QUEST PICKING */}
        {phase === 'tracking' && confirmedOrder && (
          <div className="space-y-4">
            <OrderTrackingView
              order={confirmedOrder}
              onOrderUpdated={(updated) => {
                setConfirmedOrder(updated);
              }}
              onBackToList={onClose}
            />
          </div>
        )}
      </div>

      {/* DELIVEROO-STYLE UNAVAILABLE PREFERENCE MODAL */}
      <ItemUnavailablePreferenceModal
        isOpen={!!editingSubstitutionItem}
        item={editingSubstitutionItem?.item || null}
        storeId={editingSubstitutionItem?.storeId}
        candidateProducts={storeProducts}
        onClose={() => setEditingSubstitutionItem(null)}
        onUpdate={(payload) => {
          handleUpdateItemSubstitution(
            payload.plu,
            payload.preference,
            payload.preferredSubstitutePlu,
            payload.preferredSubstituteName,
            payload.preferredSubstitutePrice
          );
          setEditingSubstitutionItem(null);
        }}
        onRemoveItem={async (plu) => {
          if (basket) {
            const updated = await defaultCommerceClient.removeFromBasket(basket.id, plu);
            setBasket(updated);
            onBasketUpdated?.(updated);
          }
          setEditingSubstitutionItem(null);
        }}
      />
    </div>
  );
};
