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
import { useTenant } from '../../tenant/TenantContext';
import { useI18n } from '../../i18n/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { calculateReverseDeals } from '../../commerce/reverseDealEngine';
import { ReverseDealPromptCard } from '../deals/ReverseDealPromptCard';
import { DeliverectDeal } from '../../commerce/dealModels';
import { BundleProduct, findMissedBundleOffers } from '../../commerce/bundleModels';
import { qualifyAutomaticDeals } from '../../commerce/automaticDealEngine';
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
  bundles?: BundleProduct[];
  onOpenBundleDialog?: (bundle: BundleProduct) => void;
  onCompleteBundleOffer?: (offer: ReturnType<typeof findMissedBundleOffers>[number]) => Promise<unknown> | unknown;
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
  bundles = [],
  onOpenBundleDialog,
  onCompleteBundleOffer,
  loading,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const { tenant } = useTenant();
  const { t } = useI18n();
  const isUkTenant = tenant?.country === 'GB';

  // State for active Deliveroo-style unavailable preference modal
  const [comboChoice, setComboChoice] = useState<ReturnType<typeof findMissedBundleOffers>[number] | null>(null);

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

  // Deliverect's basket API is order-line data, not catalog data — it never
  // carries or echoes back a product image, so basket items are missing
  // imageUrl regardless of how they were added. Fall back to the currently
  // loaded store catalog (candidateProducts) by PLU.
  const catalogImageByPlu = useMemo(() => {
    const map = new Map<string, string | undefined>();
    (candidateProducts || []).forEach((p) => {
      if (p.plu) map.set(p.plu, p.imageUrl);
    });
    return map;
  }, [candidateProducts]);
  const resolveItemImageUrl = (item: { plu?: string; imageUrl?: string }): string | undefined =>
    item.imageUrl || (item.plu ? catalogImageByPlu.get(item.plu) : undefined);

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
      imageUrl: resolveItemImageUrl(item),
    }));
  }, [candidateProducts, effectiveBasket]);

  const combinedDiscounts = useMemo(
    () => effectiveBasket?.discounts || [],
    [effectiveBasket]
  );

  const reverseDealResults = useMemo(() => {
    return calculateReverseDeals(allBasketItems, candidatePool, undefined, combinedDiscounts);
  }, [allBasketItems, candidatePool, combinedDiscounts]);

  // "Missed offer" combos: the customer already has most of a bundle's
  // required items in the basket (added individually), just not through the
  // explicit bundle-add flow, so they never got the discount. This never
  // applies a discount itself — it only surfaces the option; the customer
  // still has to confirm through BundleSelectionDialog to actually get it.
  const automaticBundleAllocations = useMemo(() => {
    if (!effectiveBasket || bundles.length === 0 || candidatePool.length === 0) return [];
    return qualifyAutomaticDeals(allBasketItems, bundles, candidatePool);
  }, [allBasketItems, bundles, candidatePool, effectiveBasket]);

  const allocatedBundleUnits = useMemo(
    () => automaticBundleAllocations.flatMap((allocation) =>
      allocation.components.map((component) => ({
        plu: component.componentPlu,
        quantity: component.quantity,
      }))
    ),
    [automaticBundleAllocations]
  );

  const missedBundleOffers = useMemo(() => {
    if (!effectiveBasket || bundles.length === 0) return [];
    return findMissedBundleOffers(allBasketItems, bundles, candidatePool, allocatedBundleUnits);
  }, [allBasketItems, bundles, candidatePool, allocatedBundleUnits, effectiveBasket]);

  if (!isOpen) return null;

  const addProductQuantity = (product: Product, quantityToAdd = 1) => {
    const currentQuantity = allBasketItems
      .filter((item) => item.plu === product.plu)
      .reduce((sum, item) => sum + item.quantity, 0);
    onUpdateQuantity(
      product,
      currentQuantity + Math.max(1, quantityToAdd),
      effectiveBasket?.storeId || basket?.storeId
    );
  };

  // Helper to add missing item from reverse deal prompt
  const handleAddMissingProduct = (missingProduct: Product) => {
    addProductQuantity(missingProduct, 1);
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
                <h2 className="text-base font-bold text-gray-900">{t('basket.title')}</h2>
                {combinedDiscountsMajor > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-tight">
                    {t('basket.saving')} {currencySymbol}{combinedDiscountsMajor.toFixed(2)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {basket?.storeName || t('basket.selectedStore')}
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
                {t('basket.emptyTitle')}
              </h3>
              <p className="text-xs text-gray-500 max-w-xs mb-4">
                {t('basket.emptySubtitle')}
              </p>


              <button
                type="button"
                onClick={onClose}
                style={primaryBtnStyle}
                className="px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs"
              >
                {t('basket.startShopping')}
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
                      <span>{snoozeAudit.affectedItems.length} {t('basket.unavailableAtStore')}</span>
                    </div>
                    {snoozeAudit.availableSwaps.length > 0 && onSwapAllSubstitutes && (
                      <button
                        type="button"
                        onClick={onSwapAllSubstitutes}
                        className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10.5px] cursor-pointer transition-colors shadow-2xs"
                      >
                        {t('basket.swapAllInStock')} ({snoozeAudit.availableSwaps.length})
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-800 leading-snug">
                    {t('basket.stockCheckNotice')}
                  </p>
                </div>
              )}

              {/* Active Basket Items */}
              {effectiveBasket && (
                <div className="space-y-2.5">
                  {effectiveBasket.items.map((item) => {
                    const itemName = item?.name || item?.plu || t('orders.item');
                    const reconciledUnavailable = item.availabilityState === 'UNAVAILABLE_AT_STORE' || item.availabilityState === 'QUANTITY_UNAVAILABLE';
                    const affected = snoozeAudit.affectedItems.find((a) => a.plu === item.plu) || (reconciledUnavailable ? { plu: item.plu, reason: 'unavailable' as const } : undefined);
                    const swap = snoozeAudit.availableSwaps.find((s) => s.originalPlu === item.plu);
                    const itemImageUrl = resolveItemImageUrl(item);

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
                      imageUrl: itemImageUrl,
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
                            {itemImageUrl ? (
                              <img
                                src={itemImageUrl}
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
                                  {t('basket.comboDeal')}
                                </span>
                              )}
                              {affected && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                  {item.availabilityState === 'QUANTITY_UNAVAILABLE' ? t('basket.quantityUnavailable') : affected.reason === 'snoozed' ? t('basket.snoozedByStore') : t('basket.unavailableHere')}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-gray-500">
                              {formatCurrency(item.price, currencySymbol)} {t('basket.each')}
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
                                +{formatCurrency(item.deposit, currencySymbol)} {t('basket.drsDeposit')}
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
                                {t('basket.inStockSubstitute')}: <strong>{swap.substituteName}</strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onSwapItem?.(item.plu, swap.substitutePlu)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shrink-0 flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                            >
                              <Repeat className="w-3 h-3" />
                              <span>{t('basket.swap')}</span>
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
                                    ? `${t('basket.ifUnavailable')}: ${t('basket.preChosenSubstitute')}`
                                    : item.substitutionPreference === 'REMOVE_IF_UNAVAILABLE'
                                    ? `${t('basket.ifUnavailable')}: ${t('basket.removeItem')}`
                                    : item.substitutionPreference === 'CANCEL_ORDER_IF_UNAVAILABLE'
                                    ? `${t('basket.ifUnavailable')}: ${t('basket.cancelEntireOrder')}`
                                    : `${t('basket.ifUnavailable')}: ${t('basket.bestMatch')}`}
                                </span>
                                {item.substitutionPreference === 'CUSTOMER_SELECTED' && (
                                  <span className="text-[10px] text-gray-500 block truncate font-medium">
                                    {item.preferredSubstituteName || item.preferredSubstitutePlu || `1 ${t('basket.alternativeSelected')}`}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.substitutionPreference === 'CUSTOMER_SELECTED' &&
                              item.preferredSubstitutePrice != null &&
                              moneyToMajor(item.preferredSubstitutePrice) > moneyToMajor(item.unitPrice || item.price) ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-extrabold bg-amber-100 text-amber-950">
                                  +£{(moneyToMajor(item.preferredSubstitutePrice) - moneyToMajor(item.unitPrice || item.price)).toFixed(2)} ${t('basket.buffer')}
                                </span>
                              ) : item.substitutionPreference === 'CANCEL_ORDER_IF_UNAVAILABLE' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-red-100 text-red-800">
                                  {t('basket.cancel')}
                                </span>
                              ) : item.substitutionPreference === 'REMOVE_IF_UNAVAILABLE' ? (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-gray-200 text-gray-700">
                                  {t('basket.refund')}
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-100 text-emerald-800">
                                  {t('basket.cheapest')}
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

              {/* MISSED COMBO OFFER PROMPTS — adds normal products; automatic qualification owns pricing. */}
              {missedBundleOffers.length > 0 && (
                <div className="pt-2 space-y-2">
                  {missedBundleOffers.map((offer) => {
                    const choices = offer.missingSection.choices;
                    const first = choices[0];
                    const product = candidatePool.find((candidate) => candidate.plu === first?.plu);
                    const imageUrl = product?.imageUrl || first?.imageUrl;
                    return (
                      <div key={offer.bundle.id} className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex items-start gap-2.5">
                        {imageUrl ? <img src={imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-white shrink-0" /> : <BadgePercent className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <span className="font-extrabold text-emerald-900 text-xs block">{offer.bundle.name}</span>
                          <p className="text-[11px] text-emerald-800 leading-tight">
                            {choices.length > 1 ? `${t('basket.chooseOne')} ${offer.missingSection.sectionName}` : `Add ${first?.name}`} {t('basket.addToCompleteDeal')}
                          </p>
                        </div>
                        <button type="button" disabled={loading} onClick={() => {
                          if (choices.length > 1) setComboChoice(offer);
                          else if (product) addProductQuantity(product, offer.missingSection.quantityNeeded);
                        }} className="shrink-0 px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50">
                          {choices.length > 1 ? t('basket.chooseItem') : t('basket.addSave')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {comboChoice && (
                <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setComboChoice(null)}>
                  <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl space-y-3" onClick={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-extrabold text-gray-900">{t('basket.completeDeal')} {comboChoice.bundle.name}</h3>
                        <p className="text-xs text-gray-500">{t('basket.chooseInStock')} {comboChoice.missingSection.sectionName}</p>
                      </div>
                      <button type="button" onClick={() => setComboChoice(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-2">
                      {comboChoice.missingSection.choices.map((choice) => {
                        const choiceProduct = candidatePool.find((candidate) => candidate.plu === choice.plu);
                        if (!choiceProduct) return null;
                        return <button key={choice.modifierId} type="button" onClick={() => {
                          addProductQuantity(choiceProduct, comboChoice.missingSection.quantityNeeded);
                          setComboChoice(null);
                        }} className="w-full p-3 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 flex items-center gap-3 text-left">
                          {(choiceProduct.imageUrl || choice.imageUrl) ? <img src={choiceProduct.imageUrl || choice.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <Package className="w-5 h-5 text-gray-400" />}
                          <span className="flex-1 text-xs font-bold text-gray-900">{choice.name}</span>
                          <span className="text-xs font-semibold text-gray-700">{formatCurrency(choiceProduct.price, currencySymbol)}</span>
                        </button>;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* HFSS REGULATORY COMPLIANCE BANNER */}
              {isUkTenant && reverseDealResults.hfssBlocked.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2 text-[11px] text-slate-700">
                  <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-slate-900 block">
                      {t('basket.hfssTitle')}
                    </span>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {reverseDealResults.hfssBlocked.length} {t('basket.hfssNotice')}
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
                <span>{t('basket.subtotal')} ({totalItemsCount} {t(totalItemsCount === 1 ? 'orders.item' : 'orders.items')})</span>
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
                        <span>{disc.title || t('basket.dealDiscount')}</span>
                      </span>
                      <span>-{currencySymbol}{moneyToMajor(disc.amount).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-black text-emerald-800 px-0.5">
                    <span>{t('basket.totalDealSavings')}</span>
                    <span>-{currencySymbol}{combinedDiscountsMajor.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {totalDeliveryFees > 0 && (
                <div className="flex justify-between">
                  <span>{t('basket.deliveryFee')}</span>
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
                  <span>{t('basket.deposit')}</span>
                  <span>+{currencySymbol}{(totalDepositsMajor || 0).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-gray-200 text-sm font-extrabold text-gray-900">
                <span>{t('basket.totalToPay')}</span>
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
                  <span>{t('basket.cardPreAuth')}:</span>
                </div>
                <span className="text-xs font-black font-mono text-emerald-950">
                  {currencySymbol}{preAuthMaxMajor.toFixed(2)} {t('basket.estimated')}
                </span>
              </div>
              <p className="text-[10.5px] text-emerald-900/80 leading-snug">
                {t('basket.preAuthNotice')}
              </p>
            </div>

            <button
              type="button"
              id="checkout-proceed-btn"
              onClick={onProceedToCheckout}
              disabled={(effectiveBasket?.items || []).some((item) => item.availabilityState === 'UNAVAILABLE_AT_STORE' || item.availabilityState === 'QUANTITY_UNAVAILABLE')}
              style={primaryBtnStyle}
              className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{snoozeAudit.hasSnoozedOrUnavailableItems ? t('basket.reviewResolve') : t('basket.goCheckout')}</span>
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
              imageUrl: resolveItemImageUrl(editingItem.item),
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
