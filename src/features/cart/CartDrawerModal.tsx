import React, { useMemo, useState } from 'react';
import {
  Basket,
  BasketItem,
  Product,
  SubstitutionPreferenceType,
  moneyToMajor,
  calculatePreChosenAlternativeExtraBuffer,
} from '../../commerce/models';
import { QuantitySelector } from '../../components/QuantitySelector';
import { useTenantStyles } from '../../tenant/useTenant';
import { formatCurrency } from '../../utils/formatters';
import { calculateReverseDeals } from '../../commerce/reverseDealEngine';
import { ReverseDealPromptCard } from '../deals/ReverseDealPromptCard';
import { DeliverectDeal } from '../../commerce/dealModels';
import { ItemUnavailablePreferenceModal } from './ItemUnavailablePreferenceModal';
import {
  evaluateBasketSnoozeStatus,
  BasketSnoozeAuditResult,
} from '../../services/snoozeCheckService';
import {
  X,
  ShoppingBag,
  Trash2,
  Truck,
  ArrowRight,
  ShieldCheck,
  ArrowRightLeft,
  Package,
  Store as StoreIcon,
  BadgePercent,
  Zap,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Repeat,
  CheckCircle2,
} from 'lucide-react';

interface CartDrawerModalProps {
  isOpen: boolean;
  basket: Basket | null;
  candidateProducts?: Product[];
  onClose: () => void;
  onUpdateQuantity: (product: Product, quantity: number, targetStoreId?: string) => void;
  onRemoveItem: (plu: string, targetStoreId?: string) => void;
  onSwapItem?: (originalPlu: string, substitutePlu: string) => void;
  onSwapAllSubstitutes?: () => void;
  snoozeAudit?: BasketSnoozeAuditResult;
  onUpdateSubstitution?: (
    plu: string,
    preference: SubstitutionPreferenceType,
    preferredSubstitutePlu?: string,
    preferredSubstituteName?: string,
    preferredSubstitutePrice?: number,
    targetStoreId?: string
  ) => void;
  onProceedToCheckout: () => void;
  onOpenDealPopup?: (deal: DeliverectDeal) => void;
  loading: boolean;
}

export const CartDrawerModal: React.FC<CartDrawerModalProps> = ({
  isOpen,
  basket,
  candidateProducts = [],
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onSwapItem,
  onSwapAllSubstitutes,
  snoozeAudit: propSnoozeAudit,
  onUpdateSubstitution,
  onProceedToCheckout,
  onOpenDealPopup,
  loading,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();

  // State for active Deliveroo-style unavailable preference modal
  const [editingItem, setEditingItem] = useState<{
    item: BasketItem;
    storeId?: string;
  } | null>(null);

  // Single authoritative store basket
  const effectiveBasket = basket && basket.items.length > 0 ? basket : null;

  // Real-time evaluation of basket snooze status on basket calculation
  const snoozeAudit = useMemo(() => {
    if (propSnoozeAudit) return propSnoozeAudit;
    return evaluateBasketSnoozeStatus(effectiveBasket);
  }, [propSnoozeAudit, effectiveBasket]);

  const totalItemsCount = effectiveBasket
    ? (effectiveBasket.items || []).reduce((sum, i) => sum + i.quantity, 0)
    : 0;

  const isEmpty = totalItemsCount === 0;

  // Authoritative calculations
  const combinedSubtotalMajor = effectiveBasket ? moneyToMajor(effectiveBasket.subtotal) : 0;

  // Authoritative delivery fees from charges
  const totalDeliveryFees = effectiveBasket
    ? (effectiveBasket.charges || []).reduce(
        (cSum, c) => cSum + (c?.type === 'deliveryFee' && c.amount ? moneyToMajor(c.amount) : 0),
        0
      )
    : 0;

  // Other charges: bag fees, service fees, small order fees, tips
  const otherCharges = effectiveBasket
    ? (effectiveBasket.charges || []).filter(
        (c) =>
          c &&
          c.type !== 'deliveryFee' &&
          c.type !== 'deposit' &&
          c.type !== 'depositTotal' &&
          c.type !== 'discount'
      )
    : [];

  const totalDepositsMajor = effectiveBasket
    ? (effectiveBasket.depositTotal ? moneyToMajor(effectiveBasket.depositTotal) : 0)
    : 0;

  // Authoritative discounts calculated in basket
  const combinedDiscountsMajor = effectiveBasket
    ? (effectiveBasket.discounts || []).reduce((dSum, d) => dSum + (d?.amount ? moneyToMajor(d.amount) : 0), 0)
    : 0;

  // The authoritative grand total
  const grandTotal = effectiveBasket ? moneyToMajor(effectiveBasket.total) : 0;

  // Flatten basket items to analyze for reverse deal opportunities
  const allBasketItems = useMemo(
    () => effectiveBasket?.items || [],
    [effectiveBasket]
  );

  // Pre-Authorisation Card Hold:
  // Holds estimated order total; customer only pays for what is picked in store
  const preAuthMaxMajor = grandTotal;

  const candidatePool = useMemo(() => {
    if (candidateProducts && candidateProducts.length > 0) {
      return candidateProducts;
    }
    return (effectiveBasket?.items || []).map((item) => ({
      id: item.id,
      plu: item.plu,
      gtin: [],
      name: item.name,
      brand: item.brand || '',
      price: item.price,
      categoryIds: [],
      productTags: [],
      displayLabels: [],
      allergens: [],
      active: true,
      imageUrl: item.imageUrl,
    }));
  }, [candidateProducts, effectiveBasket]);

  const combinedDiscounts = useMemo(
    () => effectiveBasket?.discounts || [],
    [effectiveBasket]
  );

  const reverseDealResults = useMemo(() => {
    return calculateReverseDeals(allBasketItems, candidatePool, undefined, combinedDiscounts);
  }, [allBasketItems, candidatePool, combinedDiscounts]);

  if (!isOpen) return null;

  // Helper to add missing item from reverse deal prompt
  const handleAddMissingProduct = (missingProduct: Product) => {
    const targetStoreId = basket?.storeId;
    onUpdateQuantity(missingProduct, 1, targetStoreId);
  };

  // Quick helper to test reverse deals (for demonstration / reviewer ease)
  const loadDemoScenario = (scenario: 'lunch' | 'evening' | 'hfss') => {
    const storeId = basket?.storeId || 'store-market-lane-chelmsford';
    if (scenario === 'lunch') {
      const tortelloni = candidatePool.find((p) => p.plu === 'PLU-PASTA-TORTELLONI-TRUFFLE-250G');
      const crisps = candidatePool.find((p) => p.plu === 'PLU-CRISPS-SEA-SALT-CIDER-150G');
      if (tortelloni) onUpdateQuantity(tortelloni, 1, storeId);
      if (crisps) onUpdateQuantity(crisps, 1, storeId);
    } else if (scenario === 'evening') {
      const pizza = candidatePool.find((p) => p.plu === 'PLU-PIZZA-MARGHERITA-WOODFIRED');
      const crisps = candidatePool.find((p) => p.plu === 'PLU-CRISPS-SEA-SALT-CIDER-150G');
      if (pizza) onUpdateQuantity(pizza, 1, storeId);
      if (crisps) onUpdateQuantity(crisps, 1, storeId);
    } else if (scenario === 'hfss') {
      const pizza = candidatePool.find((p) => p.plu === 'PLU-PIZZA-MARGHERITA-WOODFIRED');
      const juice = candidatePool.find((p) => p.plu === 'PLU-JUICE-OJ-FRESH-1L');
      if (pizza) onUpdateQuantity(pizza, 1, storeId);
      if (juice) onUpdateQuantity(juice, 1, storeId);
    }
  };

  return (
    <div
      id="cart-drawer-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs overflow-x-hidden"
      onClick={onClose}
    >
      <div
        id="cart-drawer-content"
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-gray-900">Your Basket</h2>
                {combinedDiscountsMajor > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-tight">
                    Saving {currencySymbol}{combinedDiscountsMajor.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {basket?.storeName || 'Selected Store'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isEmpty ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <Package className="w-16 h-16 stroke-1 mb-3 text-gray-300" />
              <h3 className="text-base font-bold text-gray-700 mb-1">
                Your basket is empty
              </h3>
              <p className="text-xs text-gray-500 max-w-xs mb-4">
                Explore our fresh aisles and trending stories to add items.
              </p>

              {/* Interactive Demo Presets */}
              <div className="w-full bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-left mb-4">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 mb-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>Test Reverse Meal Deal Calculations:</span>
                </div>
                <p className="text-[11px] text-gray-600 mb-3 leading-snug">
                  Click below to quickly load 2 of 3 meal deal items into your basket and see the prompt in action:
                </p>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => loadDemoScenario('lunch')}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white border border-amber-200 hover:border-emerald-500 text-[11px] font-bold text-gray-800 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span>🍜 Load 2 of 3: Tortelloni + Crisps (Non-HFSS)</span>
                    <span className="text-emerald-700 font-extrabold text-[10px]">Prompts Juice +Save £2.75 →</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadDemoScenario('evening')}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white border border-amber-200 hover:border-emerald-500 text-[11px] font-bold text-gray-800 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span>🍕 Load 2 of 3: Pizza + Crisps (Non-HFSS)</span>
                    <span className="text-emerald-700 font-extrabold text-[10px]">Prompts Ale +Save £3.50 →</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => loadDemoScenario('hfss')}
                    className="w-full text-left px-3 py-2 rounded-xl bg-white border border-amber-200 hover:border-amber-400 text-[11px] font-bold text-gray-800 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span>🍫 Load 2 of 3: Pizza + OJ (3rd item is Cookies)</span>
                    <span className="text-amber-800 font-extrabold text-[10px]">HFSS Blocked by Law 🛡️</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                style={primaryBtnStyle}
                className="px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SNOOZE / OUT OF STOCK AUDIT BANNER */}
              {snoozeAudit.hasSnoozedOrUnavailableItems && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 shadow-2xs space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{snoozeAudit.affectedItems.length} item(s) unavailable at this store</span>
                    </div>
                    {snoozeAudit.availableSwaps.length > 0 && onSwapAllSubstitutes && (
                      <button
                        type="button"
                        onClick={onSwapAllSubstitutes}
                        className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10.5px] cursor-pointer transition-colors shadow-2xs"
                      >
                        Swap All In-Stock ({snoozeAudit.availableSwaps.length})
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    Real-time stock check found items that are snoozed or out of stock. You can swap them with in-stock alternatives or remove them.
                  </p>
                </div>
              )}

              {/* Active Basket Items */}
              {effectiveBasket && (
                <div className="space-y-2.5">
                  {effectiveBasket.items.map((item) => {
                    const itemName = item?.name || item?.plu || 'Item';
                    const affected = snoozeAudit.affectedItems.find((a) => a.plu === item.plu);
                    const swap = snoozeAudit.availableSwaps.find((s) => s.originalPlu === item.plu);

                    const pseudoProduct: Product = {
                      id: item.id,
                      plu: item.plu,
                      gtin: [],
                      name: itemName,
                      brand: item.brand || '',
                      price: item.price,
                      categoryIds: [],
                      productTags: [],
                      displayLabels: [],
                      allergens: [],
                      active: true,
                      imageUrl: item.imageUrl,
                    };

                    return (
                      <div
                        key={item.id || item.plu}
                        className={`p-3 rounded-2xl border transition-colors bg-white shadow-2xs space-y-2.5 ${
                          affected ? 'border-amber-300 bg-amber-50/20' : 'border-gray-150 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-13 h-13 rounded-xl bg-gray-50 overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center relative">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={itemName}
                                className={`w-full h-full object-cover ${affected ? 'opacity-50 grayscale' : ''}`}
                              />
                            ) : (
                              <Package className="w-6 h-6 text-gray-300" />
                            )}
                            {affected && (
                              <span className="absolute inset-0 bg-amber-950/20 flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-amber-500 drop-shadow" />
                              </span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-bold text-gray-900 truncate">
                                {itemName}
                              </h4>
                              {item.isCombo && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  Combo Deal
                                </span>
                              )}
                              {affected && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                  {affected.reason === 'snoozed' ? 'Snoozed by store' : 'Out of stock'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-gray-500">
                              {formatCurrency(item.price, currencySymbol)} each
                            </p>
                            {item.subItems && item.subItems.length > 0 && (
                              <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-emerald-400/60">
                                {item.subItems.map((sub, sIdx) => (
                                  <div
                                    key={`sub-${sub.modifierId || sIdx}`}
                                    className="text-[10px] text-gray-600 flex items-center justify-between gap-1"
                                  >
                                    <span className="truncate">
                                      • {sub.quantity > 1 ? `${sub.quantity}× ` : ''}{sub.name}
                                    </span>
                                    {sub.price && sub.price.amount > 0 && (
                                      <span className="font-semibold text-emerald-700 shrink-0 font-mono text-[9.5px]">
                                        +{formatCurrency(sub.price, currencySymbol)}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {item.deposit && moneyToMajor(item.deposit) > 0 ? (
                              <span className="text-[10px] text-emerald-700 font-semibold block">
                                +{formatCurrency(item.deposit, currencySymbol)} DRS Deposit
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            <QuantitySelector
                              quantity={item.quantity}
                              onIncrement={() =>
                                onUpdateQuantity(pseudoProduct, item.quantity + 1, effectiveBasket.storeId)
                              }
                              onDecrement={() =>
                                onUpdateQuantity(pseudoProduct, item.quantity - 1, effectiveBasket.storeId)
                              }
                              size="sm"
                            />

                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.plu, effectiveBasket.storeId)}
                              className="w-7 h-7 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* If affected and swap candidate available, render direct swap prompt */}
                        {affected && swap && (
                          <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] text-amber-950 font-medium truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">
                                In-stock substitute: <strong>{swap.substituteName}</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSwapItem?.(item.plu, swap.substitutePlu)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                            >
                              <Repeat className="w-3 h-3" />
                              <span>Swap</span>
                            </button>
                          </div>
                        )}

                        {/* DELIVEROO STYLE UNAVAILABLE PREFERENCE CHIP / BUTTON */}
                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingItem({ item, storeId: effectiveBasket.storeId })}
                            className="group flex-1 min-w-0 text-left py-1.5 px-2.5 rounded-xl bg-gray-50/90 hover:bg-emerald-50/60 border border-gray-200/70 hover:border-emerald-300 transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              {item.substitutionPreference === 'CUSTOMER_SELECTED' ? (
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              ) : item.substitutionPreference === 'REMOVE_IF_UNAVAILABLE' ? (
                                <Trash2 className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              ) : item.substitutionPreference === 'CANCEL_ORDER_IF_UNAVAILABLE' ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              ) : (
                                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              )}
                              <div className="min-w-0 truncate">
                                <span className="text-[11px] font-bold text-gray-800 group-hover:text-emerald-950 block truncate">
                                  {item.substitutionPreference === 'CUSTOMER_SELECTED'
                                    ? 'If unavailable: Pre-chosen substitute'
                                    : item.substitutionPreference === 'REMOVE_IF_UNAVAILABLE'
                                    ? 'If unavailable: Remove item'
                                    : item.substitutionPreference === 'CANCEL_ORDER_IF_UNAVAILABLE'
                                    ? 'If unavailable: Cancel entire order'
                                    : 'If unavailable: Best match'}
                                </span>
                                {item.substitutionPreference === 'CUSTOMER_SELECTED' && (
                                  <span className="text-[10px] text-gray-500 block truncate font-medium">
                                    {item.preferredSubstituteName || item.preferredSubstitutePlu || '1 alternative selected'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.substitutionPreference === 'CUSTOMER_SELECTED' &&
                              item.preferredSubstitutePrice != null &&
                              moneyToMajor(item.preferredSubstitutePrice) > moneyToMajor(item.unitPrice || item.price) ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-amber-100 text-amber-950">
                                  +£{(moneyToMajor(item.preferredSubstitutePrice) - moneyToMajor(item.unitPrice || item.price)).toFixed(2)} buffer
                                </span>
                              ) : item.substitutionPreference === 'CANCEL_ORDER_IF_UNAVAILABLE' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-red-100 text-red-800">
                                  Cancel
                                </span>
                              ) : item.substitutionPreference === 'REMOVE_IF_UNAVAILABLE' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-gray-200 text-gray-700">
                                  Refund
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800">
                                  Cheapest
                                </span>
                              )}
                              <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-700 transition-colors" />
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* REVERSE DEAL SUGGESTIONS IN BASKET (Before going to checkout) */}
              {reverseDealResults.eligible.length > 0 && (
                <div className="pt-2">
                  {reverseDealResults.eligible.map((prompt) => (
                    <ReverseDealPromptCard
                      key={prompt.deal.id}
                      prompt={prompt}
                      variant="basket"
                      currencySymbol={currencySymbol}
                      onAddMissingItem={handleAddMissingProduct}
                      onOpenDealPopup={(deal) => {
                        onClose();
                        onOpenDealPopup?.(deal);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* HFSS REGULATORY COMPLIANCE BANNER */}
              {reverseDealResults.hfssBlocked.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-slate-900 block">
                      UK Food Promotion Compliance (HFSS Protected)
                    </span>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {reverseDealResults.hfssBlocked.length} bundle opportunity suppressed from upsell prompts in accordance with The Food (Promotion and Placement) Regulations because the candidate item is High in Fat, Sugar or Salt.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Footer / Breakdown */}
        {!isEmpty && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/90 space-y-3">
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Items Subtotal ({totalItemsCount} items)</span>
                <span className="font-semibold text-gray-900">
                  {currencySymbol}{(combinedSubtotalMajor || 0).toFixed(2)}
                </span>
              </div>

              {/* Applied Deal Discounts calculated in basket */}
              {combinedDiscountsMajor > 0 && (
                <div className="space-y-1 py-1">
                  {(effectiveBasket?.discounts || []).map((disc) => (
                    <div
                      key={disc.id}
                      className="flex justify-between items-center text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1.5 rounded-lg border border-emerald-300/60"
                    >
                      <span className="flex items-center gap-1.5">
                        <BadgePercent className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>{disc.title || 'Deal Discount'}</span>
                      </span>
                      <span>-{currencySymbol}{moneyToMajor(disc.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-black text-emerald-800 px-0.5">
                    <span>Total Deal Savings Applied</span>
                    <span>-{currencySymbol}{combinedDiscountsMajor.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {totalDeliveryFees > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-gray-900">
                    {currencySymbol}{(totalDeliveryFees || 0).toFixed(2)}
                  </span>
                </div>
              )}

              {/* Other fees: bag fees, service fees, small order fees, tips */}
              {otherCharges.map((c, idx) => (
                <div key={c.id || idx} className="flex justify-between text-gray-600">
                  <span>{c.title}</span>
                  <span className="font-semibold text-gray-900">
                    {currencySymbol}{moneyToMajor(c.amount).toFixed(2)}
                  </span>
                </div>
              ))}

              {totalDepositsMajor > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Refundable DRS Deposit</span>
                  <span>+{currencySymbol}{(totalDepositsMajor || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-extrabold text-gray-900">
                <span>Total to Pay</span>
                <span className="text-base font-black text-emerald-950">
                  {currencySymbol}{(grandTotal || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* GROCERY PRE-AUTHORISATION BUFFER BREAKDOWN */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs space-y-1 text-emerald-950">
              <div className="flex items-center justify-between font-bold">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Card Pre-Authorisation:</span>
                </div>
                <span className="text-xs font-black font-mono text-emerald-950">
                  {currencySymbol}{preAuthMaxMajor.toFixed(2)} est.
                </span>
              </div>
              <p className="text-[10.5px] text-emerald-900/80 leading-snug">
                Your payment method is authorized for the estimated total ({currencySymbol}{grandTotal.toFixed(2)}). You are only charged for what is confirmed and picked in store; any difference is released immediately.
              </p>
            </div>

            <button
              type="button"
              id="checkout-proceed-btn"
              onClick={onProceedToCheckout}
              style={primaryBtnStyle}
              className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition-transform cursor-pointer"
            >
              <span>{snoozeAudit.hasSnoozedOrUnavailableItems ? 'Review & Resolve Items at Checkout' : 'Go to Checkout'}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>

      {/* DELIVEROO-STYLE UNAVAILABLE PREFERENCE MODAL */}
      <ItemUnavailablePreferenceModal
        isOpen={!!editingItem}
        item={editingItem?.item || null}
        storeId={editingItem?.storeId}
        candidateProducts={candidatePool}
        onClose={() => setEditingItem(null)}
        onUpdate={(payload) => {
          if (editingItem && payload.quantity !== editingItem.item.quantity) {
            const pseudoProd: Product = {
              id: editingItem.item.id,
              plu: editingItem.item.plu,
              gtin: [],
              name: editingItem.item.name,
              brand: editingItem.item.brand || '',
              price: editingItem.item.price,
              categoryIds: [],
              productTags: [],
              displayLabels: [],
              allergens: [],
              active: true,
              imageUrl: editingItem.item.imageUrl,
            };
            onUpdateQuantity(pseudoProd, payload.quantity, payload.storeId);
          }
          if (onUpdateSubstitution) {
            onUpdateSubstitution(
              payload.plu,
              payload.preference,
              payload.preferredSubstitutePlu,
              payload.preferredSubstituteName,
              payload.preferredSubstitutePrice,
              payload.storeId
            );
          }
          setEditingItem(null);
        }}
        onRemoveItem={(plu, storeId) => {
          onRemoveItem(plu, storeId);
          setEditingItem(null);
        }}
      />
    </div>
  );
};
