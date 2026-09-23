import React, { useState, useEffect } from 'react';
import { Product, ProductAvailabilitySummary, BasketItem, Money, moneyToMajor } from '../../commerce/models';
import { evaluateProductAvailability } from '../../rules/availabilityRules';
import { QuantitySelector } from '../../components/QuantitySelector';
import { AgeGateModal } from '../compliance/AgeGateModal';
import { useTenantStyles } from '../../tenant/useTenant';
import { useI18n } from '../../i18n/I18nContext';
import { formatCurrency } from '../../utils/formatters';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { resolveAllergenTags, isKnownAllergen, isDietaryTag, normalizeDietaryTag, getCanonicalDietaryLabel } from '../../domain/allergens';
import { defaultAnalyticsClient, AnalyticsEventType } from '../../analytics';
import {
  X,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Info,
  Apple,
  Store,
  Wine,
  Leaf,
  Factory,
  Package,
  Boxes,
  Layers,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  availabilitySummary?: ProductAvailabilitySummary;
  basketQuantity: number;
  basketItems?: BasketItem[];
  sessionAgeAcknowledged?: Record<number, boolean>;
  onAcknowledgeAge?: (minAge: number) => void;
  onClose: () => void;
  onUpdateQuantity: (product: Product, quantity: number) => void;
  isStoreSelected: boolean;
  onPromptSelectStore?: () => void;
}

/**
 * Product Detail Modal with comprehensive regulatory & allergen information rendering.
 *
 * Rules:
 * - Dynamically renders sections ONLY if data exists:
 *   - Allergens
 *   - Ingredients
 *   - Nutritional information
 *   - Calories
 *   - Net quantity
 *   - Storage instructions
 *   - Manufacturer / FBO information
 *   - Alcohol information
 *   - Deposit information
 *   - Product tags
 * - Gracefully omits any missing section.
 * - Enforces advisory age gate for current session if age restricted.
 */
export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  availabilitySummary,
  basketQuantity,
  basketItems = [],
  sessionAgeAcknowledged = {},
  onAcknowledgeAge,
  onClose,
  onUpdateQuantity,
  isStoreSelected,
  onPromptSelectStore,
}) => {
  const { primaryBtnStyle, currencySymbol } = useTenantStyles();
  const { t } = useI18n();
  const [showAgeGate, setShowAgeGate] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [fetchedSummary, setFetchedSummary] = useState<ProductAvailabilitySummary | null>(null);

  useEffect(() => {
    setImgFailed(false);
  }, [product?.imageUrl]);

  useEffect(() => {
    if (product) {
      const priceVal = typeof product.price === 'object' && product.price !== null ? (product.price as any).amount / 100 : (typeof product.price === 'number' ? product.price : 0);
      defaultAnalyticsClient.track({
        type: AnalyticsEventType.PRODUCT_VIEW,
        productPlu: product.plu || product.id,
        categoryId: product.categoryIds?.[0],
        properties: {
          productName: product.name,
          price: priceVal,
        },
      });
    }
  }, [product?.id, product?.plu]);

  useEffect(() => {
    if (availabilitySummary) {
      setFetchedSummary(null);
      return;
    }
    if (!isStoreSelected && product?.plu) {
      let cancelled = false;
      const client = getCommerceClient();
      client.getProduct(product.plu).then((res) => {
        if (!cancelled && res?.summary) {
          setFetchedSummary(res.summary);
        }
      }).catch(() => {});
      return () => {
        cancelled = true;
      };
    }
  }, [availabilitySummary, isStoreSelected, product?.plu]);

  const activeSummary = availabilitySummary || fetchedSummary || undefined;

  if (!product) return null;

  const decision = evaluateProductAvailability(
    product,
    basketQuantity,
    { sessionAgeAcknowledged },
    basketItems
  );

  const origPriceNum = moneyToMajor(product.originalPrice);
  const priceNum = moneyToMajor(product.price);
  const hasDiscount = origPriceNum > 0 && priceNum > 0 && origPriceNum > priceNum;

  const depositAmount = moneyToMajor(product.supplementalInfo?.deposit ?? product.deposit);

  // Handle Add button click
  const handleAdd = () => {
    if (!isStoreSelected && onPromptSelectStore) {
      onPromptSelectStore();
      return;
    }

    // Check age requirement
    const ageReq = decision.ruleDecision?.ageRequirement;
    if (ageReq && (ageReq.requiresGate || ageReq.requiresAcknowledgement)) {
      if (!sessionAgeAcknowledged[ageReq.minimumAge]) {
        setShowAgeGate(true);
        return;
      }
    }

    if (decision.canAddToCart) {
      onUpdateQuantity(product, Math.max(1, basketQuantity + 1));
    }
  };

  const handleAgeConfirm = () => {
    const ageReq = decision.ruleDecision?.ageRequirement;
    if (ageReq) {
      onAcknowledgeAge?.(ageReq.minimumAge);
    }
    setShowAgeGate(false);
    if (decision.canAddToCart) {
      onUpdateQuantity(product, Math.max(1, basketQuantity + 1));
    }
  };

  // Check which sections have data
  // Customer-facing safety/preference metadata is intentionally narrower than
  // Deliverect's general product-tag taxonomy. Merchandising/operational tags
  // remain available to catalogue logic/admin but are not rendered as product facts.
  const allergenLabels = Array.from(new Set(
    (product.allergens || [])
      .map(String)
      .filter((label) => isKnownAllergen(label))
  ));
  const friendlyProductTags = Array.from(
    new Map(
      [
        ...(product.productTagLabels || []),
        ...(product.displayLabels || []),
        ...(product.productTags || []).map(String),
      ]
        .filter((tag) => isDietaryTag(String(tag)))
        .map((tag) => {
          const canonical = normalizeDietaryTag(String(tag));
          return [canonical, getCanonicalDietaryLabel(String(tag))] as const;
        })
    ).values()
  );
  const hasAllergens = allergenLabels.length > 0;
  const hasIngredients = Boolean(product.supplementalInfo?.ingredients);
  const hasNutrition = Boolean(product.nutritionalInfo);
  const hasCalories = Boolean(product.nutritionalInfo?.energyKcal !== undefined);
  const hasNetQuantity = Boolean(product.supplementalInfo?.netQuantity);
  const hasStorage = Boolean(product.supplementalInfo?.storageInstructions);
  const hasManufacturerOrOrigin = Boolean(
    product.supplementalInfo?.manufacturer || product.supplementalInfo?.origin
  );
  const hasAlcohol = Boolean(
    product.beverageInfo?.isAlcoholic ||
      (product.beverageInfo?.alcoholByVolume !== undefined &&
        product.beverageInfo.alcoholByVolume > 0)
  );
  const hasDeposit = Boolean(depositAmount && depositAmount > 0);
  const hasTags = friendlyProductTags.length > 0;

  return (
    <>
      <div
        id="product-detail-modal-backdrop"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto overflow-x-hidden"
        onClick={onClose}
      >
        <div
          id="product-detail-card"
          className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-6 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            id="close-product-detail-btn"
            onClick={onClose}
            className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/80 hover:bg-white text-gray-700 flex items-center justify-center shadow-md backdrop-blur-xs transition-colors"
            aria-label={t('product.closeDetails')}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 p-5 pb-24">
            {/* Main Image */}
            <div className="relative w-full aspect-4/3 rounded-2xl bg-gray-50 overflow-hidden mb-4 flex items-center justify-center">
              {product.imageUrl && !imgFailed ? (
                <img
                  key={product.imageUrl}
                  src={product.imageUrl}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400 flex flex-col items-center p-4 text-center">
                  <Package className="w-12 h-12 stroke-1 mb-2 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-600 line-clamp-1">{product.name}</span>
                  <span className="text-[11px] text-gray-400 mt-0.5">{t('product.noImage')}</span>
                </div>
              )}

              {hasDiscount && (
                <span className="absolute top-3 left-3 bg-amber-500 text-white font-extrabold text-xs px-2.5 py-1 rounded-full shadow-md">
                  {t('product.specialOffer')}
                </span>
              )}
            </div>

            {/* Brand & Name */}
            <div className="mb-3">
              {product.brand && (
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {product.brand}
                </span>
              )}
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 leading-tight">
                {product.name}
              </h1>
            </div>

            {/* Pricing & Deposit */}
            <div className="flex flex-wrap items-baseline gap-2 mb-4">
              <span className="text-2xl font-black text-gray-900 leading-[1.05]">
                {(() => {
                  if (isStoreSelected) {
                    if (product.price != null) {
                      return formatCurrency(product.price, currencySymbol);
                    }
                    if (typeof product.priceMinor === 'number') {
                      return formatCurrency(product.priceMinor, currencySymbol);
                    }
                    if ((product as any).basePrice != null) {
                      return formatCurrency((product as any).basePrice, currencySymbol);
                    }
                    return t('product.priceUnavailable');
                  }
                  const minPrice = activeSummary?.minimumPrice;
                  const maxPrice = activeSummary?.maximumPrice;
                  if (minPrice != null && maxPrice != null) {
                    const minMinor = typeof minPrice === 'number' ? minPrice : minPrice.amount;
                    const maxMinor = typeof maxPrice === 'number' ? maxPrice : maxPrice.amount;
                    if (minMinor !== maxMinor) {
                      return `${formatCurrency(minPrice, currencySymbol)} – ${formatCurrency(maxPrice, currencySymbol)}`;
                    }
                    return formatCurrency(minPrice, currencySymbol);
                  }
                  if (minPrice != null) {
                    return formatCurrency(minPrice, currencySymbol);
                  }
                  if (product.price != null) {
                    return formatCurrency(product.price, currencySymbol);
                  }
                  if (typeof product.priceMinor === 'number') {
                    return formatCurrency(product.priceMinor, currencySymbol);
                  }
                  if ((product as any).basePrice != null) {
                    return formatCurrency((product as any).basePrice, currencySymbol);
                  }
                  return t('product.priceUnavailable');
                })()}
              </span>

              {hasDiscount && product.originalPrice != null && (
                <span className="text-sm text-gray-400 line-through">
                  {formatCurrency(product.originalPrice, currencySymbol)}
                </span>
              )}

              {hasDeposit && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {t('product.includesDeposit').replace(
                    '{amount}',
                    `${currencySymbol}${(depositAmount || 0).toFixed(2)}`
                  )}
                </span>
              )}
            </div>

            {/* Store Availability notice before store selection */}
            {!isStoreSelected && activeSummary && (
              <button
                type="button"
                onClick={onPromptSelectStore}
                className="w-full mb-4 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 flex items-center justify-between gap-2 text-xs font-semibold text-emerald-900 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {(() => {
                      const avail = activeSummary.availableStoreCount || 0;
                      const total = activeSummary.eligibleStoreCount && activeSummary.eligibleStoreCount > 0
                        ? activeSummary.eligibleStoreCount
                        : avail;
                      if (avail === 0) {
                        return t('product.outOfStockNearby');
                      }
                      if (avail >= total && total > 0) {
                        return t('product.availableAllStores').replace('{count}', String(avail));
                      }
                      return t('product.availableSomeStores').replace('{available}', String(avail)).replace('{total}', String(total));
                    })()}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 underline shrink-0">
                  {t('product.compareStores')}
                </span>
              </button>
            )}

            {/* Stock & Regulatory Notice */}
            <div className="space-y-2 mb-5">
              {decision.badges?.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-bold p-2.5 rounded-xl border bg-gray-50 text-gray-800 border-gray-200"
                >
                  <Info className="w-4 h-4 shrink-0 text-gray-600" />
                  <span>{b}</span>
                </div>
              ))}

              {decision.limitReason && (
                <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{decision.limitReason}</span>
                </div>
              )}

              {decision.warnings?.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-xl border border-amber-200"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>{w}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mb-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  {t('product.description')}
                </h2>
                <p className="text-sm text-gray-700 leading-relaxed">{product.description}</p>
              </div>
            )}

            {/* 1. Allergens (Rendered only if data exists!) */}
            {hasAllergens && (
              <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
                <h2 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  {t('product.allergenInformation')}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {resolveAllergenTags(allergenLabels).map((a) => {
                    const IconComp = a.icon;
                    return (
                      <span
                        key={a.key}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${a.badgeColor}`}
                      >
                        <IconComp className="w-3.5 h-3.5 shrink-0" />
                        {a.label}
                      </span>
                    );
                  })}
                  {allergenLabels
                    .filter((label) => !resolveAllergenTags([label]).length)
                    .map((allergen) => (
                      <span
                        key={allergen}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-200/60 text-amber-950"
                      >
                        {allergen}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* 2. Ingredients (Rendered only if data exists!) */}
            {hasIngredients && (
              <div className="mb-5 p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                  {t('product.ingredients')}
                </h2>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {product.supplementalInfo!.ingredients}
                </p>
              </div>
            )}

            {/* 3 & 4. Nutritional Information & Calories (Rendered only if data exists!) */}
            {hasNutrition && (
              <div className="mb-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t('product.nutritionalValues')} (per {product.nutritionalInfo!.portionSize || '100g/ml'})
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {hasCalories && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">{t('product.caloriesEnergy')}</span>
                      <span className="font-bold text-gray-900">
                        {product.nutritionalInfo!.energyKcal} kcal
                      </span>
                    </div>
                  )}
                  {product.nutritionalInfo!.fat !== undefined && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">{t('product.fat')}</span>
                      <span className="font-bold text-gray-900">
                        {product.nutritionalInfo!.fat}g
                      </span>
                    </div>
                  )}
                  {product.nutritionalInfo!.carbohydrates !== undefined && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">{t('product.carbs')}</span>
                      <span className="font-bold text-gray-900">
                        {product.nutritionalInfo!.carbohydrates}g
                      </span>
                    </div>
                  )}
                  {product.nutritionalInfo!.protein !== undefined && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">{t('product.protein')}</span>
                      <span className="font-bold text-gray-900">
                        {product.nutritionalInfo!.protein}g
                      </span>
                    </div>
                  )}
                  {product.nutritionalInfo!.sugars !== undefined && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">{t('product.sugars')}</span>
                      <span className="font-bold text-gray-900">
                        {product.nutritionalInfo!.sugars}g
                      </span>
                    </div>
                  )}
                  {product.nutritionalInfo!.salt !== undefined && (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-gray-400 block text-[10px]">{t('product.salt')}</span>
                      <span className="font-bold text-gray-900">
                        {product.nutritionalInfo!.salt}g
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. Net Quantity (Rendered only if data exists!) */}
            {hasNetQuantity && (
              <div className="mb-4 text-xs text-gray-700 flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <Package className="w-4 h-4 text-gray-400 shrink-0" />
                <span>
                  <strong>{t('product.netQuantity')}:</strong> {product.supplementalInfo!.netQuantity}
                </span>
              </div>
            )}

            {/* 6. Storage Instructions (Rendered only if data exists!) */}
            {hasStorage && (
              <div className="mb-4 text-xs text-gray-700 flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <Boxes className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span>
                  <strong>{t('product.storageInstructions')}:</strong>{' '}
                  {product.supplementalInfo!.storageInstructions}
                </span>
              </div>
            )}

            {/* 7. Manufacturer / FBO Information (Rendered only if data exists!) */}
            {hasManufacturerOrOrigin && (
              <div className="mb-4 text-xs text-gray-700 space-y-1 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-2 text-gray-500 font-semibold mb-1">
                  <Factory className="w-4 h-4" />
                  <span>{t('product.manufacturerOrigin')}</span>
                </div>
                {product.supplementalInfo?.manufacturer && (
                  <p>
                    <strong>{t('product.manufacturer')}:</strong>{' '}
                    {product.supplementalInfo.manufacturer}
                  </p>
                )}
                {product.supplementalInfo?.origin && (
                  <p>
                    <strong>{t('product.countryOrigin')}:</strong> {product.supplementalInfo.origin}
                  </p>
                )}
              </div>
            )}

            {/* 8. Alcohol Information (Rendered only if data exists!) */}
            {hasAlcohol && (
              <div className="mb-5 p-3.5 rounded-2xl bg-purple-50/80 border border-purple-100 text-xs text-purple-950">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Wine className="w-4 h-4 text-purple-700" />
                  <span>{t('product.alcoholDetails')}</span>
                </div>
                <div className="space-y-1 text-purple-900">
                  {product.beverageInfo?.alcoholByVolume !== undefined && (
                    <p>
                      <strong>ABV:</strong> {product.beverageInfo.alcoholByVolume}% vol
                    </p>
                  )}
                  <p>
                    <strong>{t('product.legalNotice')}:</strong> {t('product.age18Notice')}
                  </p>
                </div>
              </div>
            )}

            {/* 9. Deposit / DRS Information (Rendered only if data exists!) */}
            {hasDeposit && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-100 text-xs text-emerald-950">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  <span>{t('product.depositScheme')}</span>
                </div>
                <p className="text-emerald-900 leading-relaxed">
                  <strong>{currencySymbol}{(depositAmount || 0).toFixed(2)}</strong> {t('product.depositNotice')}
                </p>
              </div>
            )}

            {/* 10. Product Tags (Rendered only if data exists!) */}
            {hasTags && (
              <div className="mb-5">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  {t('product.dietaryLifestyle')}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {friendlyProductTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Barcode / PLU metadata */}
            <div className="text-[11px] text-gray-400 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span>PLU: {product.plu}</span>
              {product.gtin && product.gtin.length > 0 && (
                <span>GTIN: {product.gtin.join(', ')}</span>
              )}
            </div>
          </div>

          {/* Fixed Bottom Action Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 flex items-center justify-between gap-3 shadow-lg">
            <div>
              <span className="text-[11px] text-gray-400 block">{t('product.total')}</span>
              <span className="text-xl font-extrabold text-gray-900 leading-[1.05]">
                {(() => {
                  const qty = Math.max(1, basketQuantity);
                  if (isStoreSelected) {
                    return formatCurrency(priceNum * qty, currencySymbol);
                  }
                  const minP = activeSummary?.minimumPrice != null ? moneyToMajor(activeSummary.minimumPrice) : null;
                  const maxP = activeSummary?.maximumPrice != null ? moneyToMajor(activeSummary.maximumPrice) : null;
                  if (minP != null && maxP != null) {
                    if (Math.abs(minP - maxP) > 0.001) {
                      return `${formatCurrency(minP * qty, currencySymbol)} – ${formatCurrency(maxP * qty, currencySymbol)}`;
                    }
                    return formatCurrency(minP * qty, currencySymbol);
                  }
                  if (minP != null) {
                    return formatCurrency(minP * qty, currencySymbol);
                  }
                  const fallback = priceNum > 0 ? priceNum : (product as any).basePrice ?? 0;
                  return formatCurrency(fallback * qty, currencySymbol);
                })()}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {decision.isGreyedOut ? (
                <button
                  type="button"
                  disabled
                  className="py-3 px-6 rounded-2xl bg-gray-100 text-gray-400 font-bold text-sm cursor-not-allowed"
                >
                  {t('product.outOfStock')}
                </button>
              ) : !isStoreSelected ? (
                <button
                  type="button"
                  onClick={handleAdd}
                  style={primaryBtnStyle}
                  className="py-3 px-6 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-md active:scale-95 transition-transform"
                >
                  <Store className="w-4 h-4" />
                  <span>{t('product.chooseStore')}</span>
                </button>
              ) : basketQuantity > 0 ? (
                <QuantitySelector
                  quantity={basketQuantity}
                  maxQuantity={decision.effectiveLimit}
                  onIncrement={() => onUpdateQuantity(product, basketQuantity + 1)}
                  onDecrement={() => onUpdateQuantity(product, basketQuantity - 1)}
                  size="lg"
                />
              ) : (
                <button
                  type="button"
                  id="modal-add-to-basket-btn"
                  onClick={handleAdd}
                  style={primaryBtnStyle}
                  className="py-3 px-7 rounded-2xl font-bold text-sm flex items-center gap-2 shadow-md active:scale-95 transition-transform"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>{t('product.addToBasket')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advisory Age-Gate Modal */}
      <AgeGateModal
        isOpen={showAgeGate}
        product={product}
        minimumAge={decision.ruleDecision?.ageRequirement?.minimumAge || 18}
        onConfirm={handleAgeConfirm}
        onCancel={() => setShowAgeGate(false)}
      />
    </>
  );
};
